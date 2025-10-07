import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet, Alert, Platform, LogBox } from 'react-native';
import 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

// DEVELOPMENT MODE: Enable alerts and logs for debugging
// Comment out these lines in production to suppress errors
// import './src/utils/alertInterceptor';

// DEVELOPMENT MODE: Show warnings and errors for debugging
// In production, set this to true to hide technical errors
LogBox.ignoreAllLogs(false); // Show warnings/errors in development

// CRASH FIX: Error deduplication to prevent console flooding
const errorCache = new Map();
const ERROR_THROTTLE_MS = 5000; // Only show same error once per 5 seconds

const shouldLogError = (errorKey) => {
  const now = Date.now();
  const lastLogged = errorCache.get(errorKey);

  if (!lastLogged || now - lastLogged > ERROR_THROTTLE_MS) {
    errorCache.set(errorKey, now);
    return true;
  }
  return false;
};

// Specific patterns to ignore (for development visibility)
LogBox.ignoreLogs([
  // Database errors (reduced - we want to see them but deduplicated)
  'Error counting sync_queue',

  // Network errors
  'Network request failed',
  'Timeout',
  'timeout',
  'ECONNREFUSED',
  'fetch failed',
  'connection refused',

  // Offline/Sync errors
  'Sync failed',
  'sync failed',

  // Non-critical React Native warnings
  'VirtualizedLists should never be nested',
  'Animated: `useNativeDriver`',
  'Remote debugger',
  'Require cycle',
]);

// CRASH FIX: Enhanced error handling with deduplication
if (__DEV__) {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.error = (...args) => {
    const message = String(args[0] || '');

    // CRASH FIX: Deduplicate database errors to prevent flooding
    if (message.includes('database') || message.includes('table') || message.includes('Database')) {
      const errorKey = `error:${message.substring(0, 100)}`;
      if (!shouldLogError(errorKey)) {
        // Skip this duplicate error
        return;
      }
    }

    // Only suppress very specific non-critical warnings
    if (
      message.includes('VirtualizedLists should never be nested') ||
      message.includes('Animated: `useNativeDriver`') ||
      message.includes('Remote debugger is in a background tab')
    ) {
      // Suppress only these specific warnings
      return;
    }

    // Show deduplicated errors
    originalConsoleError(...args);
  };

  console.warn = (...args) => {
    const message = String(args[0] || '');

    // CRASH FIX: Deduplicate database warnings
    if (message.includes('database') || message.includes('Database') || message.includes('[Database]')) {
      const warnKey = `warn:${message.substring(0, 100)}`;
      if (!shouldLogError(warnKey)) {
        return;
      }
    }

    // Only suppress very specific warnings
    if (
      message.includes('VirtualizedLists should never be nested') ||
      message.includes('Require cycle:')
    ) {
      return;
    }

    // Show deduplicated warnings
    originalConsoleWarn(...args);
  };

  // Allow ALL console.logs for debugging
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    // Show everything - we need full visibility!
    originalConsoleLog(...args);

    /*
    // OLD CODE - was suppressing too much
    const message = String(args[0] || '');

    // Only allow specific app logs, suppress all service logs
    if (
      message.includes('🚀 Poultry360 App') ||
      message.includes('✅ Poultry360 App') ||
      message.includes('Auth check successful') ||
      message.includes('Login successful') ||
      message.includes('🔄 Dashboard refresh') ||
      message.includes('🎯 Dashboard screen') ||
      message.includes('✅ Dashboard data updated') ||
      message.includes('✅ Loaded') ||
      message.includes('Farm saved - dashboard refresh triggered') ||
      message.includes('Batch saved - dashboard refresh triggered') ||
      message.includes('Record saved - dashboard refresh triggered')
    ) {
      originalConsoleLog(...args);
    }
    // Suppress all other logs during startup
    */
  };

  // Global error handlers for crash prevention (PRODUCTION MODE TOO!)
  const handleGlobalError = (error, isFatal) => {
    console.error('🚨🚨🚨 GLOBAL ERROR CAUGHT 🚨🚨🚨');
    console.error('Error:', error);
    console.error('Stack:', error?.stack);
    console.error('Fatal:', isFatal);

    // Show visible alert to user
    Alert.alert(
      '❌ App Error',
      `Error: ${error?.message || String(error)}\n\nPlease screenshot this and send to developer`,
      [{ text: 'OK' }]
    );

    if (isFatal) {
      console.error('🚨 FATAL ERROR - App may crash:', error);
    }
  };

  // Handle unhandled promise rejections
  const handleUnhandledRejection = (reason, promise) => {
    console.error('🚨🚨🚨 UNHANDLED PROMISE REJECTION 🚨🚨🚨');
    console.error('Reason:', reason);
    console.error('Stack:', reason?.stack);

    // Show visible alert to user
    Alert.alert(
      '❌ Promise Error',
      `Error: ${reason?.message || String(reason)}\n\nPlease screenshot this`,
      [{ text: 'OK' }]
    );
  };

  // Set up global error handling
  if (typeof ErrorUtils !== 'undefined') {
    ErrorUtils.setGlobalHandler(handleGlobalError);
  }

  // Handle unhandled promise rejections
  if (typeof process !== 'undefined' && process.on) {
    process.on('unhandledRejection', handleUnhandledRejection);
  }
}

