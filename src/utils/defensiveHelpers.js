/**
 * DEFENSIVE PROGRAMMING UTILITIES
 *
 * This file contains comprehensive defensive programming helpers to prevent crashes
 * from undefined data, null values, invalid operations, and database errors.
 *
 * ALL functions in this file return SAFE fallback values instead of throwing errors.
 */

// ============================================================================
// SAFE ARRAY OPERATIONS
// ============================================================================

/**
 * Safely map over an array with fallback
 * @param {any} array - Input that should be an array
 * @param {Function} fn - Mapping function
 * @param {Array} fallback - Default value if array is invalid
 * @returns {Array} Mapped array or fallback
 */
export const safeMap = (array, fn, fallback = []) => {
  if (!Array.isArray(array)) {
    console.warn('safeMap: Invalid array provided, returning fallback', { array, fallback });
    return fallback;
  }

  try {
    return array.map(fn);
  } catch (error) {
    console.error('safeMap: Error during mapping', error);
    return fallback;
  }
};

/**
 * Safely filter an array with fallback
 * @param {any} array - Input that should be an array
 * @param {Function} fn - Filter function
 * @param {Array} fallback - Default value if array is invalid
 * @returns {Array} Filtered array or fallback
 */
export const safeFilter = (array, fn, fallback = []) => {
  if (!Array.isArray(array)) {
    console.warn('safeFilter: Invalid array provided, returning fallback', { array, fallback });
    return fallback;
  }

  try {
    return array.filter(fn);
  } catch (error) {
    console.error('safeFilter: Error during filtering', error);
    return fallback;
  }
};

/**
 * Safely reduce an array with fallback
 * @param {any} array - Input that should be an array
 * @param {Function} fn - Reducer function
 * @param {any} initialValue - Initial accumulator value
 * @returns {any} Reduced value or initial value
 */
export const safeReduce = (array, fn, initialValue) => {
  if (!Array.isArray(array) || array.length === 0) {
    console.warn('safeReduce: Invalid or empty array, returning initial value', { array, initialValue });
    return initialValue;
  }

  try {
    return array.reduce(fn, initialValue);
  } catch (error) {
    console.error('safeReduce: Error during reduction', error);
    return initialValue;
  }
};

/**
 * Safely get array length
 * @param {any} array - Input that should be an array
 * @param {number} fallback - Default value if array is invalid
 * @returns {number} Array length or fallback
 */
export const safeLength = (array, fallback = 0) => {
  if (!Array.isArray(array)) {
    return fallback;
  }
  return array.length;
};

/**
 * Safely find item in array
 * @param {any} array - Input that should be an array
 * @param {Function} fn - Find function
 * @param {any} fallback - Default value if not found or array invalid
 * @returns {any} Found item or fallback
 */
export const safeFind = (array, fn, fallback = null) => {
  if (!Array.isArray(array)) {
    console.warn('safeFind: Invalid array provided, returning fallback');
    return fallback;
  }

  try {
    const result = array.find(fn);
    return result !== undefined ? result : fallback;
  } catch (error) {
    console.error('safeFind: Error during find', error);
    return fallback;
  }
};

// ============================================================================
// SAFE NUMBER OPERATIONS
// ============================================================================

/**
 * Safely convert value to number with fallback
 * @param {any} value - Value to convert
 * @param {number} fallback - Default value if conversion fails
 * @returns {number} Number or fallback
 */
export const safeNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? fallback : num;
};

/**
 * Safely convert value to integer with fallback
 * @param {any} value - Value to convert
 * @param {number} fallback - Default value if conversion fails
 * @returns {number} Integer or fallback
 */
export const safeInteger = (value, fallback = 0) => {
  const num = safeNumber(value, fallback);
  return Math.floor(num);
};

/**
 * Safely calculate percentage with fallback
 * @param {any} numerator - Numerator value
 * @param {any} denominator - Denominator value
 * @param {number} fallback - Default value if calculation fails
 * @param {number} decimals - Number of decimal places
 * @returns {number} Percentage or fallback
 */
export const safePercentage = (numerator, denominator, fallback = 0, decimals = 2) => {
  const n = safeNumber(numerator);
  const d = safeNumber(denominator);

  if (d === 0) {
    return fallback;
  }

  const percentage = (n / d) * 100;
  return safeNumber(percentage.toFixed(decimals), fallback);
};

/**
 * Safely divide two numbers with fallback
 * @param {any} numerator - Numerator value
 * @param {any} denominator - Denominator value
 * @param {number} fallback - Default value if division fails
 * @returns {number} Division result or fallback
 */
export const safeDivide = (numerator, denominator, fallback = 0) => {
  const n = safeNumber(numerator);
  const d = safeNumber(denominator);

  if (d === 0) {
    return fallback;
  }

  return n / d;
};

