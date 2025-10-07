import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Comprehensive crash and error logging utility
 */
class CrashLogger {
  constructor() {
    this.maxLogs = 100;
    this.crashLogKey = 'crash_logs';
    this.errorLogKey = 'error_logs';
    this.setupGlobalErrorHandlers();
  }

  setupGlobalErrorHandlers() {
    // DISABLED: These global handlers cause crashes and infinite loops
    // Let React Native's built-in error handling work

    // Use ErrorUtils for React Native instead
    if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
      const originalHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();

      ErrorUtils.setGlobalHandler((error, isFatal) => {
        // Log but don't interfere
        try {
          console.log('[CrashLogger] Error detected:', error?.message);
        } catch (e) {
          // Silent fail
        }

        // Call original handler
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }
  }

  static getInstance() {
    if (!CrashLogger.instance) {
      CrashLogger.instance = new CrashLogger();
    }
    return CrashLogger.instance;
  }

  async logCrash(crashType, error, additionalData = {}) {
    try {
      const crashLog = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: crashType,
        error: error?.toString() || 'Unknown error',
        stack: error?.stack || 'No stack trace',
        message: error?.message || '',
        additionalData,
        deviceInfo: await this.getDeviceInfo(),
      };

      const existingLogs = await this.getLogs(this.crashLogKey);
      existingLogs.push(crashLog);

      // Keep only last N logs
      if (existingLogs.length > this.maxLogs) {
        existingLogs.splice(0, existingLogs.length - this.maxLogs);
      }

      await AsyncStorage.setItem(this.crashLogKey, JSON.stringify(existingLogs));

      // Also log to console for debugging
      console.error('[CRASH LOG]', crashType, error);

      return crashLog;
    } catch (loggingError) {
      console.error('Failed to log crash:', loggingError);
      return null;
    }
  }

  async logError(errorType, error, additionalData = {}) {
    try {
      const errorLog = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: errorType,
        error: error?.toString() || 'Unknown error',
        stack: error?.stack || 'No stack trace',
        message: error?.message || '',
        additionalData,
      };

      const existingLogs = await this.getLogs(this.errorLogKey);
      existingLogs.push(errorLog);

      if (existingLogs.length > this.maxLogs) {
        existingLogs.splice(0, existingLogs.length - this.maxLogs);
      }

      await AsyncStorage.setItem(this.errorLogKey, JSON.stringify(existingLogs));

      console.warn('[ERROR LOG]', errorType, error);

      return errorLog;
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
      return null;
    }
  }

  async getLogs(logKey) {
    try {
      const logs = await AsyncStorage.getItem(logKey);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  async getCrashLogs() {
    return this.getLogs(this.crashLogKey);
  }

  async getErrorLogs() {
    return this.getLogs(this.errorLogKey);
  }

  async getAllLogs() {
    const crashLogs = await this.getCrashLogs();
    const errorLogs = await this.getErrorLogs();
    return {
      crashes: crashLogs,
      errors: errorLogs,
      total: crashLogs.length + errorLogs.length,
    };
  }

  async clearLogs() {
    try {
      await AsyncStorage.removeItem(this.crashLogKey);
      await AsyncStorage.removeItem(this.errorLogKey);
      console.log('All logs cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear logs:', error);
      return false;
    }
  }

  async getDeviceInfo() {
    try {
      // Basic device info without requiring additional packages
      return {
        platform: global.Platform?.OS || 'unknown',
        version: global.Platform?.Version || 'unknown',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return { error: 'Failed to get device info' };
    }
  }

  // Helper to wrap async functions with error logging
  wrapAsync(fn, errorType = 'Async Error') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        await this.logError(errorType, error, { args });
        throw error;
      }
    };
  }

  // Helper to wrap functions with error logging
  wrapSync(fn, errorType = 'Sync Error') {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.logError(errorType, error, { args });
        throw error;
      }
    };
  }

  // Log network errors
  async logNetworkError(url, method, error, response = null) {
    return this.logError('Network Error', error, {
      url,
      method,
      status: response?.status,
      statusText: response?.statusText,
    });
  }

  // Log database errors
  async logDatabaseError(operation, error, tableName = null) {
    return this.logError('Database Error', error, {
      operation,
      tableName,
    });
  }

  // Log authentication errors
  async logAuthError(operation, error) {
    return this.logError('Auth Error', error, {
      operation,
    });
  }

  // Get statistics
  async getStatistics() {
    const crashLogs = await this.getCrashLogs();
    const errorLogs = await this.getErrorLogs();

    const errorTypes = {};
    [...crashLogs, ...errorLogs].forEach((log) => {
      errorTypes[log.type] = (errorTypes[log.type] || 0) + 1;
    });

    return {
      totalCrashes: crashLogs.length,
      totalErrors: errorLogs.length,
      errorTypes,
      lastCrash: crashLogs[crashLogs.length - 1] || null,
      lastError: errorLogs[errorLogs.length - 1] || null,
    };
  }

  // Export logs for debugging
  async exportLogs() {
    const allLogs = await this.getAllLogs();
    const stats = await this.getStatistics();

    return {
      exportDate: new Date().toISOString(),
      statistics: stats,
      logs: allLogs,
    };
  }
}

export default CrashLogger.getInstance();
