import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import { useDashboardRefresh } from '../context/DashboardRefreshContext';
import fastApiService from '../services/fastApiService';
import OfflineIndicator from '../components/OfflineIndicator';
import ScreenWrapper from '../components/ScreenWrapper';
import LoadingState from '../components/LoadingState';
import SyncStatusBar from '../components/SyncStatusBar';

const DashboardScreen = ({ navigation }) => {
  // CRASH FIX: Add null checks for all context hooks
  const authContext = useAuth();
  const themeContext = useTheme();
  const offlineContext = useOffline();
  const dashboardRefreshContext = useDashboardRefresh();

  // CRASH FIX: Validate contexts are available
  if (!authContext || !themeContext || !offlineContext || !dashboardRefreshContext) {
    // Fallback loading without theme context
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={{ fontSize: 14, color: '#666', marginTop: 10, textAlign: 'center' }}>
          Loading dashboard context...
        </Text>
      </View>
    );
  }

  const { user } = authContext;
  const { theme } = themeContext;
  const { isConnected, performSync } = offlineContext;
  const { refreshTrigger, resetRefreshTrigger } = dashboardRefreshContext;

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState(null);

  // CRASH FIX: Track component mount status with ref to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    let loadingTimer = null;

    const initLoad = async () => {
      try {
        // Add small delay to ensure proper mount
        loadingTimer = setTimeout(() => {
          if (isMountedRef.current) {
            loadDashboardData();
          }
        }, 100);
      } catch (error) {
        console.error('Dashboard initialization error:', error);
      }
    };

    initLoad();

    return () => {
      isMountedRef.current = false;
      if (loadingTimer) {
        clearTimeout(loadingTimer);
        loadingTimer = null;
      }
    };
  }, []);

  // Refresh dashboard data whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let focusTimer = null;

      const handleFocus = () => {
        console.log('🎯 Dashboard screen focused - refreshing data...');
        // Add small delay to prevent race conditions
        focusTimer = setTimeout(() => {
          if (isMountedRef.current) {
            loadDashboardData(false); // Refresh without showing loading indicator
          }
        }, 50);
      };

      handleFocus();

      return () => {
        if (focusTimer) {
          clearTimeout(focusTimer);
          focusTimer = null;
        }
      };
    }, [])
  );

  // Listen for refresh triggers from other screens
  useEffect(() => {
    let refreshTimer = null;

    const handleRefreshTrigger = () => {
      console.log(`🔄 Dashboard useEffect triggered with refreshTrigger: ${refreshTrigger}`);
      if (refreshTrigger > 0 && isMountedRef.current) {
        console.log('🔄 Dashboard refreshing due to external trigger...');

        // Debounce refresh calls to prevent rapid successive updates
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }

        refreshTimer = setTimeout(() => {
          if (isMountedRef.current) {
            loadDashboardData(false); // Refresh without showing loading indicator
            resetRefreshTrigger(); // Reset the trigger
          }
        }, 100);
      }
    };

    handleRefreshTrigger();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
    };
  }, [refreshTrigger, resetRefreshTrigger]);

  const loadDashboardData = async (showLoadingIndicator = true) => {
    // CRASH FIX: Check mount status before any state updates
    if (!isMountedRef.current) {
      console.log('Component unmounted, aborting load');
      return;
    }

    try {
      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(true);
      }

      // Add timeout to prevent hanging with proper cleanup
      let timeoutId = null;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Dashboard load timeout')), 15000);
      });

      let result = null;
      try {
        // Load real data from database with timeout
        result = await Promise.race([
          fastApiService.getDashboard(),
          timeoutPromise
        ]);

        // Clear timeout on success
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      } catch (error) {
        // Clear timeout on error
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // CRASH FIX: Handle timeout rejection safely
        if (!isMountedRef.current) {
          console.log('Dashboard timeout fired but component unmounted');
          return; // Return early to prevent crash
        }
        throw error; // Re-throw if component is still mounted
      }

      // CRASH FIX: Always check before state updates
      if (!isMountedRef.current) {
        console.log('Dashboard component unmounted, skipping state update');
        return;
      }

      // CRASH FIX: Handle null result from timeout
      if (result === null) {
        console.log('Dashboard load cancelled (timeout or unmount)');
        return;
      }

      if (result && result.success && result.data) {
        // Safely extract data with comprehensive fallbacks
        const data = result.data || {};
        const processedData = {
          totalFarms: data.totalFarms || data.farms || 0,
          totalFlocks: data.totalFlocks || data.activeBatches || 0,
          totalBirds: data.totalBirds || 0,
          eggsToday: data.eggsToday || data.todayProduction || 0,
          deathsToday: data.deathsToday || data.recentMortality || 0,
          myRecordsToday: data.myRecordsToday || 0,
          recentActivities: Array.isArray(data.recentActivities) ? data.recentActivities : [],
          alerts: Array.isArray(data.alerts) ? data.alerts : [],
          isDefault: false,
          lastUpdated: new Date().toISOString()
        };

        setDashboardData(processedData);
        setDataSource(result.source || 'database');
        console.log('✅ Dashboard data updated from database');
      } else {
        // No data found - show zero state
        const emptyData = {
          totalFarms: 0,
          totalFlocks: 0,
          totalBirds: 0,
          eggsToday: 0,
          deathsToday: 0,
          myRecordsToday: 0,
          recentActivities: [],
          alerts: [],
          isDefault: true,
          lastUpdated: new Date().toISOString()
        };

        setDashboardData(emptyData);
        setDataSource('database');
        console.log('ℹ️ No dashboard data found in database - showing empty state');
      }

      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(false);
      }

    } catch (error) {
      console.warn('Dashboard load error:', error.message);

      // CRASH FIX: Check mount status before setting error state
      if (!isMountedRef.current) {
        return;
      }

      // On error, show empty state - no mock data
      const emptyData = {
        totalFarms: 0,
        totalFlocks: 0,
        totalBirds: 0,
        eggsToday: 0,
        deathsToday: 0,
        myRecordsToday: 0,
        recentActivities: [],
        alerts: [],
        isDefault: true,
        lastUpdated: new Date().toISOString()
      };

      setDashboardData(emptyData);
      setDataSource('error');

      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(false);
      }
    }
  };


  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      console.log('🔄 Dashboard refresh initiated...');

      // Quick refresh - load data immediately without complex sync logic
      await loadDashboardData(false); // Don't show loading indicator during refresh

      // Optional: Try sync in background if available (non-blocking)
      if (isConnected && performSync) {
        performSync()
          .then(syncResult => {
            if (syncResult?.success) {
              console.log('✅ Background sync completed');
              // Optionally reload data after sync
              loadDashboardData(false);
            }
          })
          .catch(syncError => {
            console.log('ℹ️  Background sync failed:', syncError.message);
            // Ignore sync failures during refresh
          });
      }

      console.log('✅ Dashboard refresh completed');

    } catch (refreshError) {
      console.warn('⚠️  Refresh error:', refreshError.message);

      // On error, show empty state - no mock data
      const emptyData = {
        totalFarms: 0,
        totalFlocks: 0,
        totalBirds: 0,
        eggsToday: 0,
        deathsToday: 0,
        myRecordsToday: 0,
        recentActivities: [],
        alerts: [],
        isDefault: true,
        lastUpdated: new Date().toISOString()
      };

      setDashboardData(emptyData);
      setDataSource('error');
    } finally {
      setRefreshing(false);
    }
  }, [isConnected, performSync]);

  // Navigation handlers for quick actions
  const handleRecordFeed = useCallback(() => {
    try {
      if (!isMountedRef.current) return;
      if (navigation?.navigate) {
        navigation.navigate('Records', { initialTab: 'feed' });
      }
    } catch (error) {
      console.error('Navigation to Records/Feed error:', error);
    }
  }, [navigation]);

  const handleHealthCheck = useCallback(() => {
    try {
      if (!isMountedRef.current) return;
      if (navigation?.navigate) {
        navigation.navigate('Records', { initialTab: 'health' });
      }
    } catch (error) {
      console.error('Navigation to Records/Health error:', error);
    }
  }, [navigation]);

  const handleAddBatch = useCallback(() => {
    try {
      if (!isMountedRef.current) return;
      if (navigation?.navigate) {
        navigation.navigate('Batches', { openAddModal: true });
      }
    } catch (error) {
      console.error('Navigation to Batches error:', error);
    }
  }, [navigation]);

  const handleManageFarms = useCallback(() => {
    try {
      if (!isMountedRef.current) return;
      if (navigation?.navigate) {
        navigation.navigate('Farms');
      }
    } catch (error) {
      console.error('Navigation to Farms error:', error);
    }
  }, [navigation]);

  const handleViewReports = useCallback(() => {
    try {
      if (!isMountedRef.current) return;
      // For now, navigate to Records screen with production tab
      // In the future, this could navigate to a dedicated reports screen
      if (navigation?.navigate) {
        navigation.navigate('Records', { initialTab: 'production' });
      }
    } catch (error) {
      console.error('Navigation to Reports error:', error);
    }
  }, [navigation]);

  const handleRecordEggs = useCallback(() => {
    try {
      if (!isMountedRef.current) return;
      // Worker-specific action for recording eggs
      if (navigation?.navigate) {
        navigation.navigate('Records', { initialTab: 'production' });
      }
    } catch (error) {
      console.error('Navigation to Records/Eggs error:', error);
    }
  }, [navigation]);

  // CRASH FIX: Memoize StatCard to prevent unnecessary re-renders and reduce CPU/memory usage
  const StatCard = React.memo(({ title, value, subtitle, color = theme.colors.primary, icon }) => (
    <View style={[styles.statCard, { borderLeftColor: color, backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}>
      <View style={styles.statHeader}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statTitle, { color: theme.colors.text }]}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={[styles.statSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>}
    </View>
  ));

  return (
    <ScreenWrapper showOfflineIndicator={false}>
      <LoadingState
        loading={loading}
        loadingMessage="Loading Dashboard..."
      >
        <ScrollView
          style={[styles.container, { backgroundColor: theme.colors.background }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
          }
        >
          {/* Offline Indicator */}
          <OfflineIndicator style={{ marginHorizontal: 15, marginTop: 10 }} />

          {/* Sync Status Bar */}
          <SyncStatusBar theme={theme} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.headerBackground }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.welcomeText, { color: theme.colors.headerText }]}>Welcome back,</Text>
            <Text style={[styles.userName, { color: theme.colors.headerText }]}>{user?.firstName} {user?.lastName}</Text>
            {dataSource && (
              <Text style={[styles.dataSourceText, { color: theme.colors.headerText }]}>
                Data from: {dataSource === 'server' ? 'Server' : dataSource === 'local' ? 'Local Storage' : 'Cache'}
              </Text>
            )}
          </View>
          <View style={[styles.roleIndicator, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.roleText}>
              {user?.role === 'manager' ? '👨‍💼' :
               user?.role === 'admin' ? '⭐' :
               user?.role === 'owner' ? '👑' : '👷'}
            </Text>
            <Text style={[styles.roleLabel, { color: theme.colors.headerText }]}>
              {user?.role || 'User'}
            </Text>
          </View>
        </View>
        <Text style={[styles.dateText, { color: theme.colors.headerText }]}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Farm Overview</Text>

        <View style={styles.statsGrid}>
          {/* Show farms stat only to managers */}
          {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') && (
            <StatCard
              title="Total Farms"
              value={dashboardData?.totalFarms || 0}
              icon="🏠"
              color="#2E8B57"
            />
          )}

          <StatCard
            title="Active Flocks"
            value={dashboardData?.totalFlocks || 0}
            icon="🐔"
            color="#FF6B35"
          />

          <StatCard
            title="Total Birds"
            value={dashboardData?.totalBirds || 0}
            subtitle={`${dashboardData?.totalBirds || 0} total`}
            icon="🐓"
            color="#4ECDC4"
          />

          <StatCard
            title="Today's Stats"
            value={`${dashboardData?.eggsToday || 0} eggs`}
            subtitle={`${dashboardData?.deathsToday || 0} deaths`}
            icon="📊"
            color="#45B7D1"
          />

          {/* Worker-specific stat */}
          {user?.role === 'worker' && (
            <StatCard
              title="My Records"
              value={dashboardData?.myRecordsToday || 0}
              subtitle="Records today"
              icon="📝"
              color="#9B59B6"
            />
          )}
        </View>
      </View>

      {/* Recent Activities */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Activities</Text>

        {Array.isArray(dashboardData?.recentActivities) && dashboardData.recentActivities.length > 0 ? (
          <View style={[styles.activitiesContainer, { backgroundColor: theme.colors.cardBackground }]}>
            {dashboardData.recentActivities.slice(0, 5).map((activity, index) => (
              activity ? (
                <View key={index} style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: theme.colors.inputBackground }]}>
                    <Text>{getActivityIcon(activity.type)}</Text>
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityTitle, { color: theme.colors.text }]}>{activity.description || 'Unknown Activity'}</Text>
                    <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>
                      {formatTime(activity.date)}
                    </Text>
                  </View>
                </View>
              ) : null
            ))}
          </View>
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.cardBackground }]}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No recent activities</Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>

        <View style={styles.quickActionsGrid}>
          {/* Always show record actions for all users */}
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}
            onPress={handleRecordFeed}
            activeOpacity={0.7}
            disabled={loading || refreshing}
          >
            <Text style={styles.quickActionIcon}>📝</Text>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Record Feed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}
            onPress={handleHealthCheck}
            activeOpacity={0.7}
            disabled={loading || refreshing}
          >
            <Text style={styles.quickActionIcon}>🏥</Text>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Health Check</Text>
          </TouchableOpacity>

          {/* Manager-only actions */}
          {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') && (
            <>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}
                onPress={handleAddBatch}
                activeOpacity={0.7}
                disabled={loading || refreshing}
              >
                <Text style={styles.quickActionIcon}>🐔</Text>
                <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Add Batch</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}
                onPress={handleManageFarms}
                activeOpacity={0.7}
                disabled={loading || refreshing}
              >
                <Text style={styles.quickActionIcon}>🏠</Text>
                <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Manage Farms</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Always show reports for all users */}
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}
            onPress={handleViewReports}
            activeOpacity={0.7}
            disabled={loading || refreshing}
          >
            <Text style={styles.quickActionIcon}>📊</Text>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>View Reports</Text>
          </TouchableOpacity>

          {/* Worker-specific actions */}
          {user?.role === 'worker' && (
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}
              onPress={handleRecordEggs}
              activeOpacity={0.7}
              disabled={loading || refreshing}
            >
              <Text style={styles.quickActionIcon}>🥚</Text>
              <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Record Eggs</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Alerts & Notifications */}
      {Array.isArray(dashboardData?.alerts) && dashboardData.alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Alerts & Notifications</Text>

          <View style={[styles.alertsContainer, { backgroundColor: theme.colors.cardBackground }]}>
            {dashboardData.alerts.map((alert, index) => (
              alert ? (
                <View
                  key={index}
                  style={[
                    styles.alertItem,
                    { borderLeftColor: getAlertColor(alert.severity), backgroundColor: theme.colors.cardBackground }
                  ]}
                >
                  <Text style={[styles.alertTitle, { color: theme.colors.text }]}>{alert.title || 'Unknown Alert'}</Text>
                  <Text style={[styles.alertMessage, { color: theme.colors.textSecondary }]}>{alert.message || ''}</Text>
                  <Text style={[styles.alertTime, { color: theme.colors.textLight }]}>{formatTime(alert.createdAt)}</Text>
                </View>
              ) : null
            ))}
          </View>
        </View>
      )}
        </ScrollView>
      </LoadingState>
    </ScreenWrapper>
  );
};

