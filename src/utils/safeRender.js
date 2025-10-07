/**
 * Safe Render Utilities
 *
 * This module provides defensive rendering functions to prevent
 * React Native crashes when objects are accidentally passed as Text children.
 *
 * PROBLEM: React Native throws "Objects are not valid as a React child" error
 * when an object is rendered inside <Text> component.
 *
 * SOLUTION: Always convert values to strings before rendering, with proper
 * fallbacks for undefined, null, and object values.
 */

/**
 * Safely renders any value as a string
 * Prevents "Objects are not valid as a React child" errors
 *
 * @param {*} value - Any value that needs to be rendered
 * @param {string} fallback - Fallback string if value is null/undefined
 * @returns {string} - Safe string value that can be rendered
 */
export const safeRender = (value, fallback = '') => {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return fallback;
  }

  // Handle objects (including arrays)
  if (typeof value === 'object') {
    console.warn('⚠️  safeRender: Object passed as render value:', value);

    // For arrays, join them
    if (Array.isArray(value)) {
      return value.map(item => safeRender(item, '')).join(', ');
    }

    // For objects, return a descriptive string or JSON
    // Check if it's a Date object
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }

    // For other objects, stringify them for debugging
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error('safeRender: Failed to stringify object:', error);
      return '[Object]';
    }
  }

  // Handle boolean values
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Convert everything else to string
  return String(value);
};

/**
 * Safely renders a user field from user object
 * Common user fields: firstName, lastName, email, phone, role
 *
 * @param {Object} user - User object
 * @param {string} field - Field name to extract
 * @param {string} fallback - Fallback if field is missing
 * @returns {string} - Safe string value
 */
export const safeUserField = (user, field, fallback = 'N/A') => {
  if (!user || typeof user !== 'object') {
    console.warn('⚠️  safeUserField: Invalid user object');
    return fallback;
  }

  const value = user[field];
  return safeRender(value, fallback);
};

/**
 * Safely renders a translation key result
 * Ensures t() function always returns strings
 *
 * @param {Function} t - Translation function
 * @param {string} key - Translation key
 * @param {string} fallback - Fallback if translation returns object
 * @returns {string} - Safe string value
 */
export const safeTranslation = (t, key, fallback = '') => {
  if (typeof t !== 'function') {
    console.warn('⚠️  safeTranslation: Invalid translation function');
    return fallback || key;
  }

  const result = t(key);

  // If translation returns an object (BUG!), handle it
  if (typeof result === 'object' && result !== null) {
    console.error('🐛 Translation function returned object for key:', key, result);

    // Try to extract English translation if available
    if (result.en) {
      return String(result.en);
    }

    // Fallback to key name
    return fallback || key;
  }

  return safeRender(result, fallback || key);
};

/**
 * Safely renders notification preference value
 * Handles both boolean and object notification preferences
 *
 * @param {*} preference - Notification preference value
 * @returns {string} - Human-readable status
 */
export const safeNotificationPreference = (preference) => {
  if (typeof preference === 'boolean') {
    return preference ? 'Enabled' : 'Disabled';
  }

  if (typeof preference === 'object' && preference !== null) {
    console.warn('⚠️  safeNotificationPreference: Object passed:', preference);

    // If it's an object with enabled property
    if ('enabled' in preference) {
      return preference.enabled ? 'Enabled' : 'Disabled';
    }

    // Fallback
    return JSON.stringify(preference);
  }

  return String(preference);
};

/**
 * Safely renders a date value
 *
 * @param {string|Date} date - Date value
 * @param {string} format - Format type: 'short', 'long', 'relative'
 * @returns {string} - Formatted date string
 */
export const safeDate = (date, format = 'short') => {
  if (!date) {
    return 'N/A';
  }

  try {
    const dateObj = date instanceof Date ? date : new Date(date);

    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    switch (format) {
      case 'short':
        return dateObj.toLocaleDateString();

      case 'long':
        return dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

      case 'relative':
        return getRelativeTime(dateObj);

      default:
        return dateObj.toLocaleDateString();
    }
  } catch (error) {
    console.error('safeDate error:', error);
    return 'Invalid Date';
  }
};

/**
 * Get relative time string (e.g., "2 hours ago")
 *
 * @param {Date} date - Date object
 * @returns {string} - Relative time string
 */
const getRelativeTime = (date) => {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * Safely renders a number with optional formatting
 *
 * @param {*} value - Number value
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted number string
 */
export const safeNumber = (value, options = {}) => {
  const {
    decimals = 0,
    prefix = '',
    suffix = '',
    fallback = '0'
  } = options;

  if (value === null || value === undefined) {
    return fallback;
  }

  const num = Number(value);

  if (isNaN(num)) {
    console.warn('⚠️  safeNumber: Invalid number:', value);
    return fallback;
  }

  const formatted = num.toFixed(decimals);
  return `${prefix}${formatted}${suffix}`;
};

/**
 * Validates if a value is safe to render directly in Text
 *
 * @param {*} value - Value to check
 * @returns {boolean} - True if safe to render
 */
export const isSafeToRender = (value) => {
  // null and undefined are safe (render as empty)
  if (value === null || value === undefined) {
    return true;
  }

  // Primitives are safe
  if (typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean') {
    return true;
  }

  // Objects are NOT safe
  return false;
};

/**
 * Creates a safe render wrapper for component props
 * Useful for wrapping entire prop objects
 *
 * @param {Object} props - Component props
 * @param {Array} textFields - Array of field names that will be rendered as text
 * @returns {Object} - Safe props object
 */
export const safePropWrapper = (props, textFields = []) => {
  const safeProps = { ...props };

  textFields.forEach(field => {
    if (field in safeProps) {
      safeProps[field] = safeRender(safeProps[field]);
    }
  });

  return safeProps;
};

/**
 * Debug helper: Logs all object properties that are not safe to render
 *
 * @param {Object} obj - Object to check
 * @param {string} objName - Name of object for logging
 */
export const debugRenderSafety = (obj, objName = 'object') => {
  if (!obj || typeof obj !== 'object') {
    console.log(`✅ ${objName} is safe to render (not an object)`);
    return;
  }

  const unsafeFields = [];

  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (typeof value === 'object' && value !== null) {
      unsafeFields.push({ key, type: Array.isArray(value) ? 'array' : 'object', value });
    }
  });

  if (unsafeFields.length === 0) {
    console.log(`✅ ${objName} - All fields are safe to render`);
  } else {
    console.warn(`⚠️  ${objName} - Found ${unsafeFields.length} unsafe fields:`);
    unsafeFields.forEach(({ key, type, value }) => {
      console.warn(`   - ${key} (${type}):`, value);
    });
  }
};

export default {
  safeRender,
  safeUserField,
  safeTranslation,
  safeNotificationPreference,
  safeDate,
  safeNumber,
  isSafeToRender,
  safePropWrapper,
  debugRenderSafety
};