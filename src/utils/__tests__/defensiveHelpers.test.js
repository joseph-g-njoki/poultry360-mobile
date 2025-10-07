import {
  safeMap,
  safeFilter,
  safeFind,
  safeReduce,
  safeLength,
  safeGet,
  safeString,
  safeNumber,
  safeInteger,
  safePercentage,
  safeDivide,
  safeMultiply,
  safeSum,
  safeAverage,
  safeMin,
  safeMax,
  safeDate,
  safeDateTime,
  safeDaysBetween,
  safeTrim,
  safeJSONParse,
  safeJSONStringify,
  safeHasProperty,
  formatNumber,
  formatCurrency,
  formatPercentage,
  isValidEmail,
  isValidPhone,
  isRequired,
  calculateBatchAge,
  calculateBatchAgeWeeks
} from '../defensiveHelpers';

describe('Defensive Helpers', () => {
  // Suppress console warnings for these tests
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeAll(() => {
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    console.warn = originalWarn;
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Safe Array Operations', () => {
    describe('safeMap', () => {
      it('should map valid array', () => {
        const result = safeMap([1, 2, 3], x => x * 2);
        expect(result).toEqual([2, 4, 6]);
      });

      it('should return fallback for null', () => {
        const result = safeMap(null, x => x * 2, []);
        expect(result).toEqual([]);
      });

      it('should return fallback for undefined', () => {
        const result = safeMap(undefined, x => x * 2, []);
        expect(result).toEqual([]);
      });

      it('should return fallback for non-array', () => {
        const result = safeMap('not an array', x => x, []);
        expect(result).toEqual([]);
      });

      it('should handle mapping errors', () => {
        const result = safeMap([1, 2, 3], () => {
          throw new Error('Map error');
        }, []);
        expect(result).toEqual([]);
      });

      it('should use custom fallback', () => {
        const customFallback = ['custom'];
        const result = safeMap(null, x => x, customFallback);
        expect(result).toBe(customFallback);
      });
    });

    describe('safeFilter', () => {
      it('should filter valid array', () => {
        const result = safeFilter([1, 2, 3, 4], x => x > 2);
        expect(result).toEqual([3, 4]);
      });

      it('should return fallback for invalid input', () => {
        const result = safeFilter(null, x => x > 2, []);
        expect(result).toEqual([]);
      });

      it('should handle filter errors', () => {
        const result = safeFilter([1, 2, 3], () => {
          throw new Error('Filter error');
        }, []);
        expect(result).toEqual([]);
      });
    });

    describe('safeFind', () => {
      it('should find element in valid array', () => {
        const result = safeFind([1, 2, 3], x => x === 2);
        expect(result).toBe(2);
      });

      it('should return fallback when element not found', () => {
        const result = safeFind([1, 2, 3], x => x === 5, null);
        expect(result).toBeNull();
      });

      it('should return fallback for invalid input', () => {
        const result = safeFind(null, x => x === 2, null);
        expect(result).toBeNull();
      });
    });

    describe('safeLength', () => {
      it('should return length of valid array', () => {
        const result = safeLength([1, 2, 3]);
        expect(result).toBe(3);
      });

      it('should return 0 for null', () => {
        const result = safeLength(null);
        expect(result).toBe(0);
      });

      it('should return 0 for undefined', () => {
        const result = safeLength(undefined);
        expect(result).toBe(0);
      });

      it('should return 0 for non-array', () => {
        const result = safeLength('not array');
        expect(result).toBe(0);
      });
    });
  });

  describe('Safe Object Operations', () => {
    describe('safeGet', () => {
      it('should get nested property with dot notation', () => {
        const obj = {
          user: {
            profile: {
              name: 'John'
            }
          }
        };
        expect(safeGet(obj, 'user.profile.name')).toBe('John');
      });

      it('should return fallback for missing nested property', () => {
        const obj = { user: {} };
        expect(safeGet(obj, 'user.profile.name', 'default')).toBe('default');
      });

      it('should return fallback for null in path', () => {
        const obj = { user: null };
        expect(safeGet(obj, 'user.profile.name', 'default')).toBe('default');
      });

      it('should return fallback for null object', () => {
        expect(safeGet(null, 'name', 'default')).toBe('default');
      });

      it('should return fallback for undefined object', () => {
        expect(safeGet(undefined, 'name', 'default')).toBe('default');
      });
    });

    describe('safeHasProperty', () => {
      it('should check if property exists', () => {
        const obj = { name: 'Test', age: 25 };
        expect(safeHasProperty(obj, 'name')).toBe(true);
        expect(safeHasProperty(obj, 'missing')).toBe(false);
      });

      it('should return false for null object', () => {
        expect(safeHasProperty(null, 'name')).toBe(false);
      });

      it('should return false for undefined object', () => {
        expect(safeHasProperty(undefined, 'name')).toBe(false);
      });
    });
  });

  describe('Safe Type Conversions', () => {
    describe('safeString', () => {
      it('should convert to string', () => {
        expect(safeString('hello')).toBe('hello');
        expect(safeString(123)).toBe('123');
        expect(safeString(true)).toBe('true');
      });

      it('should return fallback for null', () => {
        expect(safeString(null, '')).toBe('');
      });

      it('should return fallback for undefined', () => {
        expect(safeString(undefined, 'default')).toBe('default');
      });
    });

    describe('safeNumber', () => {
      it('should convert to number', () => {
        expect(safeNumber(123)).toBe(123);
        expect(safeNumber('456')).toBe(456);
        expect(safeNumber('123.45')).toBe(123.45);
      });

      it('should return fallback for NaN', () => {
        expect(safeNumber('not a number', 0)).toBe(0);
      });

      it('should return fallback for null', () => {
        expect(safeNumber(null, 0)).toBe(0);
      });

      it('should return fallback for undefined', () => {
        expect(safeNumber(undefined, 0)).toBe(0);
      });
    });

    describe('safeInteger', () => {
      it('should convert to integer', () => {
        expect(safeInteger(123)).toBe(123);
        expect(safeInteger('456')).toBe(456);
        expect(safeInteger(123.89)).toBe(123);
      });

      it('should return fallback for NaN', () => {
        expect(safeInteger('not a number', 0)).toBe(0);
      });

      it('should return fallback for null', () => {
        expect(safeInteger(null, 0)).toBe(0);
      });
    });

    describe('safePercentage', () => {
      it('should calculate percentage', () => {
        expect(safePercentage(50, 100)).toBe(50);
        expect(safePercentage(1, 4)).toBe(25);
      });

      it('should return fallback for zero denominator', () => {
        expect(safePercentage(50, 0, 0)).toBe(0);
      });

      it('should handle decimal places', () => {
        const result = safePercentage(1, 3, 0, 2);
        expect(result).toBeCloseTo(33.33, 2);
      });
    });

    describe('safeDivide', () => {
      it('should divide numbers', () => {
        expect(safeDivide(10, 2)).toBe(5);
        expect(safeDivide(15, 3)).toBe(5);
      });

      it('should return fallback for zero denominator', () => {
        expect(safeDivide(10, 0, 0)).toBe(0);
      });
    });

    describe('safeSum', () => {
      it('should sum array of numbers', () => {
        expect(safeSum([1, 2, 3, 4])).toBe(10);
      });

      it('should return fallback for empty array', () => {
        expect(safeSum([], 0)).toBe(0);
      });

      it('should handle invalid values in array', () => {
        expect(safeSum([1, 'invalid', 3])).toBe(4);
      });
    });

    describe('safeAverage', () => {
      it('should calculate average', () => {
        expect(safeAverage([1, 2, 3, 4])).toBe(2.5);
      });

      it('should return fallback for empty array', () => {
        expect(safeAverage([], 0)).toBe(0);
      });
    });
  });

  describe('Safe String Operations', () => {
    describe('safeTrim', () => {
      it('should trim valid string', () => {
        expect(safeTrim('  hello  ')).toBe('hello');
      });

      it('should return fallback for null', () => {
        expect(safeTrim(null, '')).toBe('');
      });

      it('should convert and trim non-string input', () => {
        expect(safeTrim(123)).toBe('123');
      });
    });
  });

  describe('Safe Parsing Operations', () => {
    describe('safeJSONParse', () => {
      it('should parse valid JSON', () => {
        const result = safeJSONParse('{"key":"value"}');
        expect(result).toEqual({ key: 'value' });
      });

      it('should return fallback for invalid JSON', () => {
        const fallback = {};
        const result = safeJSONParse('invalid json', fallback);
        expect(result).toBe(fallback);
      });

      it('should return fallback for null', () => {
        expect(safeJSONParse(null, {})).toEqual({});
      });
    });

    describe('safeJSONStringify', () => {
      it('should stringify valid object', () => {
        const result = safeJSONStringify({ key: 'value' });
        expect(result).toBe('{"key":"value"}');
      });

      it('should return fallback for circular reference', () => {
        const obj = {};
        obj.self = obj;
        const result = safeJSONStringify(obj, '{}');
        expect(result).toBe('{}');
      });

      it('should return fallback for null', () => {
        expect(safeJSONStringify(null, '{}')).toBe('{}');
      });
    });
  });

  describe('Safe Date Operations', () => {
    describe('safeDate', () => {
      it('should format valid date', () => {
        const result = safeDate('2025-01-01');
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });

      it('should return fallback for invalid date', () => {
        const result = safeDate('invalid date', 'N/A');
        expect(result).toBe('N/A');
      });

      it('should return fallback for null', () => {
        const result = safeDate(null, 'N/A');
        expect(result).toBe('N/A');
      });
    });

    describe('safeDateTime', () => {
      it('should format valid date-time', () => {
        const result = safeDateTime('2025-01-01T12:00:00');
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });

      it('should return fallback for invalid date', () => {
        const result = safeDateTime('invalid', 'N/A');
        expect(result).toBe('N/A');
      });
    });

    describe('safeDaysBetween', () => {
      it('should calculate days between dates', () => {
        const result = safeDaysBetween('2025-01-01', '2025-01-10');
        expect(result).toBe(9);
      });

      it('should return fallback for invalid dates', () => {
        const result = safeDaysBetween('invalid', '2025-01-10', 0);
        expect(result).toBe(0);
      });
    });
  });

  describe('Formatting Helpers', () => {
    describe('formatNumber', () => {
      it('should format number with thousand separators', () => {
        const result = formatNumber(1000);
        expect(result).toContain('1');
        expect(result).toContain('000');
      });

      it('should handle decimal places', () => {
        const result = formatNumber(1234.56, 2);
        expect(result).toContain('1');
        expect(result).toContain('234');
      });
    });

    describe('formatCurrency', () => {
      it('should format currency with symbol', () => {
        const result = formatCurrency(100);
        expect(result).toContain('$');
        expect(result).toContain('100');
      });

      it('should handle custom currency symbol', () => {
        const result = formatCurrency(100, 'UGX');
        expect(result).toContain('UGX');
      });
    });

    describe('formatPercentage', () => {
      it('should format percentage', () => {
        const result = formatPercentage(75);
        expect(result).toContain('75');
        expect(result).toContain('%');
      });
    });
  });

  describe('Validation Helpers', () => {
    describe('isValidEmail', () => {
      it('should validate correct email', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      });

      it('should reject invalid email', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('test@')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
      });
    });

    describe('isValidPhone', () => {
      it('should validate phone number', () => {
        expect(isValidPhone('+256700000000')).toBe(true);
        expect(isValidPhone('0700000000')).toBe(true);
      });

      it('should reject invalid phone', () => {
        expect(isValidPhone('123')).toBe(false);
        expect(isValidPhone('abc')).toBe(false);
      });
    });

    describe('isRequired', () => {
      it('should validate required field', () => {
        expect(isRequired('value')).toBe(true);
        expect(isRequired('  text  ')).toBe(true);
      });

      it('should reject empty values', () => {
        expect(isRequired('')).toBe(false);
        expect(isRequired('   ')).toBe(false);
        expect(isRequired(null)).toBe(false);
        expect(isRequired(undefined)).toBe(false);
      });
    });
  });

  describe('Batch Calculation Helpers', () => {
    describe('calculateBatchAge', () => {
      it('should calculate batch age in days', () => {
        const hatchDate = new Date();
        hatchDate.setDate(hatchDate.getDate() - 10);
        const result = calculateBatchAge(hatchDate.toISOString());
        expect(result).toBeGreaterThanOrEqual(9);
        expect(result).toBeLessThanOrEqual(11);
      });

      it('should return 0 for invalid date', () => {
        expect(calculateBatchAge(null)).toBe(0);
        expect(calculateBatchAge('invalid')).toBe(0);
      });
    });

    describe('calculateBatchAgeWeeks', () => {
      it('should calculate batch age in weeks', () => {
        const hatchDate = new Date();
        hatchDate.setDate(hatchDate.getDate() - 14);
        const result = calculateBatchAgeWeeks(hatchDate.toISOString());
        expect(result).toBe(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', () => {
      expect(safeMap([], x => x)).toEqual([]);
      expect(safeFilter([], x => x)).toEqual([]);
      expect(safeLength([])).toBe(0);
    });

    it('should handle empty objects', () => {
      expect(safeGet({}, 'key', 'fallback')).toBe('fallback');
    });

    it('should handle empty strings', () => {
      expect(safeTrim('')).toBe('');
      expect(safeString('')).toBe('');
    });

    it('should handle zero values', () => {
      expect(safeNumber(0)).toBe(0);
      expect(safeInteger(0)).toBe(0);
    });

    it('should handle null and undefined gracefully', () => {
      expect(safeNumber(null)).toBe(0);
      expect(safeNumber(undefined)).toBe(0);
      expect(safeString(null)).toBe('');
      expect(safeString(undefined)).toBe('');
      expect(safeLength(null)).toBe(0);
      expect(safeLength(undefined)).toBe(0);
    });
  });
});