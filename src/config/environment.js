import Constants from 'expo-constants';

/**
 * Environment Configuration for Poultry360 Mobile App
 *
 * This configuration file manages API URLs and feature flags across different environments.
 * It prioritizes environment variables from .env files over hardcoded defaults.
 *
 * Setup Instructions:
 * 1. Copy .env.example to .env
 * 2. Update EXPO_PUBLIC_API_URL with your local development server IP
 * 3. Never commit the .env file (it's in .gitignore)
 */

const ENV = {
  dev: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ||
            Constants.expoConfig?.extra?.apiUrl ||
            'http://192.168.50.50:3006/api', // CRASH FIX: Updated to correct IP address
    enableOfflineMode: false, // CRASH FIX: Disable offline mode to prevent database crashes
    enableNotifications: false, // CRASH FIX: Disable notifications to prevent crashes
    logLevel: 'debug',
  },
  staging: {
    apiUrl: process.env.EXPO_PUBLIC_STAGING_API_URL || 'https://staging.poultry360.com/api',
    enableOfflineMode: true,
    enableNotifications: true,
    logLevel: 'info',
  },
  prod: {
    apiUrl: process.env.EXPO_PUBLIC_PROD_API_URL || 'https://api.poultry360.com/api',
    enableOfflineMode: true,
    enableNotifications: true,
    logLevel: 'error',
  },
};

/**
 * Get the current environment configuration based on the app environment
 * Priority: EXPO_PUBLIC_APP_ENV > __DEV__ flag
 */
const getEnvVars = () => {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV || 'dev';

  // Use __DEV__ flag as fallback
  if (__DEV__ && appEnv === 'dev') {
    return ENV.dev;
  } else if (appEnv === 'staging') {
    return ENV.staging;
  } else if (appEnv === 'prod') {
    return ENV.prod;
  }

  // Default to development
  return ENV.dev;
};

export default getEnvVars();