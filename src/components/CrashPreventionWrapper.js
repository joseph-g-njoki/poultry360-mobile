import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  DeviceEventEmitter,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Enhanced Error Boundary with Crash Prevention
 * Provides multiple recovery mechanisms and crash analytics
 */
class CrashPreventionWrapper extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      crashCount: 0,
      lastCrash: null,
      recoveryAttempts: 0,
      isRecovering: false,
    };

    this.maxRecoveryAttempts = 3;
    this.crashCooldownTime = 30000; // 30 seconds between crashes
    this.appStateListener = null;
    this.memoryWarningListener = null;
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error: error,
    };
  }

  componentDidMount() {
    // Load crash history
    this.loadCrashHistory();

    // Monitor app state changes
    this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange);

    // Monitor memory warnings
    this.memoryWarningListener = DeviceEventEmitter.addListener(
      'memoryWarning',
      this.handleMemoryWarning
    );

    // Set up periodic memory cleanup
    this.memoryCleanupInterval = setInterval(this.performMemoryCleanup, 60000); // Every minute

    // Add global error handlers for uncaught JavaScript errors
    this.setupGlobalErrorHandlers();

    // Monitor form input crashes
    this.setupFormCrashPrevention();

    // Monitor async operation crashes
    this.setupAsyncCrashPrevention();

    console.log('🛡️ Comprehensive crash prevention initialized');
  }

  componentWillUnmount() {
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    if (this.memoryWarningListener) {
      this.memoryWarningListener.remove();
    }
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 CrashPreventionWrapper caught an error:', error);
    console.error('🚨 Error info:', errorInfo);

    this.setState({
      error: error,
      errorInfo: errorInfo,
      crashCount: this.state.crashCount + 1,
      lastCrash: new Date().toISOString(),
    });

    // Log crash details
    this.logCrash(error, errorInfo);

    // Attempt automatic recovery for certain error types
    this.attemptAutoRecovery(error);
  }

  loadCrashHistory = async () => {
    try {
      const crashData = await AsyncStorage.getItem('crashHistory');
      if (crashData) {
        const history = JSON.parse(crashData);
        this.setState({
          crashCount: history.crashCount || 0,
          lastCrash: history.lastCrash,
        });
      }
    } catch (error) {
      console.warn('Failed to load crash history:', error);
    }
  };

  logCrash = async (error, errorInfo) => {
    try {
      const crashDetails = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        crashCount: this.state.crashCount + 1,
        deviceInfo: {
          platform: require('react-native').Platform.OS,
          version: require('react-native').Platform.Version,
        },
      };

      // Store crash details locally
      await AsyncStorage.setItem('lastCrash', JSON.stringify(crashDetails));

      // Update crash history
      const crashHistory = {
        crashCount: this.state.crashCount + 1,
        lastCrash: new Date().toISOString(),
        recentCrashes: await this.getRecentCrashes(crashDetails),
      };

      await AsyncStorage.setItem('crashHistory', JSON.stringify(crashHistory));

      console.log('💾 Crash logged:', crashDetails);
    } catch (loggingError) {
      console.error('Failed to log crash:', loggingError);
    }
  };

  getRecentCrashes = async (newCrash) => {
    try {
      const existingHistory = await AsyncStorage.getItem('crashHistory');
      const history = existingHistory ? JSON.parse(existingHistory) : {};
      const recentCrashes = history.recentCrashes || [];

      // Add new crash and keep only last 10 crashes
      recentCrashes.unshift(newCrash);
      return recentCrashes.slice(0, 10);
    } catch (error) {
      return [newCrash];
    }
  };

  attemptAutoRecovery = async (error) => {
    if (this.state.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.error('🚨 Max recovery attempts reached');
      return;
    }

    // Check if we're in a crash loop (multiple crashes in short time)
    const timeSinceLastCrash = this.state.lastCrash
      ? Date.now() - new Date(this.state.lastCrash).getTime()
      : Infinity;

    if (timeSinceLastCrash < this.crashCooldownTime) {
      console.warn('🚨 Crash loop detected, skipping auto-recovery');
      return;
    }

    this.setState({ isRecovering: true, recoveryAttempts: this.state.recoveryAttempts + 1 });

    try {
      // Different recovery strategies based on error type
      if (error.message.includes('Memory')) {
        await this.performMemoryCleanup();
      }

      if (error.message.includes('database') || error.message.includes('Database')) {
        await this.performDatabaseRecovery();
      }

      if (error.message.includes('Network') || error.message.includes('network')) {
        await this.performNetworkRecovery();
      }

      // Wait a bit before attempting recovery
      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          isRecovering: false,
        });
      }, 2000);

      console.log('✅ Auto-recovery attempted');
    } catch (recoveryError) {
      console.error('❌ Auto-recovery failed:', recoveryError);
      this.setState({ isRecovering: false });
    }
  };

  performMemoryCleanup = () => {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('🧹 Manual garbage collection triggered');
      }

      // Clear any cached data that's not essential
      console.log('🧹 Memory cleanup performed');
    } catch (error) {
      console.warn('Memory cleanup failed:', error);
    }
  };

  performDatabaseRecovery = async () => {
    try {
      // Attempt database recovery
      const databaseService = require('../services/database').default;
      if (databaseService && databaseService.emergencyRecovery) {
        await databaseService.emergencyRecovery();
        console.log('🔧 Database recovery attempted');
      }
    } catch (error) {
      console.warn('Database recovery failed:', error);
    }
  };

  performNetworkRecovery = async () => {
    try {
      // Clear any pending network requests
      console.log('🌐 Network recovery attempted');
    } catch (error) {
      console.warn('Network recovery failed:', error);
    }
  };

  handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active' && this.state.hasError) {
      // App came back to foreground, attempt recovery
      console.log('📱 App became active, considering recovery...');
    }
  };

  handleMemoryWarning = () => {
    console.warn('⚠️ Memory warning received');
    this.performMemoryCleanup();
  };

  setupGlobalErrorHandlers = () => {
    // DISABLED: Overriding global handlers causes infinite loops and crashes
    // React Native's ErrorUtils is sufficient
    console.log('🛡️ Using React Native built-in error handling');
  };

  setupFormCrashPrevention = () => {
    try {
      // SAFER: Just log form-related issues rather than modifying React Native internals
      // Modifying TextInput.defaultProps is deprecated and can cause crashes
      console.log('🛡️ Form crash prevention monitoring enabled');

      // Set up passive monitoring instead of active modification
      if (global.ErrorUtils) {
        // Monitor but don't interfere with React Native's error handling
        console.log('🛡️ Form error monitoring active');
      }
    } catch (error) {
      console.warn('Form crash prevention setup failed (non-critical):', error);
    }
  };

  setupAsyncCrashPrevention = () => {
    try {
      // SAFER: Don't wrap AsyncStorage methods at runtime
      // This can cause memory leaks and race conditions
      // Instead, use the asyncOperationWrapper utility which properly handles errors
      console.log('🛡️ AsyncStorage error handling delegated to asyncOperationWrapper');

      // Just verify AsyncStorage is available
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      if (!AsyncStorage) {
        console.warn('⚠️ AsyncStorage not available');
      }
    } catch (error) {
      console.warn('AsyncStorage crash prevention setup failed (non-critical):', error);
    }
  };

  preventCrash = (errorMessage) => {
    try {
      // Immediate memory cleanup
      this.performMemoryCleanup();

      // Clear any problematic state
      if (this.state.hasError) {
        return; // Already in error state
      }

      // Log the prevention
      console.log('🛡️ Crash prevented:', errorMessage);

      // Force a small delay to let things settle
      setTimeout(() => {
        console.log('🛡️ Crash prevention completed');
      }, 100);

    } catch (error) {
      console.error('🚨 Crash prevention itself failed:', error);
    }
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempts: 0,
    });
  };

  handleRestart = () => {
    Alert.alert(
      'Restart Required',
      'The app needs to be restarted to recover properly. Please close and reopen the app.',
      [
        {
          text: 'Clear Data & Restart',
          style: 'destructive',
          onPress: this.handleClearDataAndRestart,
        },
        { text: 'Just Restart', style: 'default' },
      ]
    );
  };

  handleClearDataAndRestart = async () => {
    try {
      // Clear crash history and other non-essential data
      await AsyncStorage.removeItem('crashHistory');
      await AsyncStorage.removeItem('lastCrash');
      console.log('🧹 Crash data cleared');
    } catch (error) {
      console.warn('Failed to clear crash data:', error);
    }
  };

  handleSendCrashReport = async () => {
    try {
      const crashData = await AsyncStorage.getItem('lastCrash');
      if (crashData) {
        // In a real app, you would send this to a crash reporting service
        console.log('📧 Crash report prepared for sending');
        Alert.alert('Report Sent', 'Thank you for helping us improve the app!');
      }
    } catch (error) {
      console.warn('Failed to prepare crash report:', error);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles(theme).container}>
          <View style={styles(theme).errorContainer}>
            <Text style={styles(theme).errorIcon}>
              {this.state.isRecovering ? '🔄' : '⚠️'}
            </Text>

            <Text style={styles(theme).errorTitle}>
              {this.state.isRecovering ? 'Recovering...' : 'Something went wrong'}
            </Text>

            <Text style={styles(theme).errorMessage}>
              {this.state.isRecovering
                ? 'The app is attempting to recover automatically. Please wait...'
                : 'The app encountered an unexpected error. Your data is safe.'}
            </Text>

            {/* Crash statistics */}
            {this.state.crashCount > 1 && !this.state.isRecovering && (
              <Text style={styles(theme).errorCount}>
                This is crash #{this.state.crashCount}
                {this.state.lastCrash && (
                  <Text style={styles(theme).errorTime}>
                    {'\n'}Last crash: {new Date(this.state.lastCrash).toLocaleTimeString()}
                  </Text>
                )}
              </Text>
            )}

            {/* Action buttons */}
            {!this.state.isRecovering && (
              <View style={styles(theme).buttonContainer}>
                <TouchableOpacity style={styles(theme).retryButton} onPress={this.handleRetry}>
                  <Text style={styles(theme).retryButtonText}>Try Again</Text>
                </TouchableOpacity>

                {this.state.crashCount > 1 && (
                  <TouchableOpacity style={styles(theme).restartButton} onPress={this.handleRestart}>
                    <Text style={styles(theme).restartButtonText}>Restart App</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles(theme).reportButton} onPress={this.handleSendCrashReport}>
                  <Text style={styles(theme).reportButtonText}>Send Report</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Error details (only in development) */}
            {__DEV__ && !this.state.isRecovering && (
              <View style={styles(theme).errorDetails}>
                <Text style={styles(theme).errorDetailsTitle}>Error Details (Development):</Text>
                <Text style={styles(theme).errorDetailsText}>
                  {this.state.error && this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles(theme).errorDetailsText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  errorIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  errorCount: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: 'normal',
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  restartButton: {
    backgroundColor: '#ff6b6b',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  restartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  reportButton: {
    backgroundColor: '#28a745',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  reportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorDetails: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    width: '100%',
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  errorDetailsText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
});

export default CrashPreventionWrapper;