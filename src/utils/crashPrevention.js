import crashLogger from './crashLogger';
import memoryLeakDetector from './memoryLeakDetector';

/**
 * Additional crash prevention utilities
 * Handles edge cases and common crash scenarios
 */
class CrashPrevention {
  constructor() {
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    // DISABLED: Global handlers cause more crashes than they prevent
    // React Native has its own error handling that works better

    // Only set up web-specific handlers if actually on web
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      try {
        window.addEventListener('error', (event) => {
          console.log('[CrashPrevention] Window error:', event.error?.message);
        });

        window.addEventListener('unhandledrejection', (event) => {
          console.log('[CrashPrevention] Unhandled rejection:', event.reason);
        });
      } catch (e) {
        // Silent fail - don't crash while setting up crash prevention
      }
    }

    // For React Native, let ErrorUtils handle it (already set up in App.js)
  }

  /**
   * Safe wrapper for async functions
   * Automatically logs errors and prevents crashes
   */
  wrapAsync(fn, errorContext = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        await crashLogger.logError('Async Function Error', error, {
          ...errorContext,
          functionName: fn.name,
          args: args.length,
        });
        // Return null instead of throwing to prevent crash
        return null;
      }
    };
  }

  /**
   * Safe wrapper for sync functions
   */
  wrapSync(fn, errorContext = {}) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        crashLogger.logError('Sync Function Error', error, {
          ...errorContext,
          functionName: fn.name,
          args: args.length,
        });
        return null;
      }
    };
  }

  /**
   * Safe JSON parse
   * Returns null instead of throwing on invalid JSON
   */
  safeJsonParse(jsonString, defaultValue = null) {
    try {
      if (!jsonString || typeof jsonString !== 'string') {
        return defaultValue;
      }
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('JSON parse error:', error.message);
      crashLogger.logError('JSON Parse Error', error, {
        jsonLength: jsonString?.length,
      });
      return defaultValue;
    }
  }

  /**
   * Safe JSON stringify
   */
  safeJsonStringify(obj, defaultValue = '{}') {
    try {
      if (obj === null || obj === undefined) {
        return defaultValue;
      }
      return JSON.stringify(obj);
    } catch (error) {
      console.warn('JSON stringify error:', error.message);
      crashLogger.logError('JSON Stringify Error', error, {
        objectType: typeof obj,
      });
      return defaultValue;
    }
  }

  /**
   * Safe array access
   * Returns defaultValue if index is out of bounds
   */
  safeArrayAccess(array, index, defaultValue = null) {
    try {
      if (!Array.isArray(array)) {
        return defaultValue;
      }
      if (index < 0 || index >= array.length) {
        return defaultValue;
      }
      return array[index];
    } catch (error) {
      console.warn('Array access error:', error.message);
      return defaultValue;
    }
  }

  /**
   * Safe object property access
   * Returns defaultValue if property doesn't exist
   */
  safeGet(obj, path, defaultValue = null) {
    try {
      if (!obj || typeof obj !== 'object') {
        return defaultValue;
      }

      const keys = path.split('.');
      let result = obj;

      for (const key of keys) {
        if (result === null || result === undefined) {
          return defaultValue;
        }
        result = result[key];
      }

      return result !== undefined ? result : defaultValue;
    } catch (error) {
      console.warn('Safe get error:', error.message);
      return defaultValue;
    }
  }

  /**
   * Safe setState wrapper for React components
   * Prevents "Can't perform a React state update on an unmounted component" errors
   */
  safeSetState(component, state, isMountedRef) {
    if (isMountedRef && isMountedRef.current) {
      component(state);
    } else {
      console.warn('Attempted to set state on unmounted component');
    }
  }

  /**
   * Debounce function calls
   * Prevents rapid successive calls that might cause issues
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
   * Throttle function calls
   * Limits execution frequency
   */
  throttle(func, limit = 1000) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Retry function with exponential backoff
   */
  async retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    await crashLogger.logError('Retry Failed After Max Attempts', lastError, {
      maxRetries,
      initialDelay,
    });

    throw lastError;
  }

  /**
   * Timeout wrapper for promises
   */
  withTimeout(promise, timeoutMs = 30000) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Safe async/await wrapper
   * Returns [error, result] tuple
   */
  async to(promise) {
    try {
      const result = await promise;
      return [null, result];
    } catch (error) {
      await crashLogger.logError('Promise Error', error);
      return [error, null];
    }
  }

  /**
   * Check if object is empty
   */
  isEmpty(obj) {
    if (obj === null || obj === undefined) return true;
    if (typeof obj === 'string') return obj.trim().length === 0;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  }

  /**
   * Deep clone object safely
   */
  deepClone(obj) {
    try {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      console.warn('Deep clone error:', error.message);
      crashLogger.logError('Deep Clone Error', error);
      return null;
    }
  }

  /**
   * Check if value is valid number
   */
  isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  /**
   * Safe number conversion
   */
  toNumber(value, defaultValue = 0) {
    try {
      const num = Number(value);
      return this.isValidNumber(num) ? num : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * Check memory pressure and log warning
   */
  async checkMemoryPressure() {
    try {
      const report = memoryLeakDetector.getReport();

      if (report.activeComponents > 50) {
        await crashLogger.logError('High Component Count', new Error('Too many active components'), {
          count: report.activeComponents,
          components: report.componentsList.slice(0, 10), // First 10
        });
      }

      if (report.activeTimers > 100) {
        await crashLogger.logError('High Timer Count', new Error('Too many active timers'), {
          count: report.activeTimers,
        });
      }

      if (report.activeListeners > 100) {
        await crashLogger.logError('High Listener Count', new Error('Too many active listeners'), {
          count: report.activeListeners,
        });
      }

      return report;
    } catch (error) {
      console.warn('Memory check error:', error);
      return null;
    }
  }

  /**
   * Generate crash report for support
   */
  async generateCrashReport() {
    try {
      const logs = await crashLogger.exportLogs();
      const stats = await crashLogger.getStatistics();
      const memoryReport = memoryLeakDetector.getReport();

      return {
        timestamp: new Date().toISOString(),
        statistics: stats,
        memoryReport,
        recentCrashes: logs.logs.crashes.slice(-10),
        recentErrors: logs.logs.errors.slice(-20),
      };
    } catch (error) {
      console.error('Failed to generate crash report:', error);
      return null;
    }
  }
}

// Export singleton instance
const crashPrevention = new CrashPrevention();

export default crashPrevention;
