import { openDatabaseSync } from 'expo-sqlite';

/**
 * Analytics Offline Service
 *
 * Handles offline caching of analytics data using SQLite
 * Provides fallback data when device is offline
 */
class AnalyticsOfflineService {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours
  }

  /**
   * Initialize the analytics cache database
   */
  init() {
    try {
      if (this.isReady && this.db) {
        return true;
      }

      console.log('[AnalyticsOffline] Initializing...');

      // Open database
      this.db = openDatabaseSync('poultry360_offline.db');

      // Create analytics cache tables
      this.createTables();

      this.isReady = true;
      console.log('[AnalyticsOffline] Initialization complete');
      return true;
    } catch (error) {
      console.error('[AnalyticsOffline] Init failed:', error);
      this.isReady = false;
      return false;
    }
  }

  /**
   * Create analytics cache tables
   */
  createTables() {
    try {
      // Dashboard analytics cache
      this.db.execSync(`
        CREATE TABLE IF NOT EXISTS analytics_dashboard_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cache_key TEXT UNIQUE NOT NULL,
          data TEXT NOT NULL,
          cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT
        );
      `);

      // Flock performance cache
      this.db.execSync(`
        CREATE TABLE IF NOT EXISTS analytics_performance_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cache_key TEXT UNIQUE NOT NULL,
          data TEXT NOT NULL,
          cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT
        );
      `);

      // Financial analytics cache
      this.db.execSync(`
        CREATE TABLE IF NOT EXISTS analytics_financial_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cache_key TEXT UNIQUE NOT NULL,
          data TEXT NOT NULL,
          cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT
        );
      `);

      // Trends cache
      this.db.execSync(`
        CREATE TABLE IF NOT EXISTS analytics_trends_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cache_key TEXT UNIQUE NOT NULL,
          data TEXT NOT NULL,
          cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT
        );
      `);

      console.log('[AnalyticsOffline] Tables created successfully');
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to create tables:', error);
      throw error;
    }
  }

  /**
   * Generate cache key from parameters
   */
  generateCacheKey(type, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return `${type}_${sortedParams}`;
  }

  /**
   * Calculate expiry date
   */
  getExpiryDate() {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + this.CACHE_EXPIRY_HOURS);
    return expiry.toISOString();
  }

  /**
   * Cache dashboard analytics
   */
  cacheDashboardAnalytics(params, data) {
    if (!this.isReady) {
      console.warn('[AnalyticsOffline] Not ready, skipping cache');
      return false;
    }

    try {
      const cacheKey = this.generateCacheKey('dashboard', params);
      const dataJson = JSON.stringify(data);
      const expiresAt = this.getExpiryDate();

      this.db.runSync(
        `INSERT OR REPLACE INTO analytics_dashboard_cache (cache_key, data, cached_at, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
        [cacheKey, dataJson, expiresAt]
      );

      console.log('[AnalyticsOffline] Cached dashboard analytics:', cacheKey);
      return true;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to cache dashboard:', error);
      return false;
    }
  }

  /**
   * Get cached dashboard analytics
   */
  getCachedDashboardAnalytics(params) {
    if (!this.isReady) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey('dashboard', params);

      const result = this.db.getFirstSync(
        `SELECT data, cached_at, expires_at FROM analytics_dashboard_cache WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP`,
        [cacheKey]
      );

      if (result) {
        console.log('[AnalyticsOffline] Retrieved cached dashboard analytics');
        return JSON.parse(result.data);
      }

      return null;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to get cached dashboard:', error);
      return null;
    }
  }

  /**
   * Cache flock performance data
   */
  cacheFlockPerformance(params, data) {
    if (!this.isReady) {
      return false;
    }

    try {
      const cacheKey = this.generateCacheKey('performance', params);
      const dataJson = JSON.stringify(data);
      const expiresAt = this.getExpiryDate();

      this.db.runSync(
        `INSERT OR REPLACE INTO analytics_performance_cache (cache_key, data, cached_at, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
        [cacheKey, dataJson, expiresAt]
      );

      console.log('[AnalyticsOffline] Cached performance data:', cacheKey);
      return true;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to cache performance:', error);
      return false;
    }
  }

  /**
   * Get cached flock performance data
   */
  getCachedFlockPerformance(params) {
    if (!this.isReady) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey('performance', params);

      const result = this.db.getFirstSync(
        `SELECT data, cached_at, expires_at FROM analytics_performance_cache WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP`,
        [cacheKey]
      );

      if (result) {
        console.log('[AnalyticsOffline] Retrieved cached performance data');
        return JSON.parse(result.data);
      }

      return null;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to get cached performance:', error);
      return null;
    }
  }

  /**
   * Cache financial analytics data
   */
  cacheFinancialAnalytics(params, data) {
    if (!this.isReady) {
      return false;
    }

    try {
      const cacheKey = this.generateCacheKey('financial', params);
      const dataJson = JSON.stringify(data);
      const expiresAt = this.getExpiryDate();

      this.db.runSync(
        `INSERT OR REPLACE INTO analytics_financial_cache (cache_key, data, cached_at, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
        [cacheKey, dataJson, expiresAt]
      );

      console.log('[AnalyticsOffline] Cached financial data:', cacheKey);
      return true;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to cache financial:', error);
      return false;
    }
  }

  /**
   * Get cached financial analytics data
   */
  getCachedFinancialAnalytics(params) {
    if (!this.isReady) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey('financial', params);

      const result = this.db.getFirstSync(
        `SELECT data, cached_at, expires_at FROM analytics_financial_cache WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP`,
        [cacheKey]
      );

      if (result) {
        console.log('[AnalyticsOffline] Retrieved cached financial data');
        return JSON.parse(result.data);
      }

      return null;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to get cached financial:', error);
      return null;
    }
  }

  /**
   * Cache trends data
   */
  cacheTrends(params, data) {
    if (!this.isReady) {
      return false;
    }

    try {
      const cacheKey = this.generateCacheKey('trends', params);
      const dataJson = JSON.stringify(data);
      const expiresAt = this.getExpiryDate();

      this.db.runSync(
        `INSERT OR REPLACE INTO analytics_trends_cache (cache_key, data, cached_at, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
        [cacheKey, dataJson, expiresAt]
      );

      console.log('[AnalyticsOffline] Cached trends data:', cacheKey);
      return true;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to cache trends:', error);
      return false;
    }
  }

  /**
   * Get cached trends data
   */
  getCachedTrends(params) {
    if (!this.isReady) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey('trends', params);

      const result = this.db.getFirstSync(
        `SELECT data, cached_at, expires_at FROM analytics_trends_cache WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP`,
        [cacheKey]
      );

      if (result) {
        console.log('[AnalyticsOffline] Retrieved cached trends data');
        return JSON.parse(result.data);
      }

      return null;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to get cached trends:', error);
      return null;
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    if (!this.isReady) {
      return false;
    }

    try {
      this.db.runSync(`DELETE FROM analytics_dashboard_cache WHERE expires_at <= CURRENT_TIMESTAMP`);
      this.db.runSync(`DELETE FROM analytics_performance_cache WHERE expires_at <= CURRENT_TIMESTAMP`);
      this.db.runSync(`DELETE FROM analytics_financial_cache WHERE expires_at <= CURRENT_TIMESTAMP`);
      this.db.runSync(`DELETE FROM analytics_trends_cache WHERE expires_at <= CURRENT_TIMESTAMP`);

      console.log('[AnalyticsOffline] Cleared expired cache entries');
      return true;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to clear expired cache:', error);
      return false;
    }
  }

  /**
   * Clear all analytics cache
   */
  clearAllCache() {
    if (!this.isReady) {
      return false;
    }

    try {
      this.db.runSync(`DELETE FROM analytics_dashboard_cache`);
      this.db.runSync(`DELETE FROM analytics_performance_cache`);
      this.db.runSync(`DELETE FROM analytics_financial_cache`);
      this.db.runSync(`DELETE FROM analytics_trends_cache`);

      console.log('[AnalyticsOffline] Cleared all cache');
      return true;
    } catch (error) {
      console.error('[AnalyticsOffline] Failed to clear all cache:', error);
      return false;
    }
  }
}

export default new AnalyticsOfflineService();
