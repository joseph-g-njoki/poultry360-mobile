import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import analyticsService from '../services/analyticsService';
import KPICard from '../components/charts/KPICard';
import BarChart from '../components/charts/BarChart';
import LineChart from '../components/charts/LineChart';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * FlockPerformanceScreen Component
 *
 * Detailed flock performance analytics showing:
 * - Feed Conversion Ratio (FCR) comparison across flocks
 * - Mortality trends by flock
 * - Growth rate charts
 * - Performance benchmarks
 *
 * Features:
 * - Flock comparison
 * - Performance metrics
 * - Historical trends
 */
const FlockPerformanceScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Performance data state
  const [performanceData, setPerformanceData] = useState(null);

  /**
   * Load flock performance data
   */
  const loadPerformance = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      setError(null);

      // Calculate date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const params = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };

      // Fetch performance data
      const data = await analyticsService.getFlockPerformance(params);
      setPerformanceData(data);
    } catch (err) {
      console.error('[FlockPerformanceScreen] Load error:', err);
      setError(err.message || 'Failed to load performance data');
      Alert.alert('Error', err.message || 'Failed to load performance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Initial load
   */
  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPerformance(false);
  }, [loadPerformance]);

  /**
   * Prepare FCR comparison chart data
   */
  const prepareFCRData = () => {
    if (!performanceData || !performanceData.flocks || performanceData.flocks.length === 0) {
      return null;
    }

    const flocks = performanceData.flocks.slice(0, 5); // Top 5 flocks

    return {
      labels: flocks.map((f) => f.name || `Batch ${f.id}`),
      datasets: [
        {
          data: flocks.map((f) => f.fcr || 0),
        },
      ],
    };
  };

  /**
   * Prepare mortality comparison chart data
   */
  const prepareMortalityData = () => {
    if (!performanceData || !performanceData.flocks || performanceData.flocks.length === 0) {
      return null;
    }

    const flocks = performanceData.flocks.slice(0, 5); // Top 5 flocks

    return {
      labels: flocks.map((f) => f.name || `Batch ${f.id}`),
      datasets: [
        {
          data: flocks.map((f) => f.mortality || 0),
        },
      ],
    };
  };

  /**
   * Prepare growth rate chart data
   */
  const prepareGrowthRateData = () => {
    if (!performanceData || !performanceData.growthTrend) {
      return null;
    }

    return {
      labels: performanceData.growthTrend.labels || [],
      datasets: [
        {
          data: performanceData.growthTrend.values || [],
        },
      ],
    };
  };

  /**
   * Render KPI cards
   */
  const renderKPICards = () => {
    if (!performanceData) {
      return (
        <View>
          <KPICard title="Average FCR" value="0.0" icon="📊" loading={loading} />
          <KPICard title="Average Mortality" value="0%" icon="📉" loading={loading} />
          <KPICard title="Active Flocks" value="0" icon="🐔" loading={loading} />
        </View>
      );
    }

    return (
      <View>
        <KPICard
          title="Average FCR"
          value={(performanceData.averageFCR || 0).toFixed(2)}
          subtitle="Feed Conversion Ratio"
          icon="📊"
          color="#FF9500"
          trend={
            performanceData.fcrTrend
              ? {
                  value: Math.abs(performanceData.fcrTrend),
                  direction: performanceData.fcrTrend > 0 ? 'up' : 'down',
                }
              : null
          }
        />

        <KPICard
          title="Average Mortality"
          value={`${(performanceData.averageMortality || 0).toFixed(1)}%`}
          subtitle="Across all active flocks"
          icon="📉"
          color="#FF3B30"
          trend={
            performanceData.mortalityTrend
              ? {
                  value: Math.abs(performanceData.mortalityTrend),
                  direction: performanceData.mortalityTrend > 0 ? 'up' : 'down',
                }
              : null
          }
        />

        <KPICard
          title="Active Flocks"
          value={performanceData.flocks?.length || 0}
          subtitle="Currently monitored"
          icon="🐔"
          color="#2E8B57"
        />
      </View>
    );
  };

  /**
   * Render flock list with performance metrics
   */
  const renderFlockList = () => {
    if (!performanceData || !performanceData.flocks || performanceData.flocks.length === 0) {
      return (
        <View style={[styles(theme).emptyContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles(theme).emptyText, { color: theme.colors.textLight }]}>No flock data available</Text>
        </View>
      );
    }

    return (
      <View style={styles(theme).flockListContainer}>
        {performanceData.flocks.map((flock, index) => (
          <View key={flock.id || index} style={[styles(theme).flockCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles(theme).flockHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles(theme).flockName, { color: theme.colors.text }]}>{flock.name || `Batch ${flock.id}`}</Text>
              <Text style={[styles(theme).flockAge, { color: theme.colors.textSecondary }]}>Age: {flock.age || 0} days</Text>
            </View>

            <View style={styles(theme).flockMetrics}>
              <View style={styles(theme).metricItem}>
                <Text style={[styles(theme).metricLabel, { color: theme.colors.textSecondary }]}>FCR</Text>
                <Text style={[styles(theme).metricValue, { color: theme.colors.text }]}>{(flock.fcr || 0).toFixed(2)}</Text>
              </View>

              <View style={styles(theme).metricItem}>
                <Text style={[styles(theme).metricLabel, { color: theme.colors.textSecondary }]}>Mortality</Text>
                <Text style={[styles(theme).metricValue, { color: theme.colors.text }]}>{(flock.mortality || 0).toFixed(1)}%</Text>
              </View>

              <View style={styles(theme).metricItem}>
                <Text style={[styles(theme).metricLabel, { color: theme.colors.textSecondary }]}>Growth</Text>
                <Text style={[styles(theme).metricValue, { color: theme.colors.text }]}>{flock.growth || 0}g/day</Text>
              </View>

              <View style={styles(theme).metricItem}>
                <Text style={[styles(theme).metricLabel, { color: theme.colors.textSecondary }]}>Birds</Text>
                <Text style={[styles(theme).metricValue, { color: theme.colors.text }]}>{flock.count || 0}</Text>
              </View>
            </View>

            {/* Performance indicator */}
            <View style={styles(theme).performanceIndicator}>
              <Text style={[styles(theme).performanceLabel, { color: theme.colors.textSecondary }]}>Performance:</Text>
              <View
                style={[
                  styles(theme).performanceBadge,
                  flock.performance === 'excellent' && styles(theme).performanceExcellent,
                  flock.performance === 'good' && styles(theme).performanceGood,
                  flock.performance === 'average' && styles(theme).performanceAverage,
                  flock.performance === 'poor' && styles(theme).performancePoor,
                ]}
              >
                <Text style={styles(theme).performanceBadgeText}>
                  {flock.performance || 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  /**
   * Render loading state
   */
  if (loading && !performanceData) {
    return (
      <View style={[styles(theme).loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles(theme).loadingText, { color: theme.colors.textSecondary }]}>Loading performance data...</Text>
      </View>
    );
  }

  /**
   * Render main content
   */
  return (
    <ErrorBoundary>
      <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          style={styles(theme).scrollView}
          contentContainerStyle={styles(theme).scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />
          }
        >
          {/* Header */}
          <View style={styles(theme).header}>
            <Text style={[styles(theme).title, { color: theme.colors.text }]}>Flock Performance</Text>
            <Text style={[styles(theme).subtitle, { color: theme.colors.textSecondary }]}>Last 30 days</Text>
          </View>

          {/* KPI Cards */}
          <Text style={[styles(theme).sectionTitle, { color: theme.colors.text }]}>Summary Metrics</Text>
          {renderKPICards()}

          {/* FCR Comparison Chart */}
          <Text style={[styles(theme).sectionTitle, { color: theme.colors.text }]}>Feed Conversion Ratio (FCR)</Text>
          <BarChart
            title="FCR Comparison by Flock"
            data={prepareFCRData()}
            height={220}
            color="#FF9500"
            yAxisSuffix=""
            loading={loading}
            error={performanceData?.flocks?.length === 0 ? 'No FCR data available' : null}
          />

          {/* Mortality Comparison Chart */}
          <Text style={[styles(theme).sectionTitle, { color: theme.colors.text }]}>Mortality Rate</Text>
          <BarChart
            title="Mortality Comparison by Flock"
            data={prepareMortalityData()}
            height={220}
            color="#FF3B30"
            yAxisSuffix="%"
            loading={loading}
            error={performanceData?.flocks?.length === 0 ? 'No mortality data available' : null}
          />

          {/* Growth Rate Trend */}
          {performanceData?.growthTrend && (
            <>
              <Text style={[styles(theme).sectionTitle, { color: theme.colors.text }]}>Growth Rate Trend</Text>
              <LineChart
                title="Average Daily Growth"
                data={prepareGrowthRateData()}
                height={220}
                color="#34C759"
                yAxisSuffix="g"
                loading={loading}
              />
            </>
          )}

          {/* Flock List */}
          <Text style={[styles(theme).sectionTitle, { color: theme.colors.text }]}>Flock Details</Text>
          {renderFlockList()}
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  flockListContainer: {
    gap: 12,
  },
  flockCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  flockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  flockName: {
    fontSize: 18,
    fontWeight: '600',
  },
  flockAge: {
    fontSize: 14,
  },
  flockMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  performanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  performanceLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  performanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  performanceExcellent: {
    backgroundColor: '#34C759',
  },
  performanceGood: {
    backgroundColor: '#5AC8FA',
  },
  performanceAverage: {
    backgroundColor: '#FFD700',
  },
  performancePoor: {
    backgroundColor: '#FF3B30',
  },
  performanceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.buttonText,
    textTransform: 'capitalize',
  },
});

export default FlockPerformanceScreen;