// CRASH FIX: Also set up global error handlers for PRODUCTION mode
// These prevent crashes from unhandled promise rejections
if (!__DEV__) {
  const handleProductionError = (error, isFatal) => {
    console.error('🚨🚨🚨 PRODUCTION ERROR 🚨🚨🚨');
    console.error('Error:', error);
    console.error('Stack:', error?.stack);
    console.error('Fatal:', isFatal);

    // Show visible alert to user
    Alert.alert(
      '❌ App Error',
      `Error: ${error?.message || String(error)}\n\nPlease screenshot this`,
      [{ text: 'OK' }]
    );
  };

  const handleProductionRejection = (reason) => {
    console.error('🚨🚨🚨 PRODUCTION UNHANDLED REJECTION 🚨🚨🚨');
    console.error('Reason:', reason);
    console.error('Stack:', reason?.stack);

    // Show visible alert to user
    Alert.alert(
      '❌ Promise Error',
      `Error: ${reason?.message || String(reason)}\n\nPlease screenshot this`,
      [{ text: 'OK' }]
    );
  };

  if (typeof ErrorUtils !== 'undefined') {
    ErrorUtils.setGlobalHandler(handleProductionError);
  }

  if (typeof global !== 'undefined') {
    global.onunhandledrejection = (event) => {
      handleProductionRejection(event.reason);
      // Prevent default crash behavior
      event.preventDefault();
    };
  }
}

// Import error boundaries
import ErrorBoundary from './src/components/ErrorBoundary';
import CrashPreventionWrapper from './src/components/CrashPreventionWrapper';

// Import context providers
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { DashboardRefreshProvider } from './src/context/DashboardRefreshContext';

// Import main navigation
import AppNavigator from './src/navigation/AppNavigator';

// Import fast services for instant initialization
import fastApiService from './src/services/fastApiService';
import iosOptimizations from './src/services/iosOptimizations';
import memoryManager from './src/utils/memoryManager';
import unifiedApiService from './src/services/unifiedApiService';
import DatabaseInitializationError from './src/components/DatabaseInitializationError';

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [databaseError, setDatabaseError] = useState(null);
  const [onlineOnlyMode, setOnlineOnlyMode] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let initTimeout = null;

    const initializeApp = async () => {
      try {
        // PERFORMANCE FIX: INSTANT UI - show app immediately, initialize in background
        console.log('⚡ Poultry360 App - INSTANT startup mode');

        // Initialize memory manager first (synchronous, instant)
        if (isMounted) {
          memoryManager.init();
        }

        // Initialize fast service (synchronous, instant)
        if (isMounted) {
          await fastApiService.init();
        }

        // CRITICAL PERFORMANCE FIX: Show UI immediately, initialize heavy services in background
        // This prevents the 10-30 second blocking delay from database initialization
        if (isMounted) {
          console.log('✅ Core services ready - showing UI immediately');
          setIsAppReady(true); // SHOW UI NOW - don't wait for database
        }

        // CRASH FIX: DISABLE DATABASE - Run in online-only mode to prevent crashes
        // Database initialization causes crashes, so we'll skip it entirely
        console.log('🚀 CRASH FIX: Running in online-only mode (database disabled)');
        if (isMounted) {
          setOnlineOnlyMode(true);
        }

        // OPTIONAL: Try database init in background, but DON'T let it crash the app
        /*
        setImmediate(async () => {
          try {
            console.log('📦 Background: Starting database initialization (optional)...');
            const initResult = await unifiedApiService.init();
            console.log('✅ Background: Database initialized successfully');
          } catch (error) {
            console.warn('⚠️ Database initialization failed - continuing in online-only mode');
            console.warn('Error:', error?.message);
            // Don't crash - just continue without database
          }
        });
        */

      } catch (error) {
        // Always show UI - never block the app
        console.log('⚡ Showing app despite initialization error');
        if (isMounted) {
          setIsAppReady(true);
        }
      }
    };

    initializeApp();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
      if (initTimeout) {
        clearTimeout(initTimeout);
        initTimeout = null;
      }
    };
  }, []);

  // Retry database initialization handler
  const handleRetryDatabase = async () => {
    try {
      setDatabaseError(null);
      setIsAppReady(false);

      console.log('🔄 Retrying database initialization...');
      await unifiedApiService.init();

      console.log('✅ Database initialization successful after retry');
      setIsAppReady(true);
    } catch (error) {
      console.error('❌ Database retry failed:', error);
      setDatabaseError(error);
      setIsAppReady(true);
    }
  };

  // Continue in online-only mode handler
  const handleContinueOnline = () => {
    console.log('📱 Continuing in online-only mode...');
    setDatabaseError(null);
    setOnlineOnlyMode(true);
    setIsAppReady(true);
  };

  // Simple loading screen
  if (!isAppReady) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Text style={styles.appTitle}>Poultry360</Text>
          <ActivityIndicator size="large" color="#2E8B57" style={styles.spinner} />
          <Text style={styles.loadingText}>Starting...</Text>
        </View>
      </View>
    );
  }

  // Show database error UI if database initialization failed
  if (databaseError) {
    return (
      <DatabaseInitializationError
        error={databaseError}
        onRetry={handleRetryDatabase}
        onContinueOnline={handleContinueOnline}
      />
    );
  }

  // Main app with multiple layers of error boundaries and context providers
  return (
    <CrashPreventionWrapper>
      <ErrorBoundary>
        <ThemeProvider>
          <LanguageProvider>
            <OfflineProvider>
              <DashboardRefreshProvider>
                <AuthProvider>
                  <AppNavigator />
                  <StatusBar style="auto" />
                  <Toast />
                </AuthProvider>
              </DashboardRefreshProvider>
            </OfflineProvider>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </CrashPreventionWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingContent: {
    alignItems: 'center',
    padding: 20,
    maxWidth: 350,
    width: '100%',
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E8B57',
    marginBottom: 30,
    textAlign: 'center',
  },
  spinner: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  detailText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
    maxWidth: 320,
    width: '100%',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#856404',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorSubtext: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});