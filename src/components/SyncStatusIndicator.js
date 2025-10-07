import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import syncService from '../services/syncService';

/**
 * SyncStatusIndicator Component
 *
 * Displays real-time sync status including:
 * - Sync in progress indicator
 * - Pending changes count
 * - Failed sync count
 * - Last sync timestamp
 * - Manual sync trigger button
 */
export const SyncStatusIndicator = ({ onPress }) => {
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    status: 'idle',
    healthScore: 100,
    queue: {
      pending: 0,
      syncing: 0,
      failed: 0,
      synced: 0,
      total: 0
    },
    timestamps: {
      lastSync: null,
      lastFullSync: null,
      initialSyncCompleted: false
    },
    stats: null,
    recommendations: []
  });

  // CRASH-003 FIX: Track circuit breaker and retry state
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryInfo, setRetryInfo] = useState(null);

  const [lastSyncFormatted, setLastSyncFormatted] = useState('Never');

  useEffect(() => {
    // Initial load
    loadSyncStatus();

    // Set up sync status callback
    const handleSyncUpdate = (update) => {
      console.log('Sync status update:', update);

      // CRASH-003 FIX: Handle retry and circuit breaker states
      if (update.type === 'sync_retrying') {
        setIsRetrying(true);
        setRetryInfo({
          attempt: update.attempt,
          maxRetries: update.maxRetries,
          delay: update.delay,
          reason: update.reason
        });
      } else if (update.type === 'sync_blocked') {
        // Circuit breaker blocked sync
        setRetryInfo({
          blocked: true,
          reason: update.reason,
          message: update.message
        });
      } else if (update.type === 'sync_completed' || update.type === 'sync_failed') {
        setIsRetrying(false);
        setRetryInfo(null);
      }

      loadSyncStatus();
    };

    syncService.addSyncCallback(handleSyncUpdate);

    // Periodic refresh every 30 seconds
    const interval = setInterval(loadSyncStatus, 30000);

    return () => {
      syncService.removeSyncCallback(handleSyncUpdate);
      clearInterval(interval);
    };
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);

      // Format last sync time
      if (status.timestamps.lastSync) {
        const lastSync = new Date(status.timestamps.lastSync);
        const now = new Date();
        const diffMs = now - lastSync;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
          setLastSyncFormatted('Just now');
        } else if (diffMins < 60) {
          setLastSyncFormatted(`${diffMins}m ago`);
        } else if (diffHours < 24) {
          setLastSyncFormatted(`${diffHours}h ago`);
        } else {
          setLastSyncFormatted(`${diffDays}d ago`);
        }
      } else {
        setLastSyncFormatted('Never');
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const handleSyncPress = async () => {
    if (onPress) {
      onPress();
    } else {
      // CRASH-003 FIX: Add error handling to prevent unhandled promise rejections
      try {
        // Default behavior - trigger sync with retry mechanism
        const result = await syncService.syncDataWithRetry({
          onRetry: (attempt, maxRetries, delay) => {
            console.log(`Retrying sync: attempt ${attempt}/${maxRetries}, waiting ${delay}ms`);
          }
        });

        if (!result.success) {
          console.warn('Sync failed:', result.message);
          // Error is already logged and handled by syncService
        } else {
          console.log('Sync completed successfully');
        }
      } catch (error) {
        // Final safety net - should never reach here due to syncDataWithRetry error handling
        console.error('Unexpected error during sync:', error);
      }
    }
  };

  // Determine status icon and color
  const getStatusIcon = () => {
    // CRASH-003 FIX: Show retry and circuit breaker states
    if (isRetrying) {
      return { name: 'reload', color: '#FF9500' };
    } else if (retryInfo?.blocked) {
      return { name: 'pause-circle', color: '#FF3B30' };
    } else if (syncStatus.isSyncing) {
      return { name: 'sync', color: '#007AFF' };
    } else if (syncStatus.queue.failed > 0) {
      return { name: 'warning', color: '#FF3B30' };
    } else if (syncStatus.queue.pending > 0) {
      return { name: 'cloud-upload-outline', color: '#FF9500' };
    } else if (syncStatus.status === 'up_to_date') {
      return { name: 'checkmark-circle', color: '#34C759' };
    } else {
      return { name: 'cloud-outline', color: '#8E8E93' };
    }
  };

  const statusIcon = getStatusIcon();

  // CRASH-003 FIX: Get status label with retry info
  const getStatusLabel = () => {
    if (isRetrying && retryInfo) {
      return `Retrying (${retryInfo.attempt}/${retryInfo.maxRetries})...`;
    } else if (retryInfo?.blocked) {
      return 'Sync Blocked';
    } else if (syncStatus.isSyncing) {
      return 'Syncing...';
    } else {
      return 'Sync Status';
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleSyncPress}
      disabled={syncStatus.isSyncing}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {syncStatus.isSyncing ? (
          <ActivityIndicator size="small" color="#007AFF" style={styles.icon} />
        ) : (
          <Ionicons
            name={statusIcon.name}
            size={20}
            color={statusIcon.color}
            style={styles.icon}
          />
        )}

        <View style={styles.textContainer}>
          <View style={styles.row}>
            <Text style={styles.label}>
              {getStatusLabel()}
            </Text>
            {syncStatus.queue.pending > 0 && !syncStatus.isSyncing && !isRetrying && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{syncStatus.queue.pending}</Text>
              </View>
            )}
          </View>

          <View style={styles.detailsRow}>
            {/* CRASH-003 FIX: Show retry/circuit breaker info */}
            {retryInfo?.blocked && (
              <Text style={styles.blockedText}>
                Circuit breaker active
              </Text>
            )}
            {isRetrying && retryInfo && !retryInfo.blocked && (
              <Text style={styles.retryText}>
                Waiting {Math.round(retryInfo.delay / 1000)}s...
              </Text>
            )}
            {!isRetrying && !retryInfo?.blocked && syncStatus.queue.failed > 0 && (
              <Text style={styles.failedText}>
                {syncStatus.queue.failed} failed
              </Text>
            )}
            {!isRetrying && !retryInfo?.blocked && syncStatus.queue.pending > 0 && !syncStatus.isSyncing && (
              <Text style={styles.pendingText}>
                {syncStatus.queue.pending} pending
              </Text>
            )}
            <Text style={styles.lastSyncText}>{lastSyncFormatted}</Text>
          </View>
        </View>

        {!syncStatus.isSyncing && (
          <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
        )}
      </View>

      {/* Health score bar */}
      {syncStatus.healthScore < 100 && (
        <View style={styles.healthBar}>
          <View
            style={[
              styles.healthBarFill,
              {
                width: `${syncStatus.healthScore}%`,
                backgroundColor:
                  syncStatus.healthScore > 70
                    ? '#34C759'
                    : syncStatus.healthScore > 40
                    ? '#FF9500'
                    : '#FF3B30'
              }
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#FF9500',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  failedText: {
    fontSize: 12,
    color: '#FF3B30',
    marginRight: 8,
    fontWeight: '500',
  },
  pendingText: {
    fontSize: 12,
    color: '#FF9500',
    marginRight: 8,
    fontWeight: '500',
  },
  lastSyncText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  // CRASH-003 FIX: New styles for retry and circuit breaker states
  retryText: {
    fontSize: 12,
    color: '#007AFF',
    marginRight: 8,
    fontWeight: '500',
  },
  blockedText: {
    fontSize: 12,
    color: '#FF3B30',
    marginRight: 8,
    fontWeight: '600',
  },
  healthBar: {
    height: 3,
    backgroundColor: '#E5E5EA',
    borderRadius: 1.5,
    marginTop: 8,
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});

export default SyncStatusIndicator;