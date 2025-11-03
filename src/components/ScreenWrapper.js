import React, { Component, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, BackHandler, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ErrorBoundary from './ErrorBoundary';
import OfflineIndicator from './OfflineIndicator';
import { useTheme } from '../context/ThemeContext';
import memoryManager from '../utils/memoryManager';

/**
 * Enhanced ScreenWrapper with crash prevention
 */
class EnhancedScreenWrapper extends Component {
  constructor(props) {
    super(props);
    this.state = {
      screenName: props.screenName || 'Screen',
    };
    this.cleanup = null;
    this.backHandler = null;
    this.appStateListener = null;
  }

  componentDidMount() {
    // Register cleanup with memory manager
    this.cleanup = memoryManager.registerCleanupCallback(
      this.performScreenCleanup,
      `${this.state.screenName}_wrapper`
    );

    // Handle back button for Android
    this.backHandler = BackHandler.addEventListener('hardwareBackPress', this.handleBackPress);

    // Monitor app state changes
    this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange);

    console.log(`🛡️ Enhanced screen wrapper initialized for ${this.state.screenName}`);
  }

  componentWillUnmount() {
    try {
      if (this.backHandler) {
        this.backHandler.remove();
      }
      if (this.appStateListener) {
        this.appStateListener.remove();
      }
      if (this.cleanup) {
        this.cleanup();
      }
    } catch (error) {
      console.warn('Error during enhanced screen wrapper cleanup:', error);
    }
  }

  performScreenCleanup = async () => {
    try {
      console.log(`🧹 Performing cleanup for ${this.state.screenName}`);
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.warn(`Cleanup failed for ${this.state.screenName}:`, error);
    }
  };

  handleBackPress = () => {
    if (this.props.onBackPress && typeof this.props.onBackPress === 'function') {
      return this.props.onBackPress();
    }
    return false;
  };

  handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      console.log(`📱 App became active for ${this.state.screenName}`);
    }
  };

  render() {
    const { children, showOfflineIndicator = true, style, containerStyle, theme } = this.props;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme?.colors?.background || '#f8f9fa' }]}>
        <StatusBar backgroundColor={theme?.colors?.background || '#f8f9fa'} barStyle="dark-content" />
        <ErrorBoundary screenName={this.state.screenName}>
          <View style={[
            styles.container,
            { backgroundColor: theme?.colors?.background || '#f8f9fa' },
            containerStyle
          ]}>
            {showOfflineIndicator && (
              <OfflineIndicator style={styles.offlineIndicator} />
            )}
            <View style={[styles.content, style]}>
              {children}
            </View>
          </View>
        </ErrorBoundary>
      </SafeAreaView>
    );
  }
}

/**
 * ScreenWrapper - A component that provides consistent error handling,
 * offline indicators, and styling for all app screens
 */
const ScreenWrapper = ({
  children,
  showOfflineIndicator = true,
  style,
  containerStyle,
  screenName,
  onBackPress
}) => {
  const { theme } = useTheme();
  const cleanupRef = useRef(null);

  useEffect(() => {
    // Register cleanup for functional component
    cleanupRef.current = memoryManager.registerCleanupCallback(
      async () => {
        console.log(`🧹 Cleanup for screen: ${screenName || 'Unknown'}`);
        if (global.gc) {
          global.gc();
        }
      },
      `${screenName || 'screen'}_functional`
    );

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [screenName]);

  return (
    <EnhancedScreenWrapper
      theme={theme}
      showOfflineIndicator={showOfflineIndicator}
      style={style}
      containerStyle={containerStyle}
      screenName={screenName}
      onBackPress={onBackPress}
    >
      {children}
    </EnhancedScreenWrapper>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  offlineIndicator: {
    marginHorizontal: 10,
    marginTop: 5,
  },
  content: {
    flex: 1,
  },
});

export default ScreenWrapper;