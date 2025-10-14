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
            'https://poultry360-api.onrender.com/api', // TEMPORARY FIX: Use production API for Expo Go testing
    enableOfflineMode: true, // Re-enabled for testing
    enableNotifications: true, // Re-enabled for testing
    logLevel: 'debug',
  },
  staging: {
    apiUrl: process.env.EXPO_PUBLIC_STAGING_API_URL || 'https://staging.poultry360.com/api',
    enableOfflineMode: true,
    enableNotifications: true,
    logLevel: 'info',
  },
  prod: {
    apiUrl: process.env.EXPO_PUBLIC_PROD_API_URL || 'https://poultry360-api.onrender.com/api',
    enableOfflineMode: true,
    enableNotifications: true,
    logLevel: 'error',
  },
};

/**
 * Get the current environment configuration based on the app environment
 * Priority:
 * 1. Constants.expoConfig.extra.apiUrl (from app.json) - PRODUCTION BUILDS
 * 2. EXPO_PUBLIC_APP_ENV environment variable
 * 3. __DEV__ flag for development
 */
const getEnvVars = () => {
  // CRITICAL FIX: For production builds, use app.json extra config FIRST
  // This ensures the correct API URL is used in production APKs
  if (Constants.expoConfig?.extra?.apiUrl) {
    console.log('🔧 Using API URL from app.json:', Constants.expoConfig.extra.apiUrl);
    return {
      apiUrl: Constants.expoConfig.extra.apiUrl,
      enableOfflineMode: Constants.expoConfig.extra.enableOfflineMode ?? true,
      enableNotifications: Constants.expoConfig.extra.enableNotifications ?? true,
      logLevel: 'info',
    };
  }

  const appEnv = process.env.EXPO_PUBLIC_APP_ENV || 'dev';

  // Use __DEV__ flag as fallback
  if (__DEV__ && appEnv === 'dev') {
    return ENV.dev;
  } else if (appEnv === 'staging') {
    return ENV.staging;
  } else if (appEnv === 'prod') {
    return ENV.prod;
  }

  // CRITICAL FIX: Default to prod for production builds, not dev
  if (!__DEV__) {
    console.log('🚀 Production build detected - using prod config');
    return ENV.prod;
  }

  // Default to development
  return ENV.dev;
};

export default getEnvVars();