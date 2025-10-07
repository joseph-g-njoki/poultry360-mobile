import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useOffline } from '../context/OfflineContext';

const OfflineIndicator = ({ style, showSyncButton = true, compact = false }) => {
  const {
    isConnected,
    forceOfflineMode,
    isSyncing,
    syncProgress,
    pendingSyncCount,
    failedSyncCount,
    performSync,
    getSyncStatusText,
    getConnectionStatusText,
    showOfflineIndicator
  } = useOffline();

  const isOffline = !isConnected || forceOfflineMode;

  // Don't show if explicitly disabled
  if (!showOfflineIndicator) return null;

  // Don't show if online and no pending syncs
  if (!isOffline && pendingSyncCount === 0 && failedSyncCount === 0 && !isSyncing) {
    return null;
  }

  const getIndicatorColor = () => {
    if (isSyncing) return '#2196F3'; // Blue for syncing
    if (failedSyncCount > 0) return '#F44336'; // Red for failed
    if (pendingSyncCount > 0) return '#FF9800'; // Orange for pending
    if (isOffline) return '#757575'; // Gray for offline
    return '#4CAF50'; // Green for all good
  };

  const getIndicatorText = () => {
    if (compact) {
      if (isSyncing) return 'Syncing...';
      if (failedSyncCount > 0) return `${failedSyncCount} failed`;
      if (pendingSyncCount > 0) return `${pendingSyncCount} pending`;
      if (isOffline) return 'Offline';
      return 'Online';
    }

    return getSyncStatusText();
  };

  const handleSyncPress = async () => {
    if (!isSyncing && isConnected && !forceOfflineMode) {
      try {
        await performSync();
      } catch (error) {
        console.error('Sync error:', error);
      }
    }
  };

  const canSync = !isSyncing && isConnected && !forceOfflineMode && (pendingSyncCount > 0 || failedSyncCount > 0);

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <View style={[styles.compactDot, { backgroundColor: getIndicatorColor() }]} />
        <Text style={[styles.compactText, { color: getIndicatorColor() }]}>
          {getIndicatorText()}
        </Text>
        {canSync && showSyncButton && (
          <TouchableOpacity
            style={styles.compactSyncButton}
            onPress={handleSyncPress}
            disabled={isSyncing}
          >
            <Text style={styles.compactSyncButtonText}>↻</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: getIndicatorColor() }, style]}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.primaryText}>{getIndicatorText()}</Text>
          <Text style={styles.secondaryText}>{getConnectionStatusText()}</Text>
        </View>

        {isSyncing && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${syncProgress}%` }
                ]}
              />
            </View>
          </View>
        )}

        {canSync && showSyncButton && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSyncPress}
            disabled={isSyncing}
          >
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const SyncStatusBadge = ({ style }) => {
  const {
    pendingSyncCount,
    failedSyncCount,
    isSyncing
  } = useOffline();

  const totalCount = pendingSyncCount + failedSyncCount;

  if (totalCount === 0 && !isSyncing) return null;

  const badgeColor = failedSyncCount > 0 ? '#F44336' :
                    isSyncing ? '#2196F3' : '#FF9800';

  return (
    <View style={[styles.badge, { backgroundColor: badgeColor }, style]}>
      <Text style={styles.badgeText}>
        {isSyncing ? '⟳' : totalCount}
      </Text>
    </View>
  );
};

const ConnectionQualityIndicator = ({ style, showText = false }) => {
  const {
    isConnected,
    connectionQuality,
    connectionType,
    forceOfflineMode
  } = useOffline();

  const getSignalStrength = () => {
    if (!isConnected || forceOfflineMode) return 0;

    switch (connectionQuality) {
      case 'excellent': return 4;
      case 'good': return 3;
      case 'fair': return 2;
      case 'poor': return 1;
      default: return 1;
    }
  };

  const strength = getSignalStrength();
  const isOffline = !isConnected || forceOfflineMode;

  return (
    <View style={[styles.signalContainer, style]}>
      <View style={styles.signalBars}>
        {[1, 2, 3, 4].map(bar => (
          <View
            key={bar}
            style={[
              styles.signalBar,
              {
                height: bar * 3 + 2,
                backgroundColor: bar <= strength
                  ? (isOffline ? '#757575' : '#4CAF50')
                  : '#E0E0E0'
              }
            ]}
          />
        ))}
      </View>

      {showText && (
        <Text style={styles.signalText}>
          {isOffline ? 'Offline' : connectionType}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  primaryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  secondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  progressContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  syncButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  compactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  compactSyncButton: {
    marginLeft: 8,
    padding: 4,
  },
  compactSyncButtonText: {
    fontSize: 16,
    color: '#2196F3',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginRight: 6,
  },
  signalBar: {
    width: 3,
    marginHorizontal: 0.5,
    borderRadius: 1,
  },
  signalText: {
    fontSize: 12,
    color: '#666',
  },
});

// Export components
export default OfflineIndicator;
export { SyncStatusBadge, ConnectionQualityIndicator };