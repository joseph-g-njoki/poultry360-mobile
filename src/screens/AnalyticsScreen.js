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
import analyticsService from '../services/analyticsService';
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Analytics data state
  const [dashboardData, setDashboardData] = useState(null);
  const [trendData, setTrendData] = useState(null);

  // Date range state
  const [dateRange, setDateRange] = useState('30d'); // 7d, 30d, 90d, custom

  /**
   * Load analytics data from backend
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

      // Fetch dashboard analytics
      const [dashboard, trends] = await Promise.all([
        analyticsService.getDashboardAnalytics(params),
        analyticsService.getTrends({ ...params, metric: 'production', interval: 'daily' }),
      ]);

      setDashboardData(dashboard);
      setTrendData(trends);
    } catch (err) {
      console.error('[AnalyticsScreen] Load error:', err);
      setError(err.message || 'Failed to load analytics data');
      Alert.alert('Error', err.message || 'Failed to load analytics data');
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

      await analyticsService.exportAnalytics({
        type,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      Alert.alert('Success', `Analytics exported as ${type.toUpperCase()}`);
    } catch (err) {
      console.error('[AnalyticsScreen] Export error:', err);
      Alert.alert('Error', 'Failed to export analytics data');
    }
  };

  /**
   * Prepare chart data from backend response
   */
  const prepareProductionTrendData = () => {
    if (!trendData || !trendData.labels || !trendData.values) {
      return null;
    }

    return {
      labels: trendData.labels.slice(-7), // Last 7 data points
      datasets: [
        {
          data: trendData.values.slice(-7),
        },
      ],
    };
  };

  const prepareMortalityTrendData = () => {
    if (!dashboardData || !dashboardData.mortalityTrend) {
      return null;
    }

    return {
      labels: dashboardData.mortalityTrend.labels || [],
      datasets: [
        {
          data: dashboardData.mortalityTrend.values || [],
        },
      ],
    };
  };

  /**
   * Render date range selector
   */
  const renderDateRangeSelector = () => (
    <View style={styles.dateRangeContainer}>
      <Text style={styles.sectionTitle}>Time Period</Text>
      <View style={styles.dateRangeButtons}>
        {['7d', '30d', '90d'].map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.dateRangeButton,
              dateRange === range && styles.dateRangeButtonActive,
            ]}
            onPress={() => handleDateRangeChange(range)}
          >
            <Text
              style={[
                styles.dateRangeButtonText,
                dateRange === range && styles.dateRangeButtonTextActive,
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
   */
  const renderKPICards = () => {
    if (!dashboardData) {
      return (
        <View>
          <KPICard title="Total Birds" value="0" icon="🐔" loading={loading} />
          <KPICard title="Mortality Rate" value="0%" icon="📉" loading={loading} />
          <KPICard title="Egg Production" value="0" icon="🥚" loading={loading} />
          <KPICard title="Revenue" value="$0" icon="💰" loading={loading} />
        </View>
      );
    }

    return (
      <View>
        <KPICard
          title="Total Birds"
          value={dashboardData.totalBirds || 0}
          subtitle="Active birds across all farms"
          icon="🐔"
          color="#2E8B57"
          trend={
            dashboardData.trends?.totalBirds
              ? {
                  value: Math.abs(dashboardData.trends.totalBirds),
                  direction: dashboardData.trends.totalBirds > 0 ? 'up' : 'down',
                }
              : null
          }
        />

        <KPICard
          title="Mortality Rate"
          value={`${(dashboardData.mortalityRate || 0).toFixed(1)}%`}
          subtitle="Average across all batches"
          icon="📉"
          color="#FF3B30"
          trend={
            dashboardData.trends?.mortalityRate
              ? {
                  value: Math.abs(dashboardData.trends.mortalityRate),
                  direction: dashboardData.trends.mortalityRate > 0 ? 'up' : 'down',
                }
              : null
          }
        />

        <KPICard
          title="Egg Production"
          value={dashboardData.eggProduction || 0}
          subtitle="Total eggs this period"
          icon="🥚"
          color="#FFD700"
          trend={
            dashboardData.trends?.eggProduction
              ? {
                  value: Math.abs(dashboardData.trends.eggProduction),
                  direction: dashboardData.trends.eggProduction > 0 ? 'up' : 'down',
                }
              : null
          }
        />

        <KPICard
          title="Revenue"
          value={`$${(dashboardData.revenue || 0).toLocaleString()}`}
          subtitle="Total revenue this period"
          icon="💰"
          color="#34C759"
          trend={
            dashboardData.trends?.revenue
              ? {
                  value: Math.abs(dashboardData.trends.revenue),
                  direction: dashboardData.trends.revenue > 0 ? 'up' : 'down',
                }
              : null
          }
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
        title="Production Trend"
        data={prepareProductionTrendData()}
        height={220}
        color="#2E8B57"
        yAxisSuffix=" eggs"
        loading={loading}
        error={trendData ? null : 'No trend data available'}
      />

      <LineChart
        title="Mortality Rate Trend"
        data={prepareMortalityTrendData()}
        height={220}
        color="#FF3B30"
        yAxisSuffix="%"
        loading={loading}
        error={dashboardData?.mortalityTrend ? null : 'No mortality data available'}
      />
    </View>
  );

  /**
   * Render loading state
   */
  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  /**
   * Render main content
   */
  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2E8B57']} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Analytics Dashboard</Text>
            <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
              <Text style={styles.exportButtonText}>📊 Export</Text>
            </TouchableOpacity>
          </View>

          {/* Date Range Selector */}
          {renderDateRangeSelector()}

          {/* KPI Cards */}
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          {renderKPICards()}

          {/* Charts */}
          <Text style={styles.sectionTitle}>Trends</Text>
          {renderCharts()}

          {/* Navigation to detailed screens */}
          <View style={styles.navigationContainer}>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => navigation.navigate('FlockPerformance')}
            >
              <Text style={styles.navigationButtonText}>📈 Flock Performance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => navigation.navigate('FinancialAnalytics')}
            >
              <Text style={styles.navigationButtonText}>💰 Financial Analytics</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    color: '#333',
  },
  exportButton: {
    backgroundColor: '#2E8B57',
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
    color: '#333',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  dateRangeButtonActive: {
    backgroundColor: '#2E8B57',
    borderColor: '#2E8B57',
  },
  dateRangeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  dateRangeButtonTextActive: {
    color: '#FFFFFF',
  },
  navigationContainer: {
    marginTop: 16,
    gap: 12,
  },
  navigationButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2E8B57',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

export default AnalyticsScreen;