/**
 * Safely multiply two numbers
 * @param {any} a - First value
 * @param {any} b - Second value
 * @param {number} fallback - Default value if multiplication fails
 * @returns {number} Product or fallback
 */
export const safeMultiply = (a, b, fallback = 0) => {
  const numA = safeNumber(a, 0);
  const numB = safeNumber(b, 0);
  return numA * numB;
};

/**
 * Safely sum an array of numbers
 * @param {any} array - Array of values to sum
 * @param {number} fallback - Default value if sum fails
 * @returns {number} Sum or fallback
 */
export const safeSum = (array, fallback = 0) => {
  if (!Array.isArray(array) || array.length === 0) {
    return fallback;
  }

  return safeReduce(array, (sum, value) => sum + safeNumber(value, 0), 0);
};

/**
 * Safely calculate average of array
 * @param {any} array - Array of values
 * @param {number} fallback - Default value if calculation fails
 * @returns {number} Average or fallback
 */
export const safeAverage = (array, fallback = 0) => {
  if (!Array.isArray(array) || array.length === 0) {
    return fallback;
  }

  const sum = safeSum(array, 0);
  return safeDivide(sum, array.length, fallback);
};

/**
 * Safely get min value from array
 * @param {any} array - Array of values
 * @param {number} fallback - Default value if operation fails
 * @returns {number} Minimum value or fallback
 */
export const safeMin = (array, fallback = 0) => {
  if (!Array.isArray(array) || array.length === 0) {
    return fallback;
  }

  const numbers = safeMap(array, val => safeNumber(val, Infinity), []);
  const min = Math.min(...numbers);
  return isFinite(min) ? min : fallback;
};

/**
 * Safely get max value from array
 * @param {any} array - Array of values
 * @param {number} fallback - Default value if operation fails
 * @returns {number} Maximum value or fallback
 */
export const safeMax = (array, fallback = 0) => {
  if (!Array.isArray(array) || array.length === 0) {
    return fallback;
  }

  const numbers = safeMap(array, val => safeNumber(val, -Infinity), []);
  const max = Math.max(...numbers);
  return isFinite(max) ? max : fallback;
};

// ============================================================================
// SAFE STRING OPERATIONS
// ============================================================================

/**
 * Safely convert value to string
 * @param {any} value - Value to convert
 * @param {string} fallback - Default value if conversion fails
 * @returns {string} String or fallback
 */
export const safeString = (value, fallback = '') => {
  if (value === null || value === undefined) {
    return fallback;
  }

  try {
    return String(value);
  } catch (error) {
    console.error('safeString: Error converting to string', error);
    return fallback;
  }
};

/**
 * Safely trim a string
 * @param {any} value - Value to trim
 * @param {string} fallback - Default value if operation fails
 * @returns {string} Trimmed string or fallback
 */
export const safeTrim = (value, fallback = '') => {
  const str = safeString(value, fallback);

  try {
    return str.trim();
  } catch (error) {
    console.error('safeTrim: Error trimming string', error);
    return fallback;
  }
};

// ============================================================================
// SAFE DATE OPERATIONS
// ============================================================================

/**
 * Safely format a date
 * @param {any} dateValue - Date value to format
 * @param {string} fallback - Default value if formatting fails
 * @returns {string} Formatted date or fallback
 */
export const safeDate = (dateValue, fallback = 'N/A') => {
  if (!dateValue) {
    return fallback;
  }

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return fallback;
    }
    return date.toLocaleDateString();
  } catch (error) {
    console.error('safeDate: Error formatting date', error);
    return fallback;
  }
};

/**
 * Safely format a date and time
 * @param {any} dateValue - Date value to format
 * @param {string} fallback - Default value if formatting fails
 * @returns {string} Formatted date-time or fallback
 */
export const safeDateTime = (dateValue, fallback = 'N/A') => {
  if (!dateValue) {
    return fallback;
  }

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return fallback;
    }
    return date.toLocaleString();
  } catch (error) {
    console.error('safeDateTime: Error formatting date-time', error);
    return fallback;
  }
};

/**
 * Safely calculate days between dates
 * @param {any} startDate - Start date
 * @param {any} endDate - End date
 * @param {number} fallback - Default value if calculation fails
 * @returns {number} Days between dates or fallback
 */
export const safeDaysBetween = (startDate, endDate, fallback = 0) => {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return fallback;
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (error) {
    console.error('safeDaysBetween: Error calculating days', error);
    return fallback;
  }
};

// ============================================================================
// SAFE OBJECT OPERATIONS
// ============================================================================

