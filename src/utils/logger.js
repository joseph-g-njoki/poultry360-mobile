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
 * - Feature-based filtering for easier testing and debugging
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
 *
 * // Feature-based logging (NEW)
 * logger.farm.info('Creating farm', farmData);
 * logger.batch.success('Batch created successfully');
 * logger.sync.warn('Sync taking longer than expected');
 *
 * // Configure what you want to see
 * logger.only(['FARM', 'BATCH']); // Only show farm and batch logs
 * logger.showConfig(); // See what's enabled
 * ```
 *
 * Future Enhancement:
 * Integrate with error tracking services by uncommenting the relevant sections.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const isDevelopment = __DEV__;

/**
 * Feature-based logging categories
 * Toggle these to control which logs appear during testing
 */
const LOG_CATEGORIES = {
  FARM: true,          // Farm operations (create, update, delete)
  BATCH: true,         // Batch/flock operations
  FEED: true,          // Feed records
  WATER: true,         // Water records
  MORTALITY: true,     // Mortality records
  WEIGHT: true,        // Weight records
  PRODUCTION: true,    // Egg production records
  HEALTH: true,        // Health/vaccination records
  SYNC: true,          // Data synchronization
  DATABASE: true,      // SQLite database operations
  API: true,           // Backend API calls
  AUTH: true,          // Authentication/login
  NETWORK: true,       // Network status
  EVENTS: true,        // DataEventBus events
  UI: true,            // UI/screen operations
  OFFLINE: true,       // Offline mode operations
};

// Load saved configuration from AsyncStorage
let loadedCategories = { ...LOG_CATEGORIES };
AsyncStorage.getItem('LOG_CATEGORIES').then(saved => {
  if (saved) {
    loadedCategories = { ...LOG_CATEGORIES, ...JSON.parse(saved) };
  }
}).catch(() => {
  // Ignore errors, use defaults
});

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

/**
 * Feature-based category loggers
 * Usage: logger.farm.info('Creating farm', data)
 */
const createCategoryLogger = (category) => {
  const isEnabled = () => {
    return isDevelopment && loadedCategories[category];
  };

  return {
    debug: (...args) => {
      if (isEnabled()) {
        console.log(`🔍 [${category}]`, ...args);
      }
    },
    info: (...args) => {
      if (isEnabled()) {
        console.log(`ℹ️ [${category}]`, ...args);
      }
    },
    warn: (...args) => {
      if (isEnabled()) {
        console.warn(`⚠️ [${category}]`, ...args);
      }
    },
    error: (...args) => {
      // Always show errors, even if category is disabled
      console.error(`❌ [${category}]`, ...args);
    },
    success: (...args) => {
      if (isEnabled()) {
        console.log(`✅ [${category}]`, ...args);
      }
    },
  };
};

// Add category-specific loggers to the main logger object
logger.farm = createCategoryLogger('FARM');
logger.batch = createCategoryLogger('BATCH');
logger.feed = createCategoryLogger('FEED');
logger.water = createCategoryLogger('WATER');
logger.mortality = createCategoryLogger('MORTALITY');
logger.weight = createCategoryLogger('WEIGHT');
logger.production = createCategoryLogger('PRODUCTION');
logger.health = createCategoryLogger('HEALTH');
logger.sync = createCategoryLogger('SYNC');
logger.database = createCategoryLogger('DATABASE');
logger.api = createCategoryLogger('API');
logger.auth = createCategoryLogger('AUTH');
logger.network = createCategoryLogger('NETWORK');
logger.events = createCategoryLogger('EVENTS');
logger.ui = createCategoryLogger('UI');
logger.offline = createCategoryLogger('OFFLINE');

/**
 * Configure which categories to show
 * @param {Object} categories - Object with category names and boolean values
 * Example: logger.configure({ FARM: true, BATCH: false })
 */
logger.configure = async (categories) => {
  loadedCategories = { ...loadedCategories, ...categories };
  try {
    await AsyncStorage.setItem('LOG_CATEGORIES', JSON.stringify(loadedCategories));
    console.log('✅ Logger configuration updated');
  } catch (error) {
    console.error('Failed to save logger config:', error);
  }
};

/**
 * Show only specific categories
 * @param {string[]} categoryNames - Array of category names to enable
 * Example: logger.only(['FARM', 'BATCH'])
 */
logger.only = async (categoryNames) => {
  const newConfig = {};
  Object.keys(LOG_CATEGORIES).forEach(key => {
    newConfig[key] = categoryNames.includes(key);
  });
  await logger.configure(newConfig);
  console.log(`✅ Only showing logs for: ${categoryNames.join(', ')}`);
};

/**
 * Enable all categories
 */
logger.enableAll = async () => {
  const newConfig = {};
  Object.keys(LOG_CATEGORIES).forEach(key => {
    newConfig[key] = true;
  });
  await logger.configure(newConfig);
  console.log('✅ All log categories enabled');
};

/**
 * Disable all categories except errors
 */
logger.disableAll = async () => {
  const newConfig = {};
  Object.keys(LOG_CATEGORIES).forEach(key => {
    newConfig[key] = false;
  });
  await logger.configure(newConfig);
  console.log('⚠️ All log categories disabled (errors still shown)');
};

/**
 * Show current configuration
 */
logger.showConfig = () => {
  console.log('════════════════════════════════════════════════');
  console.log('📊 LOGGER CONFIGURATION');
  console.log('════════════════════════════════════════════════');
  Object.entries(loadedCategories).forEach(([key, enabled]) => {
    console.log(`   ${enabled ? '✅' : '❌'} ${key}`);
  });
  console.log('════════════════════════════════════════════════');
};

// Make logger globally accessible for debugging in Metro
if (typeof global !== 'undefined') {
  global.logger = logger;
}

export default logger;