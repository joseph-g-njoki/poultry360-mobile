import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import offlineFirstService from '../services/offlineFirstService';
import offlineDataService from '../services/offlineDataService';
import { useAnalytics } from '../context/DataStoreContext';
import KPICard from '../components/charts/KPICard';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import PieChart from '../components/charts/PieChart';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * AnalyticsScreen Component
 *
 * Main analytics dashboard showing:
 * - KPI cards (total birds, mortality rate, egg production, revenue)
 * - Trend charts (line charts for time-series data)
 * - Comparison charts (bar charts for comparisons)
 * - Distribution charts (pie charts for breakdowns)
 *
 * Features:
 * - Date range selector
 * - Refresh functionality
 * - Offline support (cached data)
 * - Export functionality
 */
const AnalyticsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();

  // Use DataStoreContext hook for automatic data refresh
  const { analytics: contextAnalytics, loading: contextLoading, error: contextError, refresh: refreshAnalytics } = useAnalytics();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Analytics data state
  const [dashboardData, setDashboardData] = useState(null);
  const [trendData, setTrendData] = useState(null);

  // Date range state
  const [dateRange, setDateRange] = useState('30d'); // 7d, 30d, 90d, custom

  /**
   * Load analytics data - TRUE OFFLINE-FIRST approach
   * 1. Load from local data IMMEDIATELY (fast, always works)
   * 2. Try to fetch from server in background (optional, updates if available)
   */
  const loadAnalytics = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (dateRange) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      const params = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };

      console.log('[AnalyticsScreen] Loading analytics OFFLINE-FIRST approach');

      // STEP 1: Load from local data IMMEDIATELY (fast path - always succeeds)
      const localData = await offlineDataService.getCachedAnalytics('dashboard', params);

      if (localData) {
        console.log('[AnalyticsScreen] ✅ Local analytics data loaded immediately');
        const dashboard = localData.data || localData;
        setDashboardData(dashboard);
        setTrendData(dashboard);
        setLoading(false); // Show data immediately!
      } else {
        console.warn('[AnalyticsScreen] No local data available');
      }

      // STEP 2: Try to fetch fresh data from server in background (slow path - optional)
      // This runs AFTER we've already shown local data to user
      try {
        console.log('[AnalyticsScreen] 🌐 Attempting background server fetch...');

        // 2-second timeout for server fetch (don't make user wait)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Server timeout')), 2000)
        );

        const serverResponse = await Promise.race([
          offlineFirstService.getDashboardAnalytics(params),
          timeoutPromise
        ]);

        if (serverResponse) {
          console.log('[AnalyticsScreen] ✅ Server data received, updating display');
          const dashboard = serverResponse.data || serverResponse;
          setDashboardData(dashboard);
          setTrendData(dashboard);
        }
      } catch (serverError) {
        // Server fetch failed - that's OK, we already showed local data
        console.log('[AnalyticsScreen] ℹ️ Server fetch failed (using local data):', serverError.message);
      }

    } catch (err) {
      console.error('[AnalyticsScreen] Critical error:', err);
      setError('Unable to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  /**
   * Initial load
   */
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAnalytics(false);
  }, [loadAnalytics]);

  /**
   * Handle date range change
   */
  const handleDateRangeChange = (range) => {
    setDateRange(range);
  };

  /**
   * Handle export
   */
  const handleExport = async () => {
    try {
      Alert.alert(
        'Export Analytics',
        'Choose export format:',
        [
          {
            text: 'CSV',
            onPress: () => exportData('csv'),
          },
          {
            text: 'PDF',
            onPress: () => exportData('pdf'),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } catch (err) {
      console.error('[AnalyticsScreen] Export error:', err);
      Alert.alert('Error', 'Failed to export analytics data');
    }
  };

  const exportData = async (type) => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // Use offlineFirstService for export (will check if online)
      await offlineFirstService.exportAnalytics({
        type,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      Alert.alert('Success', `Analytics exported as ${type.toUpperCase()}`);
    } catch (err) {
      console.error('[AnalyticsScreen] Export error:', err);
      const errorMessage = err.message || 'Failed to export analytics data';

      if (errorMessage.includes('only available online')) {
        Alert.alert('Offline Mode', 'Export requires an internet connection. Please connect and try again.');
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  /**
   * Prepare chart data from backend production-trends response
   * Backend returns: dailyProduction array with date and totalEggs
   */
  const prepareProductionTrendData = () => {
    if (!dashboardData || !dashboardData.dailyProduction || dashboardData.dailyProduction.length === 0) {
      return null;
    }

    // Get last 7 days of data
    const last7Days = dashboardData.dailyProduction.slice(-7);

    return {
      labels: last7Days.map(day => {
        const date = new Date(day.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [
        {
          data: last7Days.map(day => day.totalEggs || 0),
        },
      ],
    };
  };

  const prepareWeeklyComparisonData = () => {
    if (!dashboardData || !dashboardData.weeklyComparison) {
      return null;
    }

    const current = dashboardData.weeklyComparison.currentWeek?.totalEggs || 0;
    const previous = dashboardData.weeklyComparison.previousWeek?.totalEggs || 0;

    return {
      labels: ['Previous Week', 'This Week'],
      datasets: [
        {
          data: [previous, current],
        },
      ],
    };
  };

  /**
   * Render date range selector
   */
  const renderDateRangeSelector = () => (
    <View style={styles(theme).dateRangeContainer}>
      <Text style={styles(theme).sectionTitle}>Time Period</Text>
      <View style={styles(theme).dateRangeButtons}>
        {['7d', '30d', '90d'].map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles(theme).dateRangeButton,
              dateRange === range && styles(theme).dateRangeButtonActive,
            ]}
            onPress={() => handleDateRangeChange(range)}
          >
            <Text
              style={[
                styles(theme).dateRangeButtonText,
                dateRange === range && styles(theme).dateRangeButtonTextActive,
              ]}
            >
              {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  /**
   * Render KPI cards
   * Maps backend production-trends response to KPI format
   */
  const renderKPICards = () => {
    if (!dashboardData) {
      return (
        <View>
          <KPICard title="Total Birds" value="0" icon="🐔" loading={loading} />
          <KPICard title="Production Rate" value="0%" icon="🥚" loading={loading} />
          <KPICard title="Egg Production" value="0" icon="📊" loading={loading} />
          <KPICard title="Active Batches" value="0" icon="🏠" loading={loading} />
        </View>
      );
    }

    // Calculate totals from productionRateByBatch array
    const totalBirds = dashboardData.productionRateByBatch?.reduce((sum, batch) => sum + (batch.currentCount || 0), 0) || 0;
    const totalEggs = dashboardData.productionRateByBatch?.reduce((sum, batch) => sum + (batch.totalEggs || 0), 0) || 0;
    const avgProductionRate = dashboardData.productionRateByBatch?.length > 0
      ? (dashboardData.productionRateByBatch.reduce((sum, batch) => sum + (batch.productionRate || 0), 0) / dashboardData.productionRateByBatch.length).toFixed(1)
      : 0;
    const activeBatches = dashboardData.productionRateByBatch?.length || 0;

    // Calculate week-over-week trend
    const weeklyTrend = dashboardData.weeklyComparison?.percentageChange || 0;

    return (
      <View>
        <KPICard
          title="Total Birds"
          value={totalBirds.toLocaleString()}
          subtitle="Active birds across all batches"
          icon="🐔"
          color="#2E8B57"
        />

        <KPICard
          title="Production Rate"
          value={`${avgProductionRate}%`}
          subtitle="Average across all batches"
          icon="🥚"
          color="#FFD700"
        />

        <KPICard
          title="Egg Production"
          value={totalEggs.toLocaleString()}
          subtitle={`Total eggs in ${dateRange} period`}
          icon="📊"
          color="#4ECDC4"
          trend={
            weeklyTrend !== 0
              ? {
                  value: Math.abs(weeklyTrend).toFixed(1),
                  direction: weeklyTrend > 0 ? 'up' : 'down',
                }
              : null
          }
        />

        <KPICard
          title="Active Batches"
          value={activeBatches}
          subtitle="Currently tracked batches"
          icon="🏠"
          color="#34C759"
        />
      </View>
    );
  };

  /**
   * Render charts
   */
  const renderCharts = () => (
    <View>
      <LineChart
        title="Daily Production Trend (Last 7 Days)"
        data={prepareProductionTrendData()}
        height={220}
        color="#2E8B57"
        yAxisSuffix=" eggs"
        loading={loading}
        error={prepareProductionTrendData() ? null : 'No production data available'}
      />

      <BarChart
        title="Weekly Production Comparison"
        data={prepareWeeklyComparisonData()}
        height={220}
        color="#4ECDC4"
        yAxisSuffix=" eggs"
        loading={loading}
        error={prepareWeeklyComparisonData() ? null : 'No weekly comparison data available'}
      />
    </View>
  );

  /**
   * Render loading state
   */
  if (loading && !dashboardData) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  /**
   * Render main content
   */
  return (
    <ErrorBoundary>
      <View style={styles(theme).container}>
        <ScrollView
          style={styles(theme).scrollView}
          contentContainerStyle={styles(theme).scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />
          }
        >
          {/* Header */}
          <View style={styles(theme).header}>
            <Text style={styles(theme).title}>Analytics Dashboard</Text>
            <TouchableOpacity style={styles(theme).exportButton} onPress={handleExport}>
              <Text style={styles(theme).exportButtonText}>📊 Export</Text>
            </TouchableOpacity>
          </View>

          {/* Date Range Selector */}
          {renderDateRangeSelector()}

          {/* KPI Cards */}
          <Text style={styles(theme).sectionTitle}>Key Metrics</Text>
          {renderKPICards()}

          {/* Charts */}
          <Text style={styles(theme).sectionTitle}>Trends</Text>
          {renderCharts()}

          {/* Navigation to detailed screens */}
          <View style={styles(theme).navigationContainer}>
            <TouchableOpacity
              style={styles(theme).navigationButton}
              onPress={() => navigation.navigate('FlockPerformance')}
            >
              <Text style={styles(theme).navigationButtonText}>📈 Flock Performance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles(theme).navigationButton}
              onPress={() => navigation.navigate('FinancialAnalytics')}
            >
              <Text style={styles(theme).navigationButtonText}>💰 Financial Analytics</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  exportButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  dateRangeContainer: {
    marginBottom: 16,
  },
  dateRangeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dateRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  dateRangeButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dateRangeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  dateRangeButtonTextActive: {
    color: '#FFFFFF',
  },
  navigationContainer: {
    marginTop: 16,
    gap: 12,
  },
  navigationButton: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
});

export default AnalyticsScreen;
