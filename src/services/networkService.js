import NetInfo from '@react-native-community/netinfo';
import syncService from './syncService';

class NetworkService {
  constructor() {
    this.isConnected = false;
    this.connectionType = 'unknown';
    this.connectionQuality = 'unknown';
    this.listeners = [];
    this.netInfoUnsubscribe = null;
    this.autoSyncEnabled = true;
    this.syncTimeout = null;
  }

  // Initialize network monitoring
  async init() {
    try {
      // Get initial network state
      const state = await NetInfo.fetch();
      this.updateConnectionState(state);

      // Subscribe to network state changes
      this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
        this.updateConnectionState(state);
      });

      console.log('NetworkService initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize NetworkService:', error);
      throw error;
    }
  }

  // Clean up network monitoring
  cleanup() {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    this.listeners = [];
    console.log('NetworkService cleaned up');
  }

  // Update connection state and notify listeners
  updateConnectionState(state) {
    const wasConnected = this.isConnected;
    const prevConnectionType = this.connectionType;

    // FIX: Handle isInternetReachable being null (unknown state)
    // If isConnected is true and isInternetReachable is null, assume true
    // Only set false if explicitly false
    const internetReachable = state.isInternetReachable !== false;
    this.isConnected = state.isConnected && internetReachable;
    this.connectionType = state.type;
    this.connectionQuality = this.getConnectionQuality(state);

    // Log connection changes
    if (wasConnected !== this.isConnected) {
      console.log(`Network connection changed: ${wasConnected ? 'Online' : 'Offline'} -> ${this.isConnected ? 'Online' : 'Offline'}`);
    }

    if (prevConnectionType !== this.connectionType) {
      console.log(`Connection type changed: ${prevConnectionType} -> ${this.connectionType}`);
    }

    // Notify all listeners
    this.notifyListeners({
      isConnected: this.isConnected,
      connectionType: this.connectionType,
      connectionQuality: this.connectionQuality,
      wasConnected,
      connectionChanged: wasConnected !== this.isConnected
    });

    // Handle connection restoration
    if (!wasConnected && this.isConnected && this.autoSyncEnabled) {
      this.scheduleAutoSync();
    }
  }

  // Determine connection quality based on connection details
  getConnectionQuality(state) {
    if (!state.isConnected) return 'offline';

    const { type, details } = state;

    switch (type) {
      case 'wifi':
        return 'excellent';

      case 'cellular':
        if (details.cellularGeneration) {
          switch (details.cellularGeneration) {
            case '5g':
              return 'excellent';
            case '4g':
              return 'good';
            case '3g':
              return 'fair';
            case '2g':
              return 'poor';
            default:
              return 'fair';
          }
        }
        return 'good';

      case 'ethernet':
        return 'excellent';

      case 'other':
      case 'unknown':
      default:
        return 'unknown';
    }
  }

  // Schedule automatic sync when connection is restored
  scheduleAutoSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    // Wait a bit for connection to stabilize, then sync
    this.syncTimeout = setTimeout(async () => {
      try {
        console.log('Auto-sync triggered after connection restoration');
        await syncService.syncData();
      } catch (error) {
        console.error('Auto-sync failed:', error);
      } finally {
        this.syncTimeout = null;
      }
    }, 2000); // 2 second delay
  }

  // Connection state getters
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      connectionType: this.connectionType,
      connectionQuality: this.connectionQuality,
      timestamp: new Date().toISOString()
    };
  }

  getIsConnected() {
    return this.isConnected;
  }

  getConnectionType() {
    return this.connectionType;
  }

  getConnectionQuality() {
    return this.connectionQuality;
  }

  // Connection quality checks
  isGoodConnection() {
    return this.isConnected && ['excellent', 'good'].includes(this.connectionQuality);
  }

  isFairConnection() {
    return this.isConnected && this.connectionQuality === 'fair';
  }

  isPoorConnection() {
    return this.isConnected && this.connectionQuality === 'poor';
  }

  isWifiConnection() {
    return this.isConnected && this.connectionType === 'wifi';
  }

  isCellularConnection() {
    return this.isConnected && this.connectionType === 'cellular';
  }

  // Auto-sync controls
  enableAutoSync() {
    this.autoSyncEnabled = true;
    console.log('Auto-sync enabled');
  }

  disableAutoSync(force = false) {
    this.autoSyncEnabled = !force; // If force is true, keep disabled
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    console.log(`Auto-sync ${force ? 'force disabled' : 'disabled'}`);
  }

  isAutoSyncEnabled() {
    return this.autoSyncEnabled;
  }

  // Listener management
  addListener(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.listeners.push(callback);

    // Immediately call the callback with current state
    callback(this.getConnectionState());

    // Return unsubscribe function
    return () => {
      this.removeListener(callback);
    };
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  notifyListeners(connectionData) {
    this.listeners.forEach(callback => {
      try {
        callback(connectionData);
      } catch (error) {
        console.error('Error in network listener callback:', error);
      }
    });
  }

  // Manual connection check
  async checkConnection() {
    try {
      const state = await NetInfo.fetch();
      this.updateConnectionState(state);
      return this.getConnectionState();
    } catch (error) {
      console.error('Error checking connection:', error);
      return {
        isConnected: false,
        connectionType: 'unknown',
        connectionQuality: 'unknown',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Connection testing with actual server
  async testServerConnection(timeout = 5000) {
    try {
      if (!this.isConnected) {
        throw new Error('No internet connection');
      }

      // Import api service dynamically to avoid circular dependency
      const { default: apiService } = await import('./api');

      // Set a custom timeout for this test
      const originalTimeout = apiService.api.defaults.timeout;
      apiService.api.defaults.timeout = timeout;

      try {
        // Try to verify token or get a simple endpoint
        await apiService.verifyToken();
        return {
          success: true,
          responseTime: Date.now(),
          connectionQuality: this.connectionQuality
        };
      } finally {
        // Restore original timeout
        apiService.api.defaults.timeout = originalTimeout;
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        connectionQuality: this.connectionQuality
      };
    }
  }

  // Connection statistics and monitoring
  async getConnectionStats() {
    try {
      const state = await NetInfo.fetch();

      return {
        isConnected: this.isConnected,
        connectionType: this.connectionType,
        connectionQuality: this.connectionQuality,
        details: state.details,
        isInternetReachable: state.isInternetReachable,
        isWifiEnabled: state.isWifiEnabled,
        autoSyncEnabled: this.autoSyncEnabled,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting connection stats:', error);
      return {
        isConnected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Sync recommendations based on connection quality
  getSyncRecommendation() {
    if (!this.isConnected) {
      return {
        shouldSync: false,
        reason: 'No internet connection',
        recommendation: 'Wait for connection to be restored'
      };
    }

    switch (this.connectionQuality) {
      case 'excellent':
        return {
          shouldSync: true,
          reason: 'Excellent connection quality',
          recommendation: 'Full sync recommended'
        };

      case 'good':
        return {
          shouldSync: true,
          reason: 'Good connection quality',
          recommendation: 'Full sync recommended'
        };

      case 'fair':
        return {
          shouldSync: true,
          reason: 'Fair connection quality',
          recommendation: 'Sync with caution, may be slower'
        };

      case 'poor':
        return {
          shouldSync: false,
          reason: 'Poor connection quality',
          recommendation: 'Wait for better connection or sync only critical data'
        };

      default:
        return {
          shouldSync: false,
          reason: 'Unknown connection quality',
          recommendation: 'Test connection before syncing'
        };
    }
  }

  // Data usage optimization suggestions
  getDataUsageRecommendation() {
    if (!this.isConnected) {
      return {
        useDataOptimization: true,
        reason: 'No connection - use offline mode'
      };
    }

    if (this.isWifiConnection()) {
      return {
        useDataOptimization: false,
        reason: 'WiFi connection - full data usage OK'
      };
    }

    if (this.isCellularConnection()) {
      return {
        useDataOptimization: true,
        reason: 'Cellular connection - optimize data usage'
      };
    }

    return {
      useDataOptimization: true,
      reason: 'Unknown connection type - be conservative'
    };
  }

  // Connection history (simple in-memory storage)
  getRecentConnectionHistory() {
    // This could be expanded to store history in AsyncStorage
    return {
      currentState: this.getConnectionState(),
      lastChange: this.lastConnectionChange || null
    };
  }
}

export default new NetworkService();