/**
 * Logger Utility for Poultry360 Mobile App
 *
 * This utility provides environment-aware logging for the mobile application.
 * It suppresses debug logs in production while always showing warnings and errors.
 *
 * Features:
 * - Automatically suppresses debug logs in production builds
 * - Always shows warnings and errors for debugging
 * - Ready for integration with error tracking services (Sentry, Crashlytics, etc.)
 * - Maintains console.log compatibility
 *
 * Usage:
 * ```javascript
 * import logger from './utils/logger';
 *
 * // Development only - won't show in production
 * logger.log('User data loaded', userData);
 * logger.info('Navigation to Dashboard');
 * logger.debug('API response:', response);
 *
 * // Always shows (even in production)
 * logger.warn('Slow network detected');
 * logger.error('Failed to load data', error);
 * ```
 *
 * Future Enhancement:
 * Integrate with error tracking services by uncommenting the relevant sections.
 */

const isDevelopment = __DEV__;

/**
 * Logger object with different log levels
 */
const logger = {
  /**
   * Standard log - only in development
   * Use for general debugging information
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Info level - only in development
   * Use for informational messages about app flow
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Debug level - only in development
   * Use for detailed debugging information
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Warning level - always shown
   * Use for potentially harmful situations
   */
  warn: (...args) => {
    console.warn(...args);
    // TODO: Send warnings to analytics service
    // Example: Analytics.logEvent('warning', { message: args[0] });
  },

  /**
   * Error level - always shown
   * Use for error conditions that need attention
   */
  error: (...args) => {
    console.error(...args);

    // TODO: Send errors to error tracking service
    // Example with Sentry:
    // if (!isDevelopment) {
    //   Sentry.captureException(args[0]);
    // }

    // Example with Firebase Crashlytics:
    // if (!isDevelopment) {
    //   crashlytics().recordError(args[0]);
    // }
  },

  /**
   * Performance logging - only in development
   * Use for measuring operation durations
   */
  time: (label) => {
    if (isDevelopment) {
      console.time(label);
    }
  },

  /**
   * End performance logging - only in development
   */
  timeEnd: (label) => {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  },

  /**
   * Table logging - only in development
   * Use for displaying tabular data
   */
  table: (data) => {
    if (isDevelopment && console.table) {
      console.table(data);
    }
  },

  /**
   * Group logging - only in development
   * Use for grouping related log messages
   */
  group: (label) => {
    if (isDevelopment && console.group) {
      console.group(label);
    }
  },

  /**
   * End group logging - only in development
   */
  groupEnd: () => {
    if (isDevelopment && console.groupEnd) {
      console.groupEnd();
    }
  },
};

/**
 * API logging helper - logs API requests and responses
 */
export const logApiRequest = (method, url, data = null) => {
  if (isDevelopment) {
    console.group(`[API] ${method} ${url}`);
    console.log('Request:', data);
    console.groupEnd();
  }
};

export const logApiResponse = (method, url, status, data = null, duration = null) => {
  if (isDevelopment) {
    console.group(`[API] ${method} ${url} - ${status}`);
    if (duration) {
      console.log(`Duration: ${duration}ms`);
    }
    console.log('Response:', data);
    console.groupEnd();
  }
};

export const logApiError = (method, url, error) => {
  console.error(`[API Error] ${method} ${url}`, error);
  // TODO: Send to error tracking service in production
};

/**
 * Navigation logging helper
 */
export const logNavigation = (screen, params = null) => {
  if (isDevelopment) {
    console.log(`[Navigation] → ${screen}`, params || '');
  }
};

/**
 * State logging helper
 */
export const logState = (component, state) => {
  if (isDevelopment) {
    console.log(`[State] ${component}`, state);
  }
};

/**
 * Database logging helper
 */
export const logDatabase = (operation, table, data = null) => {
  if (isDevelopment) {
    console.log(`[DB] ${operation} - ${table}`, data || '');
  }
};

/**
 * Performance measurement helper
 */
export const measurePerformance = (label, fn) => {
  if (isDevelopment) {
    const start = Date.now();
    const result = fn();
    const duration = Date.now() - start;
    console.log(`[Performance] ${label}: ${duration}ms`);
    return result;
  }
  return fn();
};

export default logger;