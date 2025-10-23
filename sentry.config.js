/**
 * Sentry Configuration for Poultry360 Mobile App
 *
 * To complete setup:
 * 1. Sign up at https://sentry.io (free tier: 5,000 events/month)
 * 2. Create a new React Native project in Sentry
 * 3. Copy your DSN (Data Source Name)
 * 4. Add it to .env file as: SENTRY_DSN=your-dsn-here
 * 5. Uncomment the Sentry.init() call in App.js
 */

import * as Sentry from '@sentry/react-native';

export const initSentry = () => {
  // Get DSN from environment variable
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!sentryDsn) {
    console.warn('⚠️  Sentry DSN not configured. Error tracking disabled.');
    console.warn('   Add EXPO_PUBLIC_SENTRY_DSN to your .env file to enable Sentry');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,

    // Set to true in development, false in production
    debug: __DEV__,

    // Environment tag (helps filter errors by environment)
    environment: __DEV__ ? 'development' : 'production',

    // Enable performance monitoring
    enableAutoPerformanceTracing: true,
    tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring

    // Enable session tracking
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000, // 30 seconds

    // Enable native crash reporting (Android/iOS)
    enableNative: true,
    enableNativeCrashHandling: true,

    // Attach stack traces to all messages
    attachStacktrace: true,

    // Maximum breadcrumbs (user actions before error)
    maxBreadcrumbs: 50,

    // Set user context automatically
    beforeSend(event, hint) {
      // Don't send events in development (optional - comment out to test in dev)
      if (__DEV__) {
        console.log('📧 Sentry event (not sent in dev):', event);
        return null; // Prevents sending in development
      }
      return event;
    },

    // Configure integrations
    integrations: [
      new Sentry.ReactNativeTracing({
        // Tracing
        tracingOrigins: ['localhost', 'your-api-domain.com', /^\//],
        routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
      }),
    ],
  });

  console.log('✅ Sentry initialized successfully');
};

// Helper function to manually capture exceptions
export const captureException = (error, context = {}) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

// Helper function to capture messages
export const captureMessage = (message, level = 'info') => {
  Sentry.captureMessage(message, level);
};

// Helper function to set user context
export const setUser = (user) => {
  Sentry.setUser({
    id: user?.id,
    email: user?.email,
    username: user?.username || user?.email,
    organizationId: user?.organizationId || user?.organization_id,
  });
};

// Helper function to add breadcrumb (user action tracking)
export const addBreadcrumb = (message, category, level = 'info', data = {}) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
};

export default Sentry;
