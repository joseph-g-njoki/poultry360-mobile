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

    // CRASH FIX PLATFORM-001: Android-specific error handling
    if (Platform.OS === 'android') {
      const errorMessage = error?.message || String(error);

      // Handle Android permission errors gracefully
      if (errorMessage.includes('Permission denied') || errorMessage.includes('PERMISSION_DENIED')) {
        console.error('🔒 CRASH FIX PLATFORM-001: Android permission error detected');
        console.error('   Error:', errorMessage);
        // Don't crash - just log and continue
        return;
      }

      // Handle Android SQLite errors
      if (errorMessage.includes('SQLite') || errorMessage.includes('database')) {
        console.error('💾 CRASH FIX PLATFORM-001: Android SQLite error detected');
        console.error('   Error:', errorMessage);
        // Don't crash - app will fall back to online mode
        return;
      }

      // Handle Android native module errors
      if (errorMessage.includes('Native module') || errorMessage.includes('NativeModule')) {
        console.error('📱 CRASH FIX PLATFORM-001: Android native module error detected');
        console.error('   Error:', errorMessage);
        // Don't crash - log and continue
        return;
      }
    }

    // CRASH FIX APP-002: Protect Alert.alert with try-catch
    try {
      Alert.alert(
        '❌ App Error',
        `Error: ${error?.message || String(error)}\n\nPlease screenshot this and send to developer`,
        [{ text: 'OK' }]
      );
    } catch (alertError) {
      console.error('❌ CRASH FIX APP-002: Alert failed in error handler:', alertError);
      // CRASH PREVENTION: Fallback to console-only error logging
      console.error('   Original error (Alert unavailable):', error);
    }

    if (isFatal) {
      console.error('🚨 FATAL ERROR - App may crash:', error);
    }
  };

  // Handle unhandled promise rejections
  const handleUnhandledRejection = (reason, promise) => {
    console.error('🚨🚨🚨 UNHANDLED PROMISE REJECTION 🚨🚨🚨');
    console.error('Reason:', reason);
    console.error('Stack:', reason?.stack);

    // CRASH FIX APP-002: Protect Alert.alert with try-catch
    try {
      Alert.alert(
        '❌ Promise Error',
        `Error: ${reason?.message || String(reason)}\n\nPlease screenshot this`,
        [{ text: 'OK' }]
      );
    } catch (alertError) {
      console.error('❌ CRASH FIX APP-002: Alert failed in rejection handler:', alertError);
      // CRASH PREVENTION: Fallback to console-only error logging
      console.error('   Original rejection (Alert unavailable):', reason);
    }
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

    // CRASH FIX APP-002: Protect Alert.alert with try-catch
    try {
      Alert.alert(
        '❌ App Error',
        `Error: ${error?.message || String(error)}\n\nPlease screenshot this`,
        [{ text: 'OK' }]
      );
    } catch (alertError) {
      console.error('❌ CRASH FIX APP-002: Alert failed in production handler:', alertError);
      // CRASH PREVENTION: Fallback to console-only error logging
      console.error('   Original error (Alert unavailable):', error);
    }
  };

  const handleProductionRejection = (reason) => {
    console.error('🚨🚨🚨 PRODUCTION UNHANDLED REJECTION 🚨🚨🚨');
    console.error('Reason:', reason);
    console.error('Stack:', reason?.stack);

    // CRASH FIX APP-002: Protect Alert.alert with try-catch
    try {
      Alert.alert(
        '❌ Promise Error',
        `Error: ${reason?.message || String(reason)}\n\nPlease screenshot this`,
        [{ text: 'OK' }]
      );
    } catch (alertError) {
      console.error('❌ CRASH FIX APP-002: Alert failed in production rejection handler:', alertError);
      // CRASH PREVENTION: Fallback to console-only error logging
      console.error('   Original rejection (Alert unavailable):', reason);
    }
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
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { DashboardRefreshProvider } from './src/context/DashboardRefreshContext';
import { DataStoreProvider } from './src/context/DataStoreContext';

// Import main navigation
import AppNavigator from './src/navigation/AppNavigator';

// Import fast services for instant initialization
import fastApiService from './src/services/fastApiService';
import fastDatabase from './src/services/fastDatabase';
import iosOptimizations from './src/services/iosOptimizations';
import memoryManager from './src/utils/memoryManager';
import unifiedApiService from './src/services/unifiedApiService';
import DatabaseInitializationError from './src/components/DatabaseInitializationError';
import autoSyncService from './src/services/autoSyncService';
// CRASH FIX: databaseMigration.js removed - fastDatabase.js handles all migrations internally
// import databaseMigration from './src/services/databaseMigration';

// Loading screen component with theme support
const LoadingScreen = () => {
  const { theme, isDarkMode } = useTheme();
  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.loadingBackground }]}>
        <View style={styles.loadingContent}>
          <Text style={styles.appTitle}>Poultry360</Text>
          <ActivityIndicator size="large" color={theme.colors.loadingText} style={styles.spinner} />
          <Text style={[styles.loadingText, { color: theme.colors.loadingText }]}>Starting...</Text>
        </View>
      </View>
    </>
  );
};

