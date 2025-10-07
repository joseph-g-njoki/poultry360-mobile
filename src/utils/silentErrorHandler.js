/**
 * Silent Error Handler Utility
 *
 * This utility handles ALL errors silently - logging them to console
 * but NEVER showing alerts, toasts, or error messages to the user.
 *
 * The app should gracefully degrade and continue working even when
 * errors occur. Users should only see loading states or empty states,
 * never error messages.
 */

// Error tracking storage for analytics (optional)
const errorLog = [];
const MAX_ERROR_LOG_SIZE = 100;

/**
 * Silent error handler - logs but doesn't show to user
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred (e.g., 'LoginScreen', 'DatabaseInit')
 * @param {object} metadata - Additional metadata about the error
 * @returns {object} Error result object with success: false
 */
export const handleError = (error, context = 'Operation', metadata = {}) => {
  // Log to console for developers (only visible in dev mode)
  console.error(`[${context}] Silent Error:`, error?.message || error);

  // Store error details for potential analytics
  const errorDetails = {
    context,
    message: error?.message || String(error),
    timestamp: new Date().toISOString(),
    metadata,
    stack: error?.stack
  };

  // Add to error log (limited size)
  errorLog.push(errorDetails);
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.shift(); // Remove oldest error
  }

  // Log to error tracking service if available
  if (global.errorTracker) {
    try {
      global.errorTracker.logError(error, context, metadata);
    } catch (trackerError) {
      console.error('[SilentErrorHandler] Error tracker failed:', trackerError);
    }
  }

  // DON'T show to user - return error object for internal handling
  return {
    success: false,
    error: error?.message || String(error),
    context,
    shouldRetry: isRetryableError(error),
    timestamp: errorDetails.timestamp
  };
};

/**
 * Check if an error is retryable (network, timeout, etc)
 * @param {Error} error - The error object
 * @returns {boolean} True if the error is retryable
 */
const isRetryableError = (error) => {
  const errorMessage = (error?.message || String(error)).toLowerCase();

  const retryablePatterns = [
    'network',
    'timeout',
    'econnrefused',
    'temporarily unavailable',
    'connection refused',
    'fetch failed',
    'request failed',
    'etimedout',
    'enotfound',
    'getaddrinfo',
    'socket hang up',
    'database is locked',
    'lock',
    'busy'
  ];

  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
};

/**
 * Silent try-catch wrapper - executes operation and returns result or fallback
 * @param {Function} operation - Async operation to execute
 * @param {any} fallback - Fallback value to return on error
 * @param {string} context - Context for error logging
 * @returns {Promise<any>} Result of operation or fallback value
 */
export const silentTryCatch = async (operation, fallback = null, context = 'SilentOperation') => {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
};

/**
 * Silent try-catch wrapper for sync operations
 * @param {Function} operation - Sync operation to execute
 * @param {any} fallback - Fallback value to return on error
 * @param {string} context - Context for error logging
 * @returns {any} Result of operation or fallback value
 */
export const silentTryCatchSync = (operation, fallback = null, context = 'SilentOperation') => {
  try {
    return operation();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
};

/**
 * Wrap an async function to always handle errors silently
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} Wrapped function that handles errors silently
 */
export const createSilentFunction = (fn, context = 'SilentFunction') => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      return { success: false, error: error?.message || String(error) };
    }
  };
};

/**
 * Get all logged errors (for debugging or analytics)
 * @returns {Array} Array of error objects
 */
export const getErrorLog = () => {
  return [...errorLog];
};

/**
 * Clear error log
 */
export const clearErrorLog = () => {
  errorLog.length = 0;
};

/**
 * Get error statistics
 * @returns {object} Error statistics object
 */
export const getErrorStats = () => {
  const stats = {
    totalErrors: errorLog.length,
    byContext: {},
    retryableErrors: 0,
    recentErrors: errorLog.slice(-10)
  };

  errorLog.forEach(error => {
    // Count by context
    if (!stats.byContext[error.context]) {
      stats.byContext[error.context] = 0;
    }
    stats.byContext[error.context]++;

    // Count retryable errors
    if (isRetryableError({ message: error.message })) {
      stats.retryableErrors++;
    }
  });

  return stats;
};

/**
 * Silent error handler for database operations
 * Always returns a safe fallback, never throws or shows errors
 * @param {Function} operation - Database operation to execute
 * @param {any} fallback - Fallback value (default: empty array)
 * @returns {Promise<any>} Result or fallback
 */
export const silentDatabaseOperation = async (operation, fallback = []) => {
  try {
    const result = await operation();
    return result !== undefined ? result : fallback;
  } catch (error) {
    console.error('[Database] Silent error:', error?.message || error);
    return fallback;
  }
};

/**
 * Silent error handler for network operations
 * Always returns a safe result, never throws or shows errors
 * @param {Function} operation - Network operation to execute
 * @param {any} fallback - Fallback value (default: { success: false })
 * @returns {Promise<any>} Result or fallback
 */
export const silentNetworkOperation = async (operation, fallback = { success: false }) => {
  try {
    const result = await operation();
    return result || fallback;
  } catch (error) {
    console.error('[Network] Silent error:', error?.message || error);
    return fallback;
  }
};

/**
 * Check if error is a specific type (for custom handling)
 * @param {Error} error - The error object
 * @param {string} type - Error type to check ('network', 'database', 'validation', etc)
 * @returns {boolean} True if error matches the type
 */
export const isErrorType = (error, type) => {
  const errorMessage = (error?.message || String(error)).toLowerCase();

  const typePatterns = {
    network: ['network', 'fetch', 'request', 'connection', 'timeout', 'econnrefused'],
    database: ['database', 'sqlite', 'sql', 'table', 'query', 'transaction'],
    validation: ['validation', 'invalid', 'required', 'missing', 'must be'],
    authentication: ['auth', 'token', 'unauthorized', 'forbidden', 'credential'],
    permission: ['permission', 'denied', 'access denied', 'not allowed']
  };

  const patterns = typePatterns[type.toLowerCase()] || [];
  return patterns.some(pattern => errorMessage.includes(pattern));
};

/**
 * Wrap a component method to handle errors silently
 * Useful for event handlers in React components
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} Wrapped function
 */
export const silentComponentMethod = (fn, context = 'ComponentMethod') => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      // Don't re-throw, just return undefined
      return undefined;
    }
  };
};

// Export default object with all functions
const silentErrorHandler = {
  handleError,
  silentTryCatch,
  silentTryCatchSync,
  createSilentFunction,
  getErrorLog,
  clearErrorLog,
  getErrorStats,
  silentDatabaseOperation,
  silentNetworkOperation,
  isErrorType,
  isRetryableError,
  silentComponentMethod
};

export default silentErrorHandler;