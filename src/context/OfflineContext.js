import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import networkService from '../services/networkService';
import syncService from '../services/syncService';
import unifiedApiService from '../services/unifiedApiService';
import databaseService from '../services/fastDatabase';
import dataEventBus, { EventTypes } from '../services/dataEventBus';

const OfflineContext = createContext();

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

export const OfflineProvider = ({ children }) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState('unknown');
  const [connectionQuality, setConnectionQuality] = useState('unknown');

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [failedSyncCount, setFailedSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Offline mode state
  const [forceOfflineMode, setForceOfflineMode] = useState(false);
  const [showOfflineIndicator, setShowOfflineIndicator] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Storage stats
  const [storageStats, setStorageStats] = useState(null);

  // Refs to prevent memory leaks
  const networkUnsubscribe = useRef(null);
  const syncUnsubscribe = useRef(null);
  const statsInterval = useRef(null);

  // CRASH FIX: Track component mount status
  const isMountedRef = useRef(true);

  // CRASH FIX: Track last auto-sync time to prevent infinite loops
  const lastAutoSyncTimeRef = useRef(0);
  const AUTO_SYNC_COOLDOWN = 60000; // 1 minute cooldown between auto-syncs

  // Initialize offline services
  useEffect(() => {
    isMountedRef.current = true;
    initializeServices();

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const initializeServices = async () => {
    try {
      console.log('🔧 OfflineContext: Starting initialization...');

      // CRITICAL FIX: Initialize network monitoring (for online/offline detection)
      // but don't auto-trigger sync or health record downloads
      try {
        console.log('📡 Initializing network service...');
        await networkService.init();

        // Subscribe to network changes
        networkUnsubscribe.current = networkService.addListener(handleNetworkChange);

        // Get initial connection state
        const connectionState = networkService.getConnectionState();
        setIsConnected(connectionState.isConnected);
        setConnectionType(connectionState.connectionType);
        setConnectionQuality(connectionState.connectionQuality);

        console.log(`✅ Network monitoring active - Status: ${connectionState.isConnected ? 'Online' : 'Offline'}`);
      } catch (networkError) {
        console.warn('⚠️  Network service init failed (non-critical):', networkError.message);
        // Set default offline state if network monitoring fails
        setIsConnected(false);
        setConnectionType('unknown');
        setConnectionQuality('unknown');
      }

      // Initialize auto-sync as enabled (but it won't trigger unless online)
      setAutoSyncEnabled(true);
      setForceOfflineMode(false);

      // Subscribe to data sync events for sync status tracking
      dataSyncedCleanupRef.current = dataEventBus.subscribe(EventTypes.DATA_SYNCED, (payload) => {
        console.log('📊 Data synced event received');
        setLastSyncTime(new Date());
        updateSyncStatus();
      });

      // Start monitoring storage stats
      startStatsMonitoring();

      // Initial sync status update
      updateSyncStatus();

      console.log('✅ OfflineContext initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize offline services:', error);
      // Don't throw - allow app to continue with limited functionality
    }
  };

  // MEMORY LEAK FIX CR-005: Ref for event bus cleanup
  const dataSyncedCleanupRef = useRef(null);

  const cleanup = () => {
    // Clean up network listener
    if (networkUnsubscribe.current) {
      networkUnsubscribe.current();
      networkUnsubscribe.current = null;
    }

    // MEMORY LEAK FIX CR-005: Clean up event bus subscription via ref
    if (dataSyncedCleanupRef.current) {
      dataSyncedCleanupRef.current();
      dataSyncedCleanupRef.current = null;
    }

    // Clean up stats monitoring
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
      statsInterval.current = null;
    }

    // Clean up services
    networkService.cleanup();
  };

  // Network change handler (with CRASH FIX for infinite loop prevention)
  const handleNetworkChange = (networkData) => {
    setIsConnected(networkData.isConnected);
    setConnectionType(networkData.connectionType);
    setConnectionQuality(networkData.connectionQuality);

    // Log significant changes
    if (networkData.connectionChanged) {
      console.log(`Connection changed: ${networkData.isConnected ? 'Online' : 'Offline'}`);

      // CRASH FIX: Prevent infinite sync loop with cooldown check
      if (networkData.isConnected && autoSyncEnabled && !isSyncing) {
        const now = Date.now();
        const timeSinceLastAutoSync = now - lastAutoSyncTimeRef.current;

        if (timeSinceLastAutoSync >= AUTO_SYNC_COOLDOWN) {
          console.log('🔄 Auto-sync triggered after connection restored');
          lastAutoSyncTimeRef.current = now;

          setTimeout(() => {
            if (isMountedRef.current) {
              performSync().catch(err => {
                console.warn('Auto-sync failed:', err.message);
              });
            }
          }, 1000);
        } else {
          const remainingCooldown = Math.ceil((AUTO_SYNC_COOLDOWN - timeSinceLastAutoSync) / 1000);
          console.log(`Auto-sync in cooldown (${remainingCooldown}s remaining)`);
        }
      }
    }
  };

  // Sync status change handler
  const handleSyncStatusChange = (syncData) => {
    switch (syncData.type) {
      case 'sync_started':
      case 'initial_sync_started':
        setIsSyncing(true);
        setSyncProgress(0);
        break;

      case 'downloading':
        setSyncProgress(30);
        break;

      case 'uploading':
        setSyncProgress(70);
        break;

      case 'sync_completed':
      case 'initial_sync_completed':
        setIsSyncing(false);
        setSyncProgress(100);
        setLastSyncTime(new Date());
        setTimeout(() => setSyncProgress(0), 2000);
        updateSyncStatus();
        break;

      case 'sync_failed':
      case 'initial_sync_failed':
        setIsSyncing(false);
        setSyncProgress(0);
        console.error('Sync failed:', syncData.error);
        updateSyncStatus();
        break;

      default:
        break;
    }
  };

  // Update sync status
  const updateSyncStatus = async () => {
    try {
      // CRASH FIX: Multiple layers of database readiness checks
      // Layer 1: Check if databaseService exists
      if (!databaseService) {
        console.log('⏳ Database service not loaded yet, skipping sync status update');
        setPendingSyncCount(0);
        setFailedSyncCount(0);
        return;
      }

      // Layer 2: Check if database is initialized
      if (!databaseService.isInitialized) {
        console.log('⏳ Database not initialized yet, skipping sync status update');
        setPendingSyncCount(0);
        setFailedSyncCount(0);
        return;
      }

      // Layer 3: Check if database has a valid connection
      if (!databaseService.db) {
        console.log('⏳ Database connection not ready yet, skipping sync status update');
        setPendingSyncCount(0);
        setFailedSyncCount(0);
        return;
      }

      // Layer 4: CRITICAL FIX - Verify sync_queue table exists before querying
      try {
        const tableCheck = databaseService.db.getFirstSync(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_queue'"
        );
        if (!tableCheck) {
          console.log('⏳ sync_queue table does not exist yet, skipping sync status update');
          setPendingSyncCount(0);
          setFailedSyncCount(0);
          return;
        }
      } catch (tableError) {
        console.log('⏳ Cannot check for sync_queue table, skipping sync status update');
        setPendingSyncCount(0);
        setFailedSyncCount(0);
        return;
      }

      // Layer 5: Check if syncService is available
      if (!syncService || typeof syncService.getSyncStatus !== 'function') {
        console.log('⏳ Sync service not ready yet, skipping sync status update');
        setPendingSyncCount(0);
        setFailedSyncCount(0);
        return;
      }

      const syncStatus = await syncService.getSyncStatus();

      // Safely extract values with fallbacks
      setPendingSyncCount(syncStatus?.queue?.pending || 0);
      setFailedSyncCount(syncStatus?.queue?.failed || 0);

      if (syncStatus?.timestamps?.lastSync) {
        setLastSyncTime(new Date(syncStatus.timestamps.lastSync));
      }
    } catch (error) {
      // Silently handle errors - don't show error to user
      console.warn('Sync status update skipped:', error.message);
      setPendingSyncCount(0);
      setFailedSyncCount(0);
    }
  };

  // Storage stats monitoring
  const startStatsMonitoring = () => {
    // Update stats immediately
    updateStorageStats();

    // Update stats every 30 seconds
    statsInterval.current = setInterval(() => {
      updateStorageStats();
    }, 30000);
  };

  const updateStorageStats = async () => {
    try {
      // Only proceed if unifiedApiService is available and initialized
      if (!unifiedApiService || typeof unifiedApiService.getStorageStats !== 'function') {
        console.warn('UnifiedApiService not available for storage stats, using defaults');
        setStorageStats({
          farms: 0,
          batches: 0,
          feedRecords: 0,
          productionRecords: 0,
          mortalityRecords: 0,
          healthRecords: 0,
          pendingSync: 0,
          failedSync: 0,
          total: 0,
          error: null
        });
        return;
      }

      const stats = await unifiedApiService.getStorageStats();

      // Ensure we have valid stats object
      if (stats && typeof stats === 'object') {
        setStorageStats({
          farms: stats.farms || 0,
          batches: stats.batches || 0,
          feedRecords: stats.feedRecords || 0,
          productionRecords: stats.productionRecords || 0,
          mortalityRecords: stats.mortalityRecords || 0,
          healthRecords: stats.healthRecords || 0,
          pendingSync: stats.pendingSync || 0,
          failedSync: stats.failedSync || 0,
          total: stats.total || 0,
          error: null
        });
      } else {
        // Fallback to defaults if stats is invalid
        setStorageStats({
          farms: 0,
          batches: 0,
          feedRecords: 0,
          productionRecords: 0,
          mortalityRecords: 0,
          healthRecords: 0,
          pendingSync: 0,
          failedSync: 0,
          total: 0,
          error: null
        });
      }
    } catch (error) {
      // Silent error handling - log but don't show to user
      console.warn('Storage stats update failed (silently handled):', error.message);

      // Set safe defaults on error - no error message shown to user
      setStorageStats({
        farms: 0,
        batches: 0,
        feedRecords: 0,
        productionRecords: 0,
        mortalityRecords: 0,
        healthRecords: 0,
        pendingSync: 0,
        failedSync: 0,
        total: 0,
        error: null
      });
    }
  };

  // Manual sync trigger
  const performSync = useCallback(async () => {
    // Check if already syncing
    if (isSyncing) {
      console.log('⏭️ Sync already in progress');
      return {
        success: false,
        message: 'Sync already in progress'
      };
    }

    // Check network connection
    if (!isConnected || forceOfflineMode) {
      console.log('⏭️ Cannot sync - offline');
      return {
        success: false,
        message: 'Cannot sync while offline. Please connect to the internet.'
      };
    }

    try {
      console.log('🔄 Starting manual sync...');
      setIsSyncing(true);
      setSyncProgress(10);

      // Use syncService to perform the sync
      // syncService will use fastApiService for local operations
      // and only try to connect to backend if available
      const result = await syncService.syncData();

      if (result.success) {
        setLastSyncTime(new Date());
        console.log('✅ Sync completed successfully');

        // Update sync status and storage stats
        await updateSyncStatus();
        await updateStorageStats();

        return {
          success: true,
          message: 'Sync completed successfully',
          stats: result
        };
      } else {
        console.warn('⚠️  Sync completed with errors:', result.error);
        return {
          success: false,
          message: result.error || 'Sync failed',
          stats: result
        };
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      return {
        success: false,
        message: error.message || 'Sync failed unexpectedly',
        error
      };
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
        setSyncProgress(0);
      }
    }
  }, [isSyncing, isConnected, forceOfflineMode]);

  // Force offline mode toggle
  const toggleForceOfflineMode = useCallback(() => {
    const newMode = !forceOfflineMode;
    setForceOfflineMode(newMode);
    unifiedApiService.setForceOfflineMode(newMode);
    networkService.disableAutoSync(newMode);
    console.log(`Force offline mode ${newMode ? 'enabled' : 'disabled'}`);
  }, [forceOfflineMode]);

  // Auto-sync toggle
  const toggleAutoSync = useCallback(() => {
    const newAutoSync = !autoSyncEnabled;
    setAutoSyncEnabled(newAutoSync);

    if (newAutoSync) {
      networkService.enableAutoSync();
    } else {
      networkService.disableAutoSync();
    }

    console.log(`Auto-sync ${newAutoSync ? 'enabled' : 'disabled'}`);
  }, [autoSyncEnabled]);

  // Retry failed syncs
  const retryFailedSyncs = useCallback(async () => {
    try {
      const result = await unifiedApiService.retryFailedSyncs();
      await updateSyncStatus();
      await updateStorageStats();
      return result;
    } catch (error) {
      console.error('Retry failed syncs error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Clear failed syncs
  const clearFailedSyncs = useCallback(async () => {
    try {
      await unifiedApiService.clearFailedSyncs();
      await updateSyncStatus();
      await updateStorageStats();
      console.log('Failed syncs cleared');
    } catch (error) {
      console.error('Clear failed syncs error:', error);
      throw error;
    }
  }, []);

  // Connection testing
  const testConnection = useCallback(async () => {
    try {
      return await networkService.testServerConnection();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Get detailed connection info
  const getConnectionInfo = useCallback(() => {
    return {
      isConnected,
      connectionType,
      connectionQuality,
      forceOfflineMode,
      recommendation: networkService.getSyncRecommendation(),
      dataUsage: networkService.getDataUsageRecommendation()
    };
  }, [isConnected, connectionType, connectionQuality, forceOfflineMode]);

  // Get sync summary
  const getSyncSummary = useCallback(() => {
    return {
      isSyncing,
      syncProgress,
      pendingSyncCount,
      failedSyncCount,
      lastSyncTime,
      autoSyncEnabled
    };
  }, [isSyncing, syncProgress, pendingSyncCount, failedSyncCount, lastSyncTime, autoSyncEnabled]);

  // Get offline summary
  const getOfflineSummary = useCallback(() => {
    const isOffline = !isConnected || forceOfflineMode;

    return {
      isOffline,
      isOnline: !isOffline,
      forceOfflineMode,
      connectionType,
      connectionQuality,
      canSync: isConnected && !forceOfflineMode,
      showOfflineWarning: isOffline && showOfflineIndicator,
      storageStats
    };
  }, [isConnected, forceOfflineMode, connectionType, connectionQuality, showOfflineIndicator, storageStats]);

  // Utility functions
  const getTimeSinceLastSync = useCallback(() => {
    if (!lastSyncTime) return null;

    const now = new Date();
    const diff = now - lastSyncTime;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }, [lastSyncTime]);

  const getSyncStatusText = useCallback(() => {
    if (isSyncing) {
      if (syncProgress < 50) return 'Downloading data...';
      return 'Uploading changes...';
    }

    if (failedSyncCount > 0) {
      return `${failedSyncCount} sync${failedSyncCount > 1 ? 's' : ''} failed`;
    }

    if (pendingSyncCount > 0) {
      return `${pendingSyncCount} change${pendingSyncCount > 1 ? 's' : ''} pending`;
    }

    if (lastSyncTime) {
      return `Last sync: ${getTimeSinceLastSync()}`;
    }

    return 'Not synced yet';
  }, [isSyncing, syncProgress, failedSyncCount, pendingSyncCount, lastSyncTime, getTimeSinceLastSync]);

  const getConnectionStatusText = useCallback(() => {
    if (forceOfflineMode) return 'Offline mode (forced)';
    if (!isConnected) return 'No connection';

    switch (connectionQuality) {
      case 'excellent': return `Connected (${connectionType}, excellent)`;
      case 'good': return `Connected (${connectionType}, good)`;
      case 'fair': return `Connected (${connectionType}, fair)`;
      case 'poor': return `Connected (${connectionType}, poor)`;
      default: return `Connected (${connectionType})`;
    }
  }, [forceOfflineMode, isConnected, connectionType, connectionQuality]);

  const contextValue = useMemo(() => ({
    // Connection state
    isConnected,
    connectionType,
    connectionQuality,
    forceOfflineMode,

    // Sync state
    isSyncing,
    syncProgress,
    pendingSyncCount,
    failedSyncCount,
    lastSyncTime,
    autoSyncEnabled,

    // Storage state
    storageStats,

    // UI state
    showOfflineIndicator,
    setShowOfflineIndicator,

    // Actions
    performSync,
    toggleForceOfflineMode,
    toggleAutoSync,
    retryFailedSyncs,
    clearFailedSyncs,
    testConnection,
    updateStorageStats,

    // Getters
    getConnectionInfo,
    getSyncSummary,
    getOfflineSummary,
    getTimeSinceLastSync,
    getSyncStatusText,
    getConnectionStatusText
  }), [
    isConnected,
    connectionType,
    connectionQuality,
    forceOfflineMode,
    isSyncing,
    syncProgress,
    pendingSyncCount,
    failedSyncCount,
    lastSyncTime,
    autoSyncEnabled,
    storageStats,
    showOfflineIndicator
  ]);

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
};