/**
 * Safely access nested object property
 * @param {any} obj - Object to access
 * @param {string} path - Dot-separated path (e.g., 'user.profile.name')
 * @param {any} fallback - Default value if access fails
 * @returns {any} Property value or fallback
 */
export const safeGet = (obj, path, fallback = null) => {
  if (!obj || typeof obj !== 'object') {
    return fallback;
  }

  try {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
      if (result === null || result === undefined) {
        return fallback;
      }
      result = result[key];
    }

    return result !== undefined ? result : fallback;
  } catch (error) {
    console.error('safeGet: Error accessing object property', error);
    return fallback;
  }
};

/**
 * Safely parse JSON
 * @param {any} jsonString - JSON string to parse
 * @param {any} fallback - Default value if parsing fails
 * @returns {any} Parsed object or fallback
 */
export const safeJSONParse = (jsonString, fallback = null) => {
  if (!jsonString) {
    return fallback;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('safeJSONParse: Error parsing JSON', error);
    return fallback;
  }
};

/**
 * Safely stringify JSON
 * @param {any} obj - Object to stringify
 * @param {string} fallback - Default value if stringification fails
 * @returns {string} JSON string or fallback
 */
export const safeJSONStringify = (obj, fallback = '{}') => {
  if (obj === null || obj === undefined) {
    return fallback;
  }

  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('safeJSONStringify: Error stringifying JSON', error);
    return fallback;
  }
};

/**
 * Safely check if object has property
 * @param {any} obj - Object to check
 * @param {string} prop - Property name
 * @returns {boolean} True if property exists
 */
export const safeHasProperty = (obj, prop) => {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  try {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  } catch (error) {
    console.error('safeHasProperty: Error checking property', error);
    return false;
  }
};

// ============================================================================
// DATABASE-SPECIFIC SAFE OPERATIONS
// ============================================================================

/**
 * Check if database service is ready
 * @returns {boolean} True if database is ready
 */
export const isDatabaseReady = () => {
  try {
    const databaseService = require('../services/database').default;
    return databaseService && databaseService.isInitialized && databaseService.db;
  } catch (error) {
    console.error('isDatabaseReady: Error checking database', error);
    return false;
  }
};

/**
 * Safely execute database query with fallback
 * @param {Function} queryFn - Query function to execute
 * @param {any} fallback - Default value if query fails
 * @returns {Promise<any>} Query result or fallback
 */
export const safeDbQuery = async (queryFn, fallback = null) => {
  if (!isDatabaseReady()) {
    console.warn('safeDbQuery: Database not ready, returning fallback');
    return fallback;
  }

  try {
    const result = await queryFn();
    return result !== undefined ? result : fallback;
  } catch (error) {
    console.error('safeDbQuery: Database query error', error);
    return fallback;
  }
};

/**
 * Safely get records from database with array fallback
 * @param {Function} queryFn - Query function to execute
 * @returns {Promise<Array>} Query results or empty array
 */
export const safeDbGetRecords = async (queryFn) => {
  const result = await safeDbQuery(queryFn, []);
  return Array.isArray(result) ? result : [];
};

/**
 * Safely get single record from database
 * @param {Function} queryFn - Query function to execute
 * @returns {Promise<Object|null>} Record or null
 */
export const safeDbGetRecord = async (queryFn) => {
  const result = await safeDbQuery(queryFn, null);
  return result && typeof result === 'object' ? result : null;
};

/**
 * Safely get count from database
 * @param {Function} queryFn - Query function to execute
 * @returns {Promise<number>} Count or 0
 */
export const safeDbCount = async (queryFn) => {
  const result = await safeDbQuery(queryFn, 0);
  return safeNumber(result, 0);
};

// ============================================================================
// CALCULATION HELPERS FOR POULTRY MANAGEMENT
// ============================================================================

/**
 * Calculate production rate safely
 * @param {Array} records - Production records
 * @param {number} batchSize - Total batch size
 * @returns {Object} Production statistics
 */
export const calculateProductionRate = (records, batchSize) => {
  if (!Array.isArray(records) || records.length === 0 || !batchSize) {
    return {
      rate: 0,
      total: 0,
      average: 0,
      ratePercentage: 0
    };
  }

  const total = safeReduce(records, (sum, r) => sum + safeNumber(safeGet(r, 'eggs_collected', 0)), 0);
  const days = records.length;
  const average = safeDivide(total, days, 0);
  const ratePercentage = safePercentage(total, batchSize * days, 0);

  return {
    total: safeNumber(total),
    average: safeNumber(average),
    rate: safeNumber(average),
    ratePercentage: safeNumber(ratePercentage)
  };
};

/**
 * Calculate mortality rate safely
 * @param {Array} records - Mortality records
 * @param {number} initialCount - Initial bird count
 * @returns {Object} Mortality statistics
 */
