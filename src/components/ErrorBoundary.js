import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import memoryManager from '../utils/memoryManager';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      isRecovering: false,
      screenName: props.screenName || 'Unknown Screen'
    };
    // CRASH FIX: Track mounted state to prevent setState on unmounted component
    this._isMounted = false;
    this._recoveryTimer = null;
  }

  componentDidMount() {
    this._isMounted = true;
  }

  componentWillUnmount() {
    // CRASH FIX: Clear any pending timers and mark as unmounted
    this._isMounted = false;
    if (this._recoveryTimer) {
      clearTimeout(this._recoveryTimer);
      this._recoveryTimer = null;
    }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error: error
    };
  }

  componentDidCatch(error, errorInfo) {
    // SHOW ALL ERRORS TO USER - NO SILENT FAILURES
    console.error('🚨🚨🚨 ERROR BOUNDARY CAUGHT ERROR 🚨🚨🚨');
    console.error('Screen:', this.state.screenName);
    console.error('Error:', error);
    console.error('Stack:', error?.stack);
    console.error('Component Stack:', errorInfo?.componentStack);

    // Show alert to user immediately
    Alert.alert(
      `❌ Error in ${this.state.screenName}`,
      `${error?.message || String(error)}\n\nStack: ${error?.stack?.substring(0, 200)}...\n\nPlease screenshot this!`,
      [
        {
          text: 'Retry',
          onPress: () => this.handleRetry()
        },
        {
          text: 'OK'
        }
      ]
    );

    // Update state with error details
    if (this._isMounted) {
      this.setState({
        error: error,
        errorInfo: errorInfo,
        errorCount: this.state.errorCount + 1
      });
    }

    // Log error to analytics or crash reporting service
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    try {
      // In a real app, you would send this to a crash reporting service
      // like Crashlytics, Sentry, or Bugsnag

      // CRASH FIX: Safely extract error message and stack
      let errorMessage = 'Unknown error';
      let errorStack = '';

      if (error && typeof error === 'object') {
        errorMessage = typeof error.message === 'string' ? error.message : String(error.message || error);
        errorStack = typeof error.stack === 'string' ? error.stack : '';
      } else if (error != null) {
        errorMessage = String(error);
      }

      const errorDetails = {
        screenName: this.state.screenName,
        message: errorMessage,
        stack: errorStack,
        componentStack: errorInfo?.componentStack || '',
        timestamp: new Date().toISOString(),
        errorCount: this.state.errorCount + 1,
        props: Object.keys(this.props || {})
      };

      console.log('Error logged for screen:', errorDetails);

      // You could also store this in AsyncStorage for later upload
      // when the user has internet connectivity
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  };

  attemptAutoRecovery = async (error) => {
    // Don't attempt recovery if already recovering or too many errors
    if (this.state.isRecovering || this.state.errorCount > 2) {
      return;
    }

    // CRASH FIX: Check if component is mounted before setState
    if (!this._isMounted) return;

    this.setState({ isRecovering: true });

    try {
      console.log(`🔄 Attempting auto-recovery for ${this.state.screenName}...`);

      // Perform memory cleanup
      await memoryManager.performCleanup(`error_recovery_${this.state.screenName}`);

      // CRASH FIX: Check for specific error types with safe string handling
      const errorMsg = (error && typeof error.message === 'string') ? error.message : '';
      if (errorMsg.toLowerCase().includes('memory')) {
        await memoryManager.forceCleanup();
      }

      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // CRASH FIX: Reset error state immediately after cleanup (only if still mounted)
      if (this._isMounted) {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          isRecovering: false,
        });
        console.log(`✅ Auto-recovery completed for ${this.state.screenName}`);
      }

    } catch (recoveryError) {
      console.error(`❌ Auto-recovery failed for ${this.state.screenName}:`, recoveryError);
      // CRASH FIX: Even if recovery fails, reset the recovering state (only if still mounted)
      if (this._isMounted) {
        this.setState({
          isRecovering: false,
          // Keep hasError true if recovery failed
        });
      }
    }
  };

  handleRetry = () => {
    // Reset the error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleRestart = () => {
    // SILENT FIX: Log restart request but don't show alert
    console.log('[ErrorBoundary] Restart requested - app may need to be restarted');
    // User can manually restart the app if needed
    // Don't force or alert them about it
  };

  render() {
    if (this.state.hasError) {
      // Error UI
      return (
        <View style={styles(theme).container}>
          <ScrollView style={styles(theme).scrollView} contentContainerStyle={styles(theme).scrollContent}>
            <View style={styles(theme).errorContainer}>
              {this.state.isRecovering ? (
                <>
                  <ActivityIndicator size="large" color="#007AFF" style={styles(theme).loadingIcon} />
                  <Text style={styles(theme).errorTitle}>Recovering...</Text>
                  <Text style={styles(theme).errorMessage}>
                    Attempting to recover {this.state.screenName}. Please wait...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles(theme).errorIcon}>⚠️</Text>
                  <Text style={styles(theme).errorTitle}>Error in {this.state.screenName}</Text>
                  <Text style={styles(theme).errorMessage}>
                    Something went wrong in {this.state.screenName}. Don't worry, your data is safe.
                  </Text>
                </>
              )}

              {/* Error count indicator */}
              {this.state.errorCount > 1 && (
                <Text style={styles(theme).errorCount}>
                  This error has occurred {this.state.errorCount} times
                </Text>
              )}

              {/* Action buttons - only show when not recovering */}
              {!this.state.isRecovering && (
                <View style={styles(theme).buttonContainer}>
                  <TouchableOpacity style={styles(theme).retryButton} onPress={this.handleRetry}>
                    <Text style={styles(theme).retryButtonText}>Try Again</Text>
                  </TouchableOpacity>

                  {this.state.errorCount > 2 && (
                    <TouchableOpacity style={styles(theme).restartButton} onPress={this.handleRestart}>
                      <Text style={styles(theme).restartButtonText}>Restart App</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Error details (only in development) */}
              {__DEV__ && (
                <View style={styles(theme).errorDetails}>
                  <Text style={styles(theme).errorDetailsTitle}>Error Details (Development Only):</Text>
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
          </ScrollView>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  loadingIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  errorCount: {
    fontSize: 14,
    color: '#ff6b6b',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  restartButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  restartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
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

export default ErrorBoundary;