// Main app navigation with theme-aware StatusBar
const AppContent = () => {
  const { isDarkMode } = useTheme();
  return (
    <>
      <AppNavigator />
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Toast />
    </>
  );
};

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

        // CRASH FIX: RE-ENABLE DATABASE with proper error handling and fallback
        // Initialize database in background with comprehensive error recovery
        console.log('🚀 CRASH FIX: Starting database initialization with error recovery...');

        setImmediate(async () => {
          try {
            console.log('📦 Background: Initializing database...');

            // CRITICAL FIX: Verify fastDatabase was initialized by fastApiService.init()
            if (!fastApiService.isReady) {
              console.error('❌ CRITICAL: fastApiService not ready, database may be null');
              console.log('🔄 Attempting manual fastApiService initialization...');

              const retryInit = await fastApiService.init();
              if (!retryInit) {
                throw new Error('fastApiService initialization failed completely');
              }
            }

            // Double-check database connection is valid
            const dbCheck = fastDatabase.db;
            const dbReady = fastDatabase.isReady;

            console.log(`📊 Database status check:`);
            console.log(`   - fastDatabase.db: ${dbCheck ? 'VALID' : 'NULL'}`);
            console.log(`   - fastDatabase.isReady: ${dbReady}`);

            if (!dbCheck || !dbReady) {
              console.error('❌ CRITICAL: Database connection is null after init');
              throw new Error('Database connection failed - null database');
            }

            console.log('✅ Background: Database verified and ready');

            // CRASH FIX: Database migrations are handled internally by fastDatabase.js during init()
            // No need to call separate migration service - fastDatabase already migrated the schema
            console.log('✅ Background: Database migrations complete (handled by fastDatabase)');

            // Initialize auto-sync service
            autoSyncService.init();
            console.log('✅ Background: Auto-sync service initialized');

            // Mark online-only mode as false (database is working)
            if (isMounted) {
              setOnlineOnlyMode(false);
            }

          } catch (error) {
            console.error('❌ CRITICAL: Database initialization failed completely');
            console.error('   Error:', error?.message);
            console.error('   Stack:', error?.stack);

            // CRASH PREVENTION: Fall back to online-only mode
            console.warn('⚠️ FALLBACK: Continuing in online-only mode (database disabled)');
            if (isMounted) {
              setOnlineOnlyMode(true);
              setDatabaseError(error);
            }
          }
        });

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
      // Cleanup auto-sync service
      autoSyncService.cleanup();
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

  // Simple loading screen with theme support
  if (!isAppReady) {
    return (
      <ThemeProvider>
        <LoadingScreen />
      </ThemeProvider>
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
              <DataStoreProvider>
                <DashboardRefreshProvider>
                  <AuthProvider>
                    <AppContent />
                  </AuthProvider>
                </DashboardRefreshProvider>
              </DataStoreProvider>
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
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  detailText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorContainer: {
    marginTop: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 320,
    width: '100%',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorSubtext: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});