export const calculateMortalityRate = (records, initialCount) => {
  if (!Array.isArray(records) || records.length === 0 || !initialCount) {
    return {
      total: 0,
      rate: 0,
      ratePercentage: 0
    };
  }

  const total = safeReduce(records, (sum, r) => sum + safeNumber(safeGet(r, 'count', 0)), 0);
  const ratePercentage = safePercentage(total, initialCount, 0);

  return {
    total: safeNumber(total),
    rate: safeNumber(total),
    ratePercentage: safeNumber(ratePercentage)
  };
};

/**
 * Calculate feed consumption safely
 * @param {Array} records - Feed records
 * @param {number} birdCount - Current bird count
 * @returns {Object} Feed statistics
 */
export const calculateFeedConsumption = (records, birdCount) => {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      total: 0,
      perBird: 0,
      totalCost: 0,
      costPerBird: 0
    };
  }

  const total = safeReduce(records, (sum, r) => sum + safeNumber(safeGet(r, 'quantity_kg', 0)), 0);
  const totalCost = safeReduce(records, (sum, r) => sum + safeNumber(safeGet(r, 'total_cost', 0)), 0);
  const perBird = safeDivide(total, birdCount, 0);
  const costPerBird = safeDivide(totalCost, birdCount, 0);

  return {
    total: safeNumber(total),
    perBird: safeNumber(perBird),
    totalCost: safeNumber(totalCost),
    costPerBird: safeNumber(costPerBird)
  };
};

/**
 * Calculate batch age in days safely
 * @param {string} hatchDate - Hatch date string
 * @returns {number} Age in days
 */
export const calculateBatchAge = (hatchDate) => {
  if (!hatchDate) {
    return 0;
  }

  return safeDaysBetween(hatchDate, new Date(), 0);
};

/**
 * Calculate batch age in weeks safely
 * @param {string} hatchDate - Hatch date string
 * @returns {number} Age in weeks
 */
export const calculateBatchAgeWeeks = (hatchDate) => {
  const days = calculateBatchAge(hatchDate);
  return Math.floor(days / 7);
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate email format safely
 * @param {any} email - Email to validate
 * @returns {boolean} True if valid email
 */
export const isValidEmail = (email) => {
  const emailStr = safeString(email, '');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(emailStr);
};

/**
 * Validate phone format safely
 * @param {any} phone - Phone to validate
 * @returns {boolean} True if valid phone
 */
export const isValidPhone = (phone) => {
  const phoneStr = safeString(phone, '');
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneStr.length >= 10 && phoneRegex.test(phoneStr);
};

/**
 * Validate required field
 * @param {any} value - Value to validate
 * @returns {boolean} True if field is not empty
 */
export const isRequired = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  const str = safeString(value, '').trim();
  return str.length > 0;
};

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format number with thousand separators
 * @param {any} value - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
export const formatNumber = (value, decimals = 0) => {
  const num = safeNumber(value, 0);

  try {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  } catch (error) {
    console.error('formatNumber: Error formatting', error);
    return safeString(num, '0');
  }
};

/**
 * Format currency safely
 * @param {any} value - Amount to format
 * @param {string} currency - Currency symbol
 * @returns {string} Formatted currency
 */
export const formatCurrency = (value, currency = '$') => {
  const num = safeNumber(value, 0);
  const formatted = formatNumber(num, 2);
  return `${currency}${formatted}`;
};

/**
 * Format percentage safely
 * @param {any} value - Percentage value (0-100)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (value, decimals = 1) => {
  const num = safeNumber(value, 0);
  const formatted = formatNumber(num, decimals);
  return `${formatted}%`;
};

// Export all helpers as a single object for convenience
export default {
  // Array operations
  safeMap,
  safeFilter,
  safeReduce,
  safeLength,
  safeFind,

  // Number operations
  safeNumber,
  safeInteger,
  safePercentage,
  safeDivide,
  safeMultiply,
  safeSum,
  safeAverage,
  safeMin,
  safeMax,

  // String operations
  safeString,
  safeTrim,

  // Date operations
  safeDate,
  safeDateTime,
  safeDaysBetween,

  // Object operations
  safeGet,
  safeJSONParse,
  safeJSONStringify,
  safeHasProperty,

  // Database operations
  isDatabaseReady,
  safeDbQuery,
  safeDbGetRecords,
  safeDbGetRecord,
  safeDbCount,

  // Calculation helpers
  calculateProductionRate,
  calculateMortalityRate,
  calculateFeedConsumption,
  calculateBatchAge,
  calculateBatchAgeWeeks,

  // Validation helpers
  isValidEmail,
  isValidPhone,
  isRequired,

  // Formatting helpers
  formatNumber,
  formatCurrency,
  formatPercentage
};