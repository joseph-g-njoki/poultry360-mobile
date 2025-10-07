import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import syncService from '../services/syncService';
import networkService from '../services/networkService';

const SyncStatusBar = ({ theme }) => {
  const [syncStatus, setSyncStatus] = useState({
    lastSyncTime: null,
    isSyncing: false,
    isOnline: true,
    error: null,
    canRetry: false
  });

  useEffect(() => {
    loadSyncStatus();

    // Listen to network changes
    const unsubscribeNetwork = networkService.addListener((state) => {
      setSyncStatus(prev => ({ ...prev, isOnline: state.isConnected }));
    });

    // Listen to sync events
    const unsubscribeSync = syncService.addSyncCallback((event) => {
      if (event.type === 'initial_sync_started' || event.type === 'sync_started') {
        setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null, syncProgress: 'Starting...' }));
      } else if (event.type === 'downloading') {
        setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null, syncProgress: 'Downloading data...' }));
      } else if (event.type === 'initial_sync_completed' || event.type === 'sync_completed') {
        loadSyncStatus();
        setSyncStatus(prev => ({ ...prev, isSyncing: false, error: null, syncProgress: null }));
      } else if (event.type === 'initial_sync_failed' || event.type === 'sync_failed') {
        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false,
          error: event.error,
          canRetry: event.canRetry !== false,
          syncProgress: null
        }));
      } else if (event.type === 'initial_sync_skipped') {
        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false,
          error: null,
          skipped: true,
          reason: event.reason,
          syncProgress: null
        }));
      }
    });

    return () => {
      if (unsubscribeNetwork) unsubscribeNetwork();
      if (unsubscribeSync) unsubscribeSync();
    };
  }, []);

  const loadSyncStatus = async () => {
    try {
      const lastSyncTime = await AsyncStorage.getItem('lastSyncTime');
      const lastSyncError = await AsyncStorage.getItem('lastSyncError');

      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: lastSyncTime ? new Date(lastSyncTime) : null,
        error: lastSyncError ? JSON.parse(lastSyncError).message : null,
        canRetry: !!lastSyncError
      }));
    } catch (error) {
      console.warn('Error loading sync status:', error);
    }
  };

  const handleRetrySync = async () => {
    try {
      setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));
      const result = await syncService.performInitialSync();

      if (result.success) {
        await loadSyncStatus();
      } else {
        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false,
          error: result.error,
          canRetry: result.canRetry
        }));
      }
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: error.message,
        canRetry: true
      }));
    }
  };

  const getTimeAgo = (date) => {
    if (!date) return 'Never';

    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getStatusText = () => {
    if (syncStatus.isSyncing) {
      return syncStatus.syncProgress || 'Syncing...';
    }
    if (!syncStatus.isOnline) return 'Offline - showing cached data';
    if (syncStatus.error) return `Sync failed: ${syncStatus.error}`;
    if (syncStatus.skipped) return 'Using cached data';
    if (syncStatus.lastSyncTime) return `Last synced: ${getTimeAgo(syncStatus.lastSyncTime)}`;
    return 'Not synced yet';
  };

  const getStatusColor = () => {
    if (syncStatus.isSyncing) return theme.colors.primary;
    if (!syncStatus.isOnline) return theme.colors.warning;
    if (syncStatus.error) return theme.colors.error;
    if (syncStatus.skipped) return theme.colors.warning;
    return theme.colors.success;
  };

  // Show progress during syncing
  if (syncStatus.isSyncing && !syncStatus.error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.primary + '15' }]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={[styles.text, { color: theme.colors.primary, marginLeft: 8 }]}>
          {syncStatus.syncProgress || 'Syncing data...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: getStatusColor() + '15' }]}>
      <Text style={[styles.text, { color: getStatusColor(), flex: 1 }]}>
        {getStatusText()}
      </Text>

      {syncStatus.canRetry && !syncStatus.isSyncing && (
        <TouchableOpacity
          onPress={handleRetrySync}
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.retryText, { color: theme.colors.card }]}>
            Retry
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SyncStatusBar;
