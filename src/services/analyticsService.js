import api from './api';
import analyticsOfflineService from './analyticsOfflineService';
import NetInfo from '@react-native-community/netinfo';

/**
 * Analytics Service
 *
 * Handles all analytics-related API calls to the backend.
 * Connects to backend endpoints:
 * - GET /api/v1/analytics/dashboard
 * - GET /api/v1/analytics/flocks/performance
 * - GET /api/v1/analytics/financial
 * - GET /api/v1/analytics/trends
 *
 * Features offline caching using SQLite
 */

class AnalyticsService {
  constructor() {
    // Initialize offline service
    analyticsOfflineService.init();
  }
  /**
   * Get dashboard analytics overview
   *
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (ISO format)
   * @param {string} params.endDate - End date (ISO format)
   * @param {number} params.farmId - Optional farm ID to filter by
   * @returns {Promise<Object>} Dashboard analytics data
   *
   * Response structure:
   * {
   *   totalBirds: number,
   *   mortalityRate: number,
   *   eggProduction: number,
   *   revenue: number,
   *   trends: { ... }
   * }
   */
  async getDashboardAnalytics(params = {}) {
    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();

      // Try to get cached data first (for offline or faster loading)
      const cachedData = analyticsOfflineService.getCachedDashboardAnalytics(params);

      // If offline, return cached data or throw
      if (!netInfo.isConnected) {
        if (cachedData) {
          console.log('[AnalyticsService] Using cached dashboard data (offline)');
          return cachedData;
        }
        throw new Error('No internet connection and no cached data available');
      }

      const queryParams = new URLSearchParams();

      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.farmId) queryParams.append('farmId', params.farmId);

      const queryString = queryParams.toString();
      // FIX: Use correct backend endpoint - /analytics/production-trends instead of /analytics/dashboard
      const url = `/analytics/production-trends${queryString ? `?${queryString}` : ''}`;

      const response = await api.api.get(url);

      // Cache the fresh data
      analyticsOfflineService.cacheDashboardAnalytics(params, response.data);

      return response.data;
    } catch (error) {
      console.error('[AnalyticsService] getDashboardAnalytics error:', error);

      // Try cached data as fallback
      const cachedData = analyticsOfflineService.getCachedDashboardAnalytics(params);
      if (cachedData) {
        console.log('[AnalyticsService] Using cached dashboard data (fallback)');
        return cachedData;
      }

      throw api.handleError(error);
    }
  }

  /**
   * Get flock performance analytics
   *
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (ISO format)
   * @param {string} params.endDate - End date (ISO format)
   * @param {number} params.batchId - Optional batch ID to filter by
   * @returns {Promise<Object>} Flock performance data
   *
   * Response structure:
   * {
   *   flocks: [ { name, performance, fcr, mortality, growth } ],
   *   averageFCR: number,
   *   averageMortality: number
   * }
   */
  async getFlockPerformance(params = {}) {
    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      const cachedData = analyticsOfflineService.getCachedFlockPerformance(params);

      if (!netInfo.isConnected) {
        if (cachedData) {
          console.log('[AnalyticsService] Using cached performance data (offline)');
          return cachedData;
        }
        throw new Error('No internet connection and no cached data available');
      }

      const queryParams = new URLSearchParams();

      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.batchId) queryParams.append('batchId', params.batchId);

      const queryString = queryParams.toString();
      // FIX: Use correct backend endpoint - remove /v1 prefix
      const url = `/analytics/flocks/performance${queryString ? `?${queryString}` : ''}`;

      const response = await api.api.get(url);

      // Cache the fresh data
      analyticsOfflineService.cacheFlockPerformance(params, response.data);

      return response.data;
    } catch (error) {
      console.error('[AnalyticsService] getFlockPerformance error:', error);

      // Try cached data as fallback
      const cachedData = analyticsOfflineService.getCachedFlockPerformance(params);
      if (cachedData) {
        console.log('[AnalyticsService] Using cached performance data (fallback)');
        return cachedData;
      }

      throw api.handleError(error);
    }
  }

  /**
   * Get financial analytics
   *
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (ISO format)
   * @param {string} params.endDate - End date (ISO format)
   * @param {number} params.farmId - Optional farm ID to filter by
   * @returns {Promise<Object>} Financial analytics data
   *
   * Response structure:
   * {
   *   revenue: number,
   *   expenses: number,
   *   profit: number,
   *   profitMargin: number,
   *   roi: number,
   *   breakdown: { feed: number, labor: number, ... }
   * }
   */
  async getFinancialAnalytics(params = {}) {
    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      const cachedData = analyticsOfflineService.getCachedFinancialAnalytics(params);

      if (!netInfo.isConnected) {
        if (cachedData) {
          console.log('[AnalyticsService] Using cached financial data (offline)');
          return cachedData;
        }
        throw new Error('No internet connection and no cached data available');
      }

      const queryParams = new URLSearchParams();

      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.farmId) queryParams.append('farmId', params.farmId);

      const queryString = queryParams.toString();
      // FIX: Use correct backend endpoint - remove /v1 prefix
      const url = `/analytics/financial${queryString ? `?${queryString}` : ''}`;

      const response = await api.api.get(url);

      // Cache the fresh data
      analyticsOfflineService.cacheFinancialAnalytics(params, response.data);

      return response.data;
    } catch (error) {
      console.error('[AnalyticsService] getFinancialAnalytics error:', error);

      // Try cached data as fallback
      const cachedData = analyticsOfflineService.getCachedFinancialAnalytics(params);
      if (cachedData) {
        console.log('[AnalyticsService] Using cached financial data (fallback)');
        return cachedData;
      }

      throw api.handleError(error);
    }
  }

  /**
   * Get trend analysis
   *
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (ISO format)
   * @param {string} params.endDate - End date (ISO format)
   * @param {string} params.metric - Metric to analyze (e.g., 'mortality', 'production', 'feed')
   * @param {string} params.interval - Time interval ('daily', 'weekly', 'monthly')
   * @returns {Promise<Object>} Trend analysis data
   *
   * Response structure:
   * {
   *   labels: ['Jan', 'Feb', 'Mar'],
   *   values: [100, 150, 120],
   *   trend: 'up' | 'down' | 'stable',
   *   percentageChange: number
   * }
   */
  async getTrends(params = {}) {
    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      const cachedData = analyticsOfflineService.getCachedTrends(params);

      if (!netInfo.isConnected) {
        if (cachedData) {
          console.log('[AnalyticsService] Using cached trends data (offline)');
          return cachedData;
        }
        throw new Error('No internet connection and no cached data available');
      }

      const queryParams = new URLSearchParams();

      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.metric) queryParams.append('metric', params.metric);
      if (params.interval) queryParams.append('interval', params.interval);

      const queryString = queryParams.toString();
      // FIX: Use correct backend endpoint - remove /v1 prefix
      const url = `/analytics/trends${queryString ? `?${queryString}` : ''}`;

      const response = await api.api.get(url);

      // Cache the fresh data
      analyticsOfflineService.cacheTrends(params, response.data);

      return response.data;
    } catch (error) {
      console.error('[AnalyticsService] getTrends error:', error);

      // Try cached data as fallback
      const cachedData = analyticsOfflineService.getCachedTrends(params);
      if (cachedData) {
        console.log('[AnalyticsService] Using cached trends data (fallback)');
        return cachedData;
      }

      throw api.handleError(error);
    }
  }

  /**
   * Export analytics data
   *
   * @param {Object} params - Export parameters
   * @param {string} params.type - Export type ('pdf', 'csv', 'excel')
   * @param {string} params.startDate - Start date (ISO format)
   * @param {string} params.endDate - End date (ISO format)
   * @returns {Promise<Object>} Export data or download URL
   */
  async exportAnalytics(params = {}) {
    try {
      const queryParams = new URLSearchParams();

      if (params.type) queryParams.append('type', params.type);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);

      const queryString = queryParams.toString();
      const url = `/api/v1/analytics/export${queryString ? `?${queryString}` : ''}`;

      const response = await api.api.get(url, {
        responseType: params.type === 'pdf' ? 'blob' : 'json',
      });

      return response.data;
    } catch (error) {
      console.error('[AnalyticsService] exportAnalytics error:', error);
      throw api.handleError(error);
    }
  }

  /**
   * Get custom analytics report
   *
   * @param {Object} config - Report configuration
   * @param {string} config.reportType - Type of report
   * @param {Object} config.filters - Filters to apply
   * @returns {Promise<Object>} Custom report data
   */
  async getCustomReport(config = {}) {
    try {
      const response = await api.api.post('/api/v1/analytics/custom', config);
      return response.data;
    } catch (error) {
      console.error('[AnalyticsService] getCustomReport error:', error);
      throw api.handleError(error);
    }
  }
}

export default new AnalyticsService();
