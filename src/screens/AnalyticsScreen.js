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
import fastApiService from '../services/fastApiService';
import dataEventBus, { EventTypes } from '../services/dataEventBus';
import KPICard from '../components/charts/KPICard';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * AnalyticsScreen Component - INSTANT LOADING with REAL-TIME UPDATES
 *
 * Main analytics dashboard showing comprehensive farm analytics:
 * - Overview: Total Farms, Batches, Birds
 * - Production: Egg production, trends, rates
 * - Mortality: Death counts, rates, trends
 * - Feed: Costs, consumption, trends
 * - Health: Issues tracking
 * - Water & Weight analytics
 * - Financial summary
 *
 * Performance Features:
 * - INSTANT loading from local SQLite (< 1 second)
 * - Real-time updates via dataEventBus subscriptions
 * - No network delays - 100% offline capable
 * - Efficient SQL queries in fastDatabase
 *
 * Real-time Integration:
 * - Subscribes to ALL data change events (farm, batch, record changes)
 * - Automatically refreshes analytics when user creates/updates/deletes data
 * - Updates reflect immediately without manual refresh
 */
const AnalyticsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [error, setError] = useState(null);

  // Date range state
  const [dateRange, setDateRange] = useState('30d'); // 7d, 30d, 90d

  /**
   * Load analytics data - INSTANT from SQLite
   * This method is FAST because it queries local database synchronously
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

      console.log('[AnalyticsScreen] Loading analytics with params:', params);

      // Load from fastApiService -> fastDatabase (INSTANT)
      const response = await fastApiService.getAnalytics(params);

      if (response.success) {
        console.log('[AnalyticsScreen] Analytics loaded successfully from', response.source);
        setAnalyticsData(response.data);
        setLoading(false);
      } else {
        console.warn('[AnalyticsScreen] Analytics load failed:', response.error);
        setError(response.error || 'Failed to load analytics');
        setLoading(false);
      }

    } catch (err) {
      console.error('[AnalyticsScreen] Critical error loading analytics:', err);
      setError('Unable to load analytics data');
      setLoading(false);
    } finally {
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
   * Real-time event subscriptions - Updates analytics when data changes
   * Subscribes to ALL events that affect analytics
   */
  useEffect(() => {
    console.log('[AnalyticsScreen] Setting up real-time event subscriptions');

    // Handler function that refreshes analytics
    const handleDataChange = (payload) => {
      console.log('[AnalyticsScreen] Data changed, refreshing analytics:', payload);
      loadAnalytics(false); // Refresh without showing loader
    };

    // Subscribe to all relevant events
    const unsubscribers = [
      // Farm events
      dataEventBus.subscribe(EventTypes.FARM_CREATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.FARM_UPDATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.FARM_DELETED, handleDataChange),

      // Batch events
      dataEventBus.subscribe(EventTypes.BATCH_CREATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.BATCH_UPDATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.BATCH_DELETED, handleDataChange),

      // Feed record events
      dataEventBus.subscribe(EventTypes.FEED_RECORD_CREATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.FEED_RECORD_DELETED, handleDataChange),

      // Production record events
      dataEventBus.subscribe(EventTypes.PRODUCTION_RECORD_CREATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.PRODUCTION_RECORD_DELETED, handleDataChange),

      // Mortality record events
      dataEventBus.subscribe(EventTypes.MORTALITY_RECORD_CREATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.MORTALITY_RECORD_DELETED, handleDataChange),

      // Health record events
      dataEventBus.subscribe(EventTypes.HEALTH_RECORD_CREATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.HEALTH_RECORD_DELETED, handleDataChange),

      // Water record events
      dataEventBus.subscribe(EventTypes.WATER_RECORD_CREATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.WATER_RECORD_DELETED, handleDataChange),

      // Weight record events
      dataEventBus.subscribe(EventTypes.WEIGHT_RECORD_CREATED, handleDataChange),
      dataEventBus.subscribe(EventTypes.WEIGHT_RECORD_DELETED, handleDataChange),

      // P1-3 FIX: Subscribe to global DATA_SYNCED event to refresh analytics after sync completes
      // This ensures analytics reflect server-side changes downloaded during sync
      dataEventBus.subscribe(EventTypes.DATA_SYNCED, (payload) => {
        console.log('[AnalyticsScreen] Data synced from server, refreshing analytics:', payload);
        loadAnalytics(false); // Refresh without showing loader
      }),
    ];

    console.log('[AnalyticsScreen] Subscribed to', unsubscribers.length, 'event types');

    // Cleanup subscriptions on unmount
    return () => {
      console.log('[AnalyticsScreen] Cleaning up event subscriptions');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [loadAnalytics]);

  /**
   * Handle manual refresh (pull to refresh)
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
   * Prepare chart data for daily production trend
   */
  const prepareProductionTrendData = () => {
    if (!analyticsData || !analyticsData.production || !analyticsData.production.dailyProduction || analyticsData.production.dailyProduction.length === 0) {
      return null;
    }

    const dailyProduction = analyticsData.production.dailyProduction;

    return {
      labels: dailyProduction.map(day => {
        const date = new Date(day.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [
        {
          data: dailyProduction.map(day => day.totalEggs || 0),
        },
      ],
    };
  };

  /**
   * Prepare chart data for weekly comparison
   */
  const prepareWeeklyComparisonData = () => {
    if (!analyticsData || !analyticsData.production || !analyticsData.production.weeklyComparison) {
      return null;
    }

    const current = analyticsData.production.weeklyComparison.currentWeek?.totalEggs || 0;
    const previous = analyticsData.production.weeklyComparison.previousWeek?.totalEggs || 0;

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
   * Render KPI cards with real-time data
   */
  const renderKPICards = () => {
    if (!analyticsData) {
      return (
        <View>
          <KPICard title="Total Birds" value="0" icon="🐔" loading={loading} />
          <KPICard title="Production Rate" value="0%" icon="🥚" loading={loading} />
          <KPICard title="Egg Production" value="0" icon="📊" loading={loading} />
          <KPICard title="Active Batches" value="0" icon="🏠" loading={loading} />
        </View>
      );
    }

    const { overview, production, mortality } = analyticsData;

    // Calculate week-over-week trend
    const weeklyTrend = production.weeklyComparison?.percentageChange || 0;

    return (
      <View>
        <KPICard
          title="Total Birds"
          value={overview.totalBirds.toLocaleString()}
          subtitle="Active birds across all batches"
          icon="🐔"
          color={theme.colors.primary}
        />

        <KPICard
          title="Production Rate"
          value={`${production.productionRate}%`}
          subtitle="Average production rate"
          icon="🥚"
          color={theme.colors.warning}
        />

        <KPICard
          title="Egg Production"
          value={production.totalEggsCollected.toLocaleString()}
          subtitle={`Total eggs in ${dateRange} period`}
          icon="📊"
          color={theme.colors.info}
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
          value={overview.activeBatches}
          subtitle="Currently tracked batches"
          icon="🏠"
          color={theme.colors.success}
        />

        <KPICard
          title="Mortality Rate"
          value={`${mortality.mortalityRate}%`}
          subtitle={`${mortality.totalDeaths} deaths (${mortality.trend})`}
          icon="⚠️"
          color={mortality.trend === 'good' ? theme.colors.success : theme.colors.error}
        />

        <KPICard
          title="Total Farms"
          value={overview.totalFarms}
          subtitle="Registered farms"
          icon="🏢"
          color={theme.colors.link}
        />
      </View>
    );
  };

  /**
   * Render charts with real-time data
   */
  const renderCharts = () => (
    <View>
      <LineChart
        title="Daily Production Trend (Last 7 Days)"
        data={prepareProductionTrendData()}
        height={220}
        color={theme.colors.primary}
        yAxisSuffix=" eggs"
        loading={loading}
        error={prepareProductionTrendData() ? null : 'No production data available'}
      />

      <BarChart
        title="Weekly Production Comparison"
        data={prepareWeeklyComparisonData()}
        height={220}
        color={theme.colors.info}
        yAxisSuffix=" eggs"
        loading={loading}
        error={prepareWeeklyComparisonData() ? null : 'No weekly comparison data available'}
      />
    </View>
  );

  /**
   * Render loading state
   */
  if (loading && !analyticsData) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  /**
   * Render error state
   */
  if (error && !analyticsData) {
    return (
      <View style={styles(theme).errorContainer}>
        <Text style={styles(theme).errorText}>{error}</Text>
        <TouchableOpacity style={styles(theme).retryButton} onPress={() => loadAnalytics()}>
          <Text style={styles(theme).retryButtonText}>Retry</Text>
        </TouchableOpacity>
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
            <View style={styles(theme).badge}>
              <Text style={styles(theme).badgeText}>Real-time</Text>
            </View>
          </View>

          {/* Date Range Selector */}
          {renderDateRangeSelector()}

          {/* KPI Cards */}
          <Text style={styles(theme).sectionTitle}>Key Metrics</Text>
          {renderKPICards()}

          {/* Charts */}
          <Text style={styles(theme).sectionTitle}>Trends</Text>
          {renderCharts()}

          {/* Financial Summary */}
          {analyticsData && analyticsData.financial && (
            <>
              <Text style={styles(theme).sectionTitle}>Financial Summary</Text>
              <View style={styles(theme).financialCard}>
                <View style={styles(theme).financialRow}>
                  <Text style={styles(theme).financialLabel}>Total Revenue:</Text>
                  <Text style={styles(theme).financialValue}>${analyticsData.financial.totalRevenue}</Text>
                </View>
                <View style={styles(theme).financialRow}>
                  <Text style={styles(theme).financialLabel}>Total Expenses:</Text>
                  <Text style={styles(theme).financialValue}>${analyticsData.financial.totalExpenses}</Text>
                </View>
                <View style={[styles(theme).financialRow, styles(theme).financialRowTotal]}>
                  <Text style={styles(theme).financialLabelBold}>Profit/Loss:</Text>
                  <Text
                    style={[
                      styles(theme).financialValueBold,
                      { color: parseFloat(analyticsData.financial.profitLoss) >= 0 ? theme.colors.success : theme.colors.error }
                    ]}
                  >
                    ${analyticsData.financial.profitLoss}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Info Footer */}
          <View style={styles(theme).infoFooter}>
            <Text style={styles(theme).infoText}>
              Analytics update automatically when you create farms, batches, or records.
            </Text>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
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
  badge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: theme.colors.buttonText,
    fontSize: 12,
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
    color: theme.colors.buttonText,
  },
  financialCard: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  financialRowTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  financialLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  financialLabelBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  financialValueBold: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoFooter: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default AnalyticsScreen;