// Helper functions
const getActivityIcon = (type) => {
  const icons = {
    feed: '🌾',
    health: '🏥',
    mortality: '⚠️',
    production: '🥚',
    batch: '🐔',
  };
  return icons[type] || '📝';
};

const getAlertColor = (severity) => {
  const colors = {
    high: '#FF3B30',    // Red for high severity
    medium: '#FF9500',  // Orange for medium severity
    low: '#FFCC00',     // Yellow for low severity
  };
  return colors[severity] || '#FFCC00';  // These are always bright colors for alerts, not theme-dependent
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 16,
    opacity: 0.9,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  dataSourceText: {
    fontSize: 12,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  roleIndicator: {
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  roleText: {
    fontSize: 20,
    marginBottom: 2,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: 14,
    opacity: 0.8,
  },
  section: {
    margin: 15,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statSubtitle: {
    fontSize: 12,
  },
  activitiesContainer: {
    borderRadius: 10,
    padding: 15,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  activityDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    marginTop: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  quickActionIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  alertsContainer: {
    borderRadius: 10,
  },
  alertItem: {
    padding: 15,
    borderLeftWidth: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  alertMessage: {
    fontSize: 14,
    marginTop: 5,
  },
  alertTime: {
    fontSize: 12,
    marginTop: 5,
  },
  emptyContainer: {
    borderRadius: 10,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});

export default DashboardScreen;