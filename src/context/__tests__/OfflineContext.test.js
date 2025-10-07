import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { OfflineProvider, useOffline } from '../OfflineContext';
import networkService from '../../services/networkService';
import syncService from '../../services/syncService';
import unifiedApiService from '../../services/unifiedApiService';
import databaseService from '../../services/database';

// Mock all dependencies
jest.mock('../../services/networkService');
jest.mock('../../services/syncService');
jest.mock('../../services/unifiedApiService');
jest.mock('../../services/database');

describe('OfflineContext', () => {
  let networkListener;

  beforeEach(() => {
    jest.clearAllMocks();
    networkListener = null;

    // Setup default mocks
    networkService.addListener = jest.fn((callback) => {
      networkListener = callback;
      return jest.fn(); // Return unsubscribe function
    });

    networkService.getConnectionState = jest.fn().mockReturnValue({
      isConnected: true,
      connectionType: 'wifi',
      connectionQuality: 'excellent'
    });

    networkService.cleanup = jest.fn();
    networkService.enableAutoSync = jest.fn();
    networkService.disableAutoSync = jest.fn();
    networkService.testServerConnection = jest.fn().mockResolvedValue({ success: true });
    networkService.getSyncRecommendation = jest.fn().mockReturnValue('recommended');
    networkService.getDataUsageRecommendation = jest.fn().mockReturnValue('low');

    syncService.addSyncCallback = jest.fn();
    syncService.getSyncStatus = jest.fn().mockResolvedValue({
      queue: { pending: 0, failed: 0 },
      timestamps: { lastSync: null }
    });

    unifiedApiService.getStorageStats = jest.fn().mockResolvedValue({
      farms: 0,
      batches: 0,
      feedRecords: 0,
      productionRecords: 0,
      mortalityRecords: 0,
      healthRecords: 0,
      pendingSync: 0,
      failedSync: 0,
      total: 0
    });

    unifiedApiService.performSync = jest.fn().mockResolvedValue({ success: true });
    unifiedApiService.retryFailedSyncs = jest.fn().mockResolvedValue({ success: true });
    unifiedApiService.clearFailedSyncs = jest.fn().mockResolvedValue(true);
    unifiedApiService.setForceOfflineMode = jest.fn();

    databaseService.isInitialized = true;
  });

  describe('Initial State', () => {
    it('should provide initial offline state', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.connectionType).toBe('wifi');
      expect(result.current.connectionQuality).toBe('excellent');
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.pendingSyncCount).toBe(0);
      expect(result.current.failedSyncCount).toBe(0);
    });

    it('should throw error when useOffline is used outside provider', () => {
      const consoleError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useOffline());
      }).toThrow('useOffline must be used within an OfflineProvider');

      console.error = consoleError;
    });
  });

  describe('Network Status Monitoring', () => {
    it('should update state when network connection changes', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate network disconnect
      act(() => {
        networkListener({
          isConnected: false,
          connectionType: 'none',
          connectionQuality: 'unknown',
          connectionChanged: true
        });
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionType).toBe('none');
    });

    it('should trigger auto-sync when connection is restored', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate network disconnect
      act(() => {
        networkListener({
          isConnected: false,
          connectionType: 'none',
          connectionQuality: 'unknown',
          connectionChanged: true
        });
      });

      // Simulate network reconnect
      act(() => {
        networkListener({
          isConnected: true,
          connectionType: 'wifi',
          connectionQuality: 'excellent',
          connectionChanged: true
        });
      });

      // Wait for the timeout delay
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(unifiedApiService.performSync).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });

    it('should not auto-sync when auto-sync is disabled', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Disable auto-sync
      act(() => {
        result.current.toggleAutoSync();
      });

      // Simulate network reconnect
      act(() => {
        networkListener({
          isConnected: true,
          connectionType: 'wifi',
          connectionQuality: 'excellent',
          connectionChanged: true
        });
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(unifiedApiService.performSync).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('Sync Status Management', () => {
    it('should update sync status on sync events', async () => {
      let syncCallback;
      syncService.addSyncCallback = jest.fn((cb) => {
        syncCallback = cb;
      });

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Trigger sync started
      act(() => {
        syncCallback({ type: 'sync_started' });
      });

      expect(result.current.isSyncing).toBe(true);
      expect(result.current.syncProgress).toBe(0);

      // Trigger downloading
      act(() => {
        syncCallback({ type: 'downloading' });
      });

      expect(result.current.syncProgress).toBe(30);

      // Trigger uploading
      act(() => {
        syncCallback({ type: 'uploading' });
      });

      expect(result.current.syncProgress).toBe(70);

      // Trigger sync completed
      act(() => {
        syncCallback({ type: 'sync_completed' });
      });

      expect(result.current.isSyncing).toBe(false);
      expect(result.current.syncProgress).toBe(100);
    });

    it('should handle sync failure', async () => {
      let syncCallback;
      syncService.addSyncCallback = jest.fn((cb) => {
        syncCallback = cb;
      });

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        syncCallback({ type: 'sync_started' });
      });

      expect(result.current.isSyncing).toBe(true);

      act(() => {
        syncCallback({ type: 'sync_failed', error: 'Network error' });
      });

      expect(result.current.isSyncing).toBe(false);
      expect(result.current.syncProgress).toBe(0);
    });

    it('should update pending and failed sync counts', async () => {
      syncService.getSyncStatus = jest.fn().mockResolvedValue({
        queue: { pending: 5, failed: 2 },
        timestamps: { lastSync: new Date().toISOString() }
      });

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.pendingSyncCount).toBe(5);
        expect(result.current.failedSyncCount).toBe(2);
      });
    });
  });

  describe('Manual Sync Operations', () => {
    it('should perform manual sync successfully', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.performSync();
      });

      expect(syncResult.success).toBe(true);
      expect(unifiedApiService.performSync).toHaveBeenCalled();
    });

    it('should fail manual sync when offline', async () => {
      networkService.getConnectionState = jest.fn().mockReturnValue({
        isConnected: false,
        connectionType: 'none',
        connectionQuality: 'unknown'
      });

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.performSync();
      });

      expect(syncResult.success).toBe(false);
      expect(syncResult.message).toContain('No internet connection');
    });

    it('should prevent concurrent syncs', async () => {
      unifiedApiService.performSync = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve({ success: true }), 100));
      });

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Start first sync
      let syncPromise1;
      act(() => {
        syncPromise1 = result.current.performSync();
      });

      // Try to start second sync immediately
      let syncResult2;
      await act(async () => {
        syncResult2 = await result.current.performSync();
      });

      expect(syncResult2.success).toBe(false);
      expect(syncResult2.message).toContain('already in progress');

      await syncPromise1;
    });

    it('should retry failed syncs', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      await act(async () => {
        await result.current.retryFailedSyncs();
      });

      expect(unifiedApiService.retryFailedSyncs).toHaveBeenCalled();
    });

    it('should clear failed syncs', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      await act(async () => {
        await result.current.clearFailedSyncs();
      });

      expect(unifiedApiService.clearFailedSyncs).toHaveBeenCalled();
    });
  });

  describe('Force Offline Mode', () => {
    it('should toggle force offline mode', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.forceOfflineMode).toBe(false);

      act(() => {
        result.current.toggleForceOfflineMode();
      });

      expect(result.current.forceOfflineMode).toBe(true);
      expect(unifiedApiService.setForceOfflineMode).toHaveBeenCalledWith(true);
      expect(networkService.disableAutoSync).toHaveBeenCalledWith(true);

      act(() => {
        result.current.toggleForceOfflineMode();
      });

      expect(result.current.forceOfflineMode).toBe(false);
      expect(unifiedApiService.setForceOfflineMode).toHaveBeenCalledWith(false);
    });

    it('should prevent sync when force offline mode is enabled', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.toggleForceOfflineMode();
      });

      let syncResult;
      await act(async () => {
        syncResult = await result.current.performSync();
      });

      expect(syncResult.success).toBe(false);
      expect(syncResult.message).toContain('No internet connection');
    });
  });

  describe('Auto-Sync Management', () => {
    it('should toggle auto-sync', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.autoSyncEnabled).toBe(true);
      });

      act(() => {
        result.current.toggleAutoSync();
      });

      expect(result.current.autoSyncEnabled).toBe(false);
      expect(networkService.disableAutoSync).toHaveBeenCalled();

      act(() => {
        result.current.toggleAutoSync();
      });

      expect(result.current.autoSyncEnabled).toBe(true);
      expect(networkService.enableAutoSync).toHaveBeenCalled();
    });
  });

  describe('Storage Stats', () => {
    it('should load storage stats', async () => {
      unifiedApiService.getStorageStats = jest.fn().mockResolvedValue({
        farms: 5,
        batches: 10,
        feedRecords: 20,
        productionRecords: 15,
        mortalityRecords: 3,
        healthRecords: 8,
        pendingSync: 2,
        failedSync: 1,
        total: 64
      });

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.storageStats).toBeTruthy();
      });

      expect(result.current.storageStats.farms).toBe(5);
      expect(result.current.storageStats.batches).toBe(10);
      expect(result.current.storageStats.total).toBe(64);
    });

    it('should handle storage stats errors gracefully', async () => {
      unifiedApiService.getStorageStats = jest.fn().mockRejectedValue(
        new Error('Database error')
      );

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.storageStats).toBeTruthy();
      });

      // Should have default values on error
      expect(result.current.storageStats.farms).toBe(0);
      expect(result.current.storageStats.total).toBe(0);
      expect(result.current.storageStats.error).toBeNull();
    });

    it('should update storage stats manually', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.storageStats).toBeTruthy();
      });

      unifiedApiService.getStorageStats = jest.fn().mockResolvedValue({
        farms: 10,
        batches: 20,
        total: 100
      });

      await act(async () => {
        await result.current.updateStorageStats();
      });

      await waitFor(() => {
        expect(result.current.storageStats.farms).toBe(10);
      });
    });
  });

  describe('Connection Testing', () => {
    it('should test server connection', async () => {
      networkService.testServerConnection = jest.fn().mockResolvedValue({
        success: true,
        latency: 50
      });

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      let testResult;
      await act(async () => {
        testResult = await result.current.testConnection();
      });

      expect(testResult.success).toBe(true);
      expect(networkService.testServerConnection).toHaveBeenCalled();
    });
  });

  describe('Summary Getters', () => {
    it('should provide connection info', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const connectionInfo = result.current.getConnectionInfo();

      expect(connectionInfo.isConnected).toBe(true);
      expect(connectionInfo.connectionType).toBe('wifi');
      expect(connectionInfo.connectionQuality).toBe('excellent');
      expect(connectionInfo.forceOfflineMode).toBe(false);
    });

    it('should provide sync summary', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const syncSummary = result.current.getSyncSummary();

      expect(syncSummary).toHaveProperty('isSyncing');
      expect(syncSummary).toHaveProperty('syncProgress');
      expect(syncSummary).toHaveProperty('pendingSyncCount');
      expect(syncSummary).toHaveProperty('failedSyncCount');
      expect(syncSummary).toHaveProperty('lastSyncTime');
      expect(syncSummary).toHaveProperty('autoSyncEnabled');
    });

    it('should provide offline summary', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const offlineSummary = result.current.getOfflineSummary();

      expect(offlineSummary.isOffline).toBe(false);
      expect(offlineSummary.isOnline).toBe(true);
      expect(offlineSummary.canSync).toBe(true);
    });

    it('should generate correct sync status text', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      let statusText = result.current.getSyncStatusText();
      expect(statusText).toBe('Not synced yet');

      // Set pending sync count
      syncService.getSyncStatus = jest.fn().mockResolvedValue({
        queue: { pending: 3, failed: 0 },
        timestamps: { lastSync: null }
      });

      await act(async () => {
        // Trigger update (you may need to call a method to update status)
      });
    });

    it('should generate correct connection status text', async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      let statusText = result.current.getConnectionStatusText();
      expect(statusText).toContain('Connected');
      expect(statusText).toContain('wifi');
      expect(statusText).toContain('excellent');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup listeners on unmount', async () => {
      const unsubscribe = jest.fn();
      networkService.addListener = jest.fn().mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(networkService.addListener).toHaveBeenCalled();
      });

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
      expect(networkService.cleanup).toHaveBeenCalled();
    });
  });

  describe('Database Not Initialized', () => {
    it('should handle database not initialized gracefully', async () => {
      databaseService.isInitialized = false;

      const { result } = renderHook(() => useOffline(), {
        wrapper: OfflineProvider,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Should not throw errors, just use default values
      expect(result.current.pendingSyncCount).toBe(0);
      expect(result.current.failedSyncCount).toBe(0);
    });
  });
});