/**
 * Performance Optimizer Utility
 * Provides caching, query optimization, and performance monitoring
 */

class PerformanceOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.CACHE_TTL = 30000; // 30 seconds default
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Cache a database query result
   * @param {string} key - Unique cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  cacheQuery(key, data, ttl = this.CACHE_TTL) {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get cached query result
   * @param {string} key - Cache key
   * @returns {any|null} - Cached data or null if expired/missing
   */
  getCachedQuery(key) {
    const cached = this.queryCache.get(key);
    if (!cached) {
      this.cacheMisses++;
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > cached.ttl) {
      this.queryCache.delete(key);
      this.cacheMisses++;
      return null;
    }

    this.cacheHits++;
    return cached.data;
  }

  /**
   * Invalidate specific cache key or all cache
   * @param {string} key - Cache key to invalidate (optional)
   */
  invalidateCache(key = null) {
    if (key) {
      this.queryCache.delete(key);
    } else {
      this.queryCache.clear();
    }
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache stats
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total * 100).toFixed(2) : 0;

    return {
      size: this.queryCache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: `${hitRate}%`,
      total
    };
  }

  /**
   * Generate cache key from table name and query params
   * @param {string} tableName - Table name
   * @param {string} whereClause - WHERE clause
   * @param {array} whereValues - WHERE values
   * @returns {string} - Cache key
   */
  generateCacheKey(tableName, whereClause = '', whereValues = []) {
    return `${tableName}:${whereClause}:${JSON.stringify(whereValues)}`;
  }

  /**
   * Debounce function execution
   * @param {function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {function} - Debounced function
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function execution
   * @param {function} func - Function to throttle
   * @param {number} limit - Throttle limit in milliseconds
   * @returns {function} - Throttled function
   */
  throttle(func, limit = 1000) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Chunk large array processing
   * @param {array} array - Array to process
   * @param {function} processor - Processing function
   * @param {number} chunkSize - Chunk size
   * @returns {Promise<array>} - Processed results
   */
  async processInChunks(array, processor, chunkSize = 100) {
    const results = [];

    for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map(processor));
      results.push(...chunkResults);

      // Give CPU a break between chunks
      if (i + chunkSize < array.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return results;
  }

  /**
   * Measure execution time of async function
   * @param {function} func - Async function to measure
   * @param {string} label - Label for logging
   * @returns {Promise<any>} - Function result
   */
  async measureAsync(func, label = 'Operation') {
    const startTime = Date.now();
    try {
      const result = await func();
      const duration = Date.now() - startTime;

      console.log(`⏱️ [Performance] ${label}: ${duration}ms`);

      if (duration > 3000) {
        console.warn(`⚠️ [Performance] Slow operation: ${label} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [Performance] ${label} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Create optimized FlatList props
   * @param {number} itemHeight - Average item height
   * @returns {object} - FlatList performance props
   */
  getFlatListProps(itemHeight = 200) {
    return {
      removeClippedSubviews: true,
      maxToRenderPerBatch: 10,
      updateCellsBatchingPeriod: 50,
      initialNumToRender: 10,
      windowSize: 10,
      getItemLayout: (data, index) => ({
        length: itemHeight,
        offset: itemHeight * index,
        index,
      }),
    };
  }

  /**
   * Safely parse JSON with error handling
   * @param {string} jsonString - JSON string to parse
   * @param {any} defaultValue - Default value if parsing fails
   * @returns {any} - Parsed JSON or default value
   */
  safeJSONParse(jsonString, defaultValue = {}) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('[Performance] JSON parse error:', error.message);
      return defaultValue;
    }
  }

  /**
   * Deep clone object efficiently
   * @param {object} obj - Object to clone
   * @returns {object} - Cloned object
   */
  deepClone(obj) {
    // Use structuredClone if available (modern environments)
    if (typeof structuredClone !== 'undefined') {
      return structuredClone(obj);
    }
    // Fallback to JSON parse/stringify
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Check if object is empty
   * @param {object} obj - Object to check
   * @returns {boolean} - True if empty
   */
  isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  }

  /**
   * Batch async operations with concurrency limit
   * @param {array} items - Items to process
   * @param {function} asyncOperation - Async operation
   * @param {number} concurrency - Max concurrent operations
   * @returns {Promise<array>} - Results
   */
  async batchAsync(items, asyncOperation, concurrency = 5) {
    const results = [];
    const executing = [];

    for (const item of items) {
      const promise = asyncOperation(item).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  /**
   * Log cache statistics
   */
  logCacheStats() {
    const stats = this.getCacheStats();
    console.log('📊 [Cache Stats]', stats);
  }

  /**
   * Clear old cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    let cleared = 0;

    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.queryCache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`🧹 [Cache] Cleared ${cleared} expired entries`);
    }
  }
}

// Export singleton instance
const performanceOptimizer = new PerformanceOptimizer();

// Auto-clear expired cache every 5 minutes
setInterval(() => {
  performanceOptimizer.clearExpiredCache();
}, 300000);

export default performanceOptimizer;
