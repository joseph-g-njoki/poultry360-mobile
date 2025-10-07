import { DeviceEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Memory Management Utility
 * Handles memory monitoring, cleanup, and leak prevention
 */
class MemoryManager {
  constructor() {
    this.memoryWarningListener = null;
    this.cleanupCallbacks = new Set();
    this.isCleanupRunning = false;
    this.cleanupCooldown = 15000; // 15 seconds between cleanups (more aggressive)
    this.lastCleanupTime = 0;
    this.memoryThreshold = Platform.OS === 'ios' ? 0.9 : 0.95; // Higher threshold - only cleanup when really needed
    this.emergencyMode = false;
    this.crashPreventionActive = false; // DISABLED - was too aggressive
  }

  /**
   * Initialize memory monitoring
   */
  init() {
    try {
      // Listen for memory warnings
      this.memoryWarningListener = DeviceEventEmitter.addListener(
        'memoryWarning',
        this.handleMemoryWarning.bind(this)
      );

      // Set up periodic memory checks (MUCH less frequent to avoid causing issues)
      this.memoryCheckInterval = setInterval(() => {
        this.checkMemoryUsage();
      }, 300000); // Check every 5 minutes instead of 30 seconds

      // DISABLED emergency monitoring - was too aggressive and causing app closures
      // this.emergencyCheckInterval = setInterval(() => {
      //   this.emergencyCheck();
      // }, 10000); // Emergency check every 10 seconds

      console.log('✅ Memory manager initialized with enhanced crash prevention');
    } catch (error) {
      console.error('❌ Failed to initialize memory manager:', error);
    }
  }

  /**
   * Cleanup and destroy memory manager
   */
  destroy() {
    try {
      if (this.memoryWarningListener) {
        this.memoryWarningListener.remove();
        this.memoryWarningListener = null;
      }

      if (this.memoryCheckInterval) {
        clearInterval(this.memoryCheckInterval);
        this.memoryCheckInterval = null;
      }

      if (this.emergencyCheckInterval) {
        clearInterval(this.emergencyCheckInterval);
        this.emergencyCheckInterval = null;
      }

      this.cleanupCallbacks.clear();
      console.log('✅ Memory manager destroyed');
    } catch (error) {
      console.error('❌ Error destroying memory manager:', error);
    }
  }

  /**
   * Register a cleanup callback
   */
  registerCleanupCallback(callback, name = 'anonymous') {
    if (typeof callback !== 'function') {
      console.warn('Invalid cleanup callback provided');
      return () => {}; // Return empty cleanup function
    }

    const callbackWrapper = {
      callback,
      name,
      id: Date.now() + Math.random(),
    };

    this.cleanupCallbacks.add(callbackWrapper);

    // Return unregister function
    return () => {
      this.cleanupCallbacks.delete(callbackWrapper);
    };
  }

  /**
   * Handle memory warning from system
   */
  handleMemoryWarning = () => {
    console.warn('⚠️ System memory warning received');
    this.emergencyMode = true;
    this.performCleanup('system_warning');
  };

  /**
   * Emergency check for potential crashes
   */
  emergencyCheck = async () => {
    if (!this.crashPreventionActive) {
      return;
    }

    try {
      // Check for memory pressure indicators
      const storageInfo = await this.getStorageInfo();

      // Emergency cleanup if storage is very high
      if (storageInfo.sizeRatio > 0.9) {
        console.warn('🚨 Emergency storage cleanup triggered');
        this.emergencyMode = true;
        await this.performEmergencyCleanup();
      }

      // Force garbage collection more frequently in emergency mode
      if (this.emergencyMode && global.gc) {
        global.gc();
      }

      // Reset emergency mode after some time
      if (this.emergencyMode && storageInfo.sizeRatio < 0.5) {
        console.log('✅ Emergency mode deactivated');
        this.emergencyMode = false;
      }

    } catch (error) {
      console.warn('Emergency check failed:', error);
    }
  };

  /**
   * Perform emergency cleanup with aggressive settings
   */
  async performEmergencyCleanup() {
    try {
      console.log('🚨 Performing emergency cleanup');

      // Bypass cooldown for emergency
      this.lastCleanupTime = 0;

      // Clear all non-essential storage immediately
      const keysToRemove = [
        'debugLogs',
        'crashHistory',
        'lastDownloadResults',
        'lastUploadResults',
        'tempData',
        'cachedData',
      ];

      for (const key of keysToRemove) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          // Continue removing other keys
        }
      }

      // Force immediate cleanup
      await this.performCleanup('emergency');

      console.log('✅ Emergency cleanup completed');
    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error);
    }
  };

  /**
   * Check current memory usage
   */
  async checkMemoryUsage() {
    try {
      // Note: React Native doesn't provide direct memory usage APIs
      // This is a placeholder for potential future native module integration

      // For now, we can check AsyncStorage size as a proxy
      const storageInfo = await this.getStorageInfo();

      if (storageInfo.sizeRatio > this.memoryThreshold) {
        console.warn(`⚠️ Storage usage high: ${(storageInfo.sizeRatio * 100).toFixed(1)}%`);
        this.performCleanup('high_usage');
      }
    } catch (error) {
      console.warn('Error checking memory usage:', error);
    }
  }

  /**
   * Get approximate storage information
   */
  async getStorageInfo() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      // Sample some keys to estimate total size
      const sampleSize = Math.min(keys.length, 50);
      const sampleKeys = keys.slice(0, sampleSize);

      for (const key of sampleKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += value.length;
          }
        } catch (error) {
          // Skip errors for individual keys
        }
      }

      // Estimate total size
      const estimatedTotalSize = (totalSize / sampleSize) * keys.length;
      const maxSize = 10 * 1024 * 1024; // Assume 10MB limit

      return {
        estimatedSize: estimatedTotalSize,
        maxSize,
        sizeRatio: Math.min(estimatedTotalSize / maxSize, 1),
        keyCount: keys.length,
      };
    } catch (error) {
      console.warn('Error getting storage info:', error);
      return { estimatedSize: 0, maxSize: 0, sizeRatio: 0, keyCount: 0 };
    }
  }

  /**
   * Perform memory cleanup
   */
  async performCleanup(reason = 'manual') {
    // Prevent multiple concurrent cleanups
    if (this.isCleanupRunning) {
      console.log('Cleanup already in progress, skipping');
      return { success: false, reason: 'already_running' };
    }

    // Check cooldown
    const timeSinceLastCleanup = Date.now() - this.lastCleanupTime;
    if (timeSinceLastCleanup < this.cleanupCooldown) {
      console.log('Cleanup in cooldown period, skipping');
      return { success: false, reason: 'cooldown' };
    }

    this.isCleanupRunning = true;
    this.lastCleanupTime = Date.now();

    console.log(`🧹 Starting memory cleanup (reason: ${reason})`);

    const cleanupResults = {
      success: true,
      reason,
      callbacks: { total: 0, success: 0, failed: 0 },
      storage: { cleaned: false, error: null },
      gc: { triggered: false },
      timestamp: new Date().toISOString(),
    };

    try {
      // Execute cleanup callbacks
      cleanupResults.callbacks.total = this.cleanupCallbacks.size;

      for (const callbackWrapper of this.cleanupCallbacks) {
        try {
          await Promise.race([
            callbackWrapper.callback(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
            ),
          ]);
          cleanupResults.callbacks.success++;
          console.log(`✅ Cleanup callback '${callbackWrapper.name}' succeeded`);
        } catch (error) {
          cleanupResults.callbacks.failed++;
          console.warn(`❌ Cleanup callback '${callbackWrapper.name}' failed:`, error.message);
        }
      }

      // Clean storage
      try {
        await this.cleanupStorage();
        cleanupResults.storage.cleaned = true;
      } catch (error) {
        cleanupResults.storage.error = error.message;
      }

      // Trigger garbage collection if available
      if (global.gc) {
        try {
          global.gc();
          cleanupResults.gc.triggered = true;
          console.log('✅ Garbage collection triggered');
        } catch (error) {
          console.warn('Failed to trigger garbage collection:', error);
        }
      }

      console.log('✅ Memory cleanup completed', cleanupResults);

    } catch (error) {
      console.error('❌ Memory cleanup failed:', error);
      cleanupResults.success = false;
      cleanupResults.error = error.message;
    } finally {
      this.isCleanupRunning = false;
    }

    // Store cleanup stats
    try {
      await AsyncStorage.setItem('lastMemoryCleanup', JSON.stringify(cleanupResults));
    } catch (error) {
      console.warn('Failed to store cleanup stats:', error);
    }

    return cleanupResults;
  }

  /**
   * Clean up storage data
   */
  async cleanupStorage() {
    try {
      // Clean up old logs and temporary data
      const keysToCheck = [
        'crashHistory',
        'lastDownloadResults',
        'lastUploadResults',
        'lastSyncStats',
        'debugLogs',
      ];

      for (const key of keysToCheck) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);

            // Remove old entries if it's an array
            if (Array.isArray(parsed) && parsed.length > 100) {
              const trimmed = parsed.slice(0, 50); // Keep only last 50 items
              await AsyncStorage.setItem(key, JSON.stringify(trimmed));
              console.log(`🧹 Trimmed ${key}: ${parsed.length} -> ${trimmed.length} items`);
            }
          }
        } catch (error) {
          // Skip individual key errors
        }
      }

      console.log('✅ Storage cleanup completed');
    } catch (error) {
      console.error('❌ Storage cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats() {
    try {
      const storageInfo = await this.getStorageInfo();
      const lastCleanup = await AsyncStorage.getItem('lastMemoryCleanup');

      return {
        storage: storageInfo,
        cleanup: {
          lastCleanup: lastCleanup ? JSON.parse(lastCleanup) : null,
          isRunning: this.isCleanupRunning,
          timeSinceLastCleanup: Date.now() - this.lastCleanupTime,
        },
        callbacks: {
          registered: this.cleanupCallbacks.size,
        },
        system: {
          platform: Platform.OS,
          version: Platform.Version,
        },
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return null;
    }
  }

  /**
   * Force cleanup (for manual triggers)
   */
  async forceCleanup() {
    this.lastCleanupTime = 0; // Reset cooldown
    return await this.performCleanup('manual_force');
  }
}

// Export singleton instance
const memoryManager = new MemoryManager();

export default memoryManager;