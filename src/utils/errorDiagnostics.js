/**
 * Error Diagnostics Utility
 * Helps identify the exact location of "true is not a function" and similar errors
 */

// Wrap all boolean state setters to catch "is not a function" errors
export const createSafeSetter = (setter, setterName) => {
  return (...args) => {
    try {
      // Validate setter is actually a function
      if (typeof setter !== 'function') {
        console.error(`❌ ${setterName} is not a function!`);
        console.error(`   Type: ${typeof setter}`);
        console.error(`   Value:`, setter);
        console.error(`   Stack trace:`, new Error().stack);
        throw new Error(`${setterName} is not a function - type is ${typeof setter}`);
      }

      // Validate arguments
      if (args.length > 0) {
        const arg = args[0];
        if (typeof arg === 'function' && (arg === true || arg === false)) {
          console.error(`❌ Attempting to call boolean ${arg} as a function in ${setterName}`);
          console.error(`   This usually means you wrote: ${setterName}(true)() instead of ${setterName}(true)`);
          console.error(`   Stack trace:`, new Error().stack);
          throw new Error(`Attempting to call boolean as function in ${setterName}`);
        }
      }

      // Call the actual setter
      return setter(...args);
    } catch (error) {
      console.error(`❌ Error in ${setterName}:`, error);
      console.error(`   Arguments:`, args);
      console.error(`   Stack:`, error.stack);
      throw error;
    }
  };
};

// Global error handler for "is not a function" errors
export const setupErrorDiagnostics = () => {
  const originalError = console.error;

  console.error = (...args) => {
    const message = String(args[0] || '');

    // Detect "is not a function" errors
    if (message.includes('is not a function')) {
      console.log('═══════════════════════════════════════════════════');
      console.log('🚨 DETECTED: "is not a function" ERROR');
      console.log('═══════════════════════════════════════════════════');
      console.log('Full error:', ...args);

      // Try to extract more details from the stack trace
      if (args.length > 1 && args[1] && typeof args[1] === 'object') {
        console.log('Error object:', args[1]);
        console.log('Stack:', args[1].stack);
      }

      // Check the call stack
      const stack = new Error().stack;
      console.log('Call stack:', stack);
      console.log('═══════════════════════════════════════════════════');
    }

    // Call original console.error
    originalError(...args);
  };
};

// Add diagnostics to common problem areas
export const wrapAuthFunctions = (authFunctions) => {
  const wrapped = {};

  for (const [key, value] of Object.entries(authFunctions)) {
    if (typeof value === 'function') {
      wrapped[key] = async (...args) => {
        try {
          console.log(`📞 Calling auth function: ${key}`);
          const result = await value(...args);
          console.log(`✅ Auth function ${key} completed successfully`);
          return result;
        } catch (error) {
          console.error(`❌ Auth function ${key} failed:`, error);
          console.error(`   Arguments:`, args);
          console.error(`   Stack:`, error.stack);
          throw error;
        }
      };
    } else {
      wrapped[key] = value;
    }
  }

  return wrapped;
};

export default {
  createSafeSetter,
  setupErrorDiagnostics,
  wrapAuthFunctions,
};
