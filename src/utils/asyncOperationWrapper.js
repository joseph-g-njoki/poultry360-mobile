import AsyncStorage from '@react-native-async-storage/async-storage';
import memoryManager from './memoryManager';

/**
 * Async Operation Wrapper
 * Provides crash-safe async operations with automatic error handling and recovery
 */
class AsyncOperationWrapper {
  constructor() {
    this.operationTimeout = 30000; // 30 seconds
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
    this.operationQueue = new Map();
    this.isOnline = true;
  }

  /**
   * Safe async operation executor with crash prevention
   */
  async safeAsync(operation, options = {}) {
    const {
      operationName = 'unknown',
      timeout = this.operationTimeout,
      retries = this.retryAttempts,
      retryDelay = this.retryDelay,
      fallback = null,
      critical = false
    } = options;

    const operationId = `${operationName}_${Date.now()}_${Math.random()}`;

    try {
      console.log(`🔄 Starting safe async operation: ${operationName}`);

      // Add to operation queue for monitoring
      this.operationQueue.set(operationId, {
        name: operationName,
        startTime: Date.now(),
        timeout,
        critical
      });

      // Create retry wrapper
      const retryWrapper = async (attempt = 1) => {
        try {
          // CRASH FIX: Create a fresh timeout promise for EACH retry attempt
          // Previous bug: timeout promise was shared across retries, causing cumulative timeout
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Operation ${operationName} timed out after ${timeout}ms (attempt ${attempt}/${retries})`)), timeout)
          );

          // Execute the operation with timeout
          const result = await Promise.race([
            operation(),
            timeoutPromise
          ]);

          console.log(`✅ Safe async operation completed: ${operationName}`);
          return result;

        } catch (error) {
          console.warn(`❌ Async operation failed (attempt ${attempt}/${retries}): ${operationName}`, error.message);

          // If this is the last attempt or a critical error, throw
          if (attempt >= retries || this.isCriticalError(error)) {
            throw error;
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));

          // Retry
          return retryWrapper(attempt + 1);
        }
      };

      // Execute with retries
      const result = await retryWrapper();

      // Clean up from queue
      this.operationQueue.delete(operationId);

      return result;

    } catch (error) {
      console.error(`🚨 Safe async operation failed: ${operationName}`, error);

      // Clean up from queue
      this.operationQueue.delete(operationId);

      // Perform cleanup for memory issues
      if (this.isMemoryError(error)) {
        await memoryManager.performCleanup(`async_memory_error_${operationName}`);
      }

      // Return fallback if provided
      if (fallback !== null) {
        console.log(`🔄 Using fallback for operation: ${operationName}`);
        return typeof fallback === 'function' ? fallback(error) : fallback;
      }

      // Log the error for debugging
      await this.logAsyncError(operationName, error);

      // If not critical, return null instead of crashing
      if (!critical) {
        console.log(`⚠️ Non-critical operation failed, returning null: ${operationName}`);
        return null;
      }

      // Re-throw critical errors
      throw error;
    }
  }

  /**
   * Safe AsyncStorage operations
   */
  async safeStorageGet(key, fallback = null) {
    return this.safeAsync(
      () => AsyncStorage.getItem(key),
      {
        operationName: `storage_get_${key}`,
        fallback,
        critical: false,
        retries: 2
      }
    );
  }

  async safeStorageSet(key, value) {
    return this.safeAsync(
      () => AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)),
      {
        operationName: `storage_set_${key}`,
        critical: false,
        retries: 2
      }
    );
  }

  async safeStorageRemove(key) {
    return this.safeAsync(
      () => AsyncStorage.removeItem(key),
      {
        operationName: `storage_remove_${key}`,
        critical: false,
        retries: 1
      }
    );
  }

  /**
   * Safe network operations
   */
  async safeNetworkRequest(requestFunction, options = {}) {
    const {
      operationName = 'network_request',
      timeout = 15000,
      retries = 2,
      offline = true
    } = options;

    return this.safeAsync(
      requestFunction,
      {
        operationName,
        timeout,
        retries: this.isOnline ? retries : 0,
        fallback: offline ? () => this.getOfflineFallback(operationName) : null,
        critical: false
      }
    );
  }

  /**
   * Safe JSON operations
   */
  safeJsonParse(jsonString, fallback = null) {
    try {
      if (!jsonString || typeof jsonString !== 'string') {
        return fallback;
      }
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Safe JSON parse failed:', error.message);
      return fallback;
    }
  }

  safeJsonStringify(object, fallback = '{}') {
    try {
      if (object === null || object === undefined) {
        return fallback;
      }
      return JSON.stringify(object);
    } catch (error) {
      console.warn('Safe JSON stringify failed:', error.message);
      return fallback;
    }
  }

  /**
   * Error type detection
   */
  isCriticalError(error) {
    const criticalPatterns = [
      'ENOENT',
      'Permission denied',
      'Access denied',
      'Unauthorized',
      'Authentication',
      'ReferenceError',
      'TypeError'
    ];

    return criticalPatterns.some(pattern =>
      error.message.includes(pattern) || error.code === pattern
    );
  }

  isMemoryError(error) {
    const memoryPatterns = [
      'out of memory',
      'memory',
      'heap',
      'allocation failed',
      'Maximum call stack'
    ];

    return memoryPatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  isNetworkError(error) {
    const networkPatterns = [
      'Network request failed',
      'NETWORK_ERROR',
      'TIMEOUT',
      'CONNECTION',
      'ECONNRESET',
      'ENOTFOUND'
    ];

    return networkPatterns.some(pattern =>
      error.message.includes(pattern) || error.code === pattern
    );
  }

  /**
   * Get offline fallback data
   */
  async getOfflineFallback(operationName) {
    try {
      // Check if we have cached data for this operation
      const cacheKey = `offline_cache_${operationName}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);

      if (cachedData) {
        console.log(`📱 Using offline fallback for: ${operationName}`);
        return this.safeJsonParse(cachedData, null);
      }

      return null;
    } catch (error) {
      console.warn('Failed to get offline fallback:', error);
      return null;
    }
  }

  /**
   * Log async errors for debugging
   */
  async logAsyncError(operationName, error) {
    try {
      const errorLog = {
        operationName,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        isNetworkError: this.isNetworkError(error),
        isMemoryError: this.isMemoryError(error),
        isCriticalError: this.isCriticalError(error)
      };

      // Store error log
      const existingLogs = await this.safeStorageGet('async_error_logs', '[]');
      const logs = this.safeJsonParse(existingLogs, []);

      logs.unshift(errorLog);
      // Keep only last 50 errors
      const trimmedLogs = logs.slice(0, 50);

      await this.safeStorageSet('async_error_logs', this.safeJsonStringify(trimmedLogs));

      console.log('📝 Async error logged:', errorLog);
    } catch (loggingError) {
      console.warn('Failed to log async error:', loggingError);
    }
  }

  /**
   * Get operation statistics
   */
  getOperationStats() {
    const now = Date.now();
    const activeOperations = Array.from(this.operationQueue.values());

    return {
      activeOperations: activeOperations.length,
      longRunningOperations: activeOperations.filter(op =>
        (now - op.startTime) > (op.timeout * 0.8)
      ).length,
      criticalOperations: activeOperations.filter(op => op.critical).length,
      operations: activeOperations.map(op => ({
        name: op.name,
        duration: now - op.startTime,
        critical: op.critical
      }))
    };
  }

  /**
   * Cancel all pending operations
   */
  cancelAllOperations() {
    console.log(`🛑 Cancelling ${this.operationQueue.size} pending operations`);
    this.operationQueue.clear();
  }

  /**
   * Set online status
   */
  setOnlineStatus(isOnline) {
    this.isOnline = isOnline;
    console.log(`📡 Network status changed: ${isOnline ? 'online' : 'offline'}`);
  }
}

// Export singleton instance
const asyncOperationWrapper = new AsyncOperationWrapper();

export default asyncOperationWrapper;