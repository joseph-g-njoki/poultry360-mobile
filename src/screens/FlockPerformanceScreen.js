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
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No flock data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.flockListContainer}>
        {performanceData.flocks.map((flock, index) => (
          <View key={flock.id || index} style={styles.flockCard}>
            <View style={styles.flockHeader}>
              <Text style={styles.flockName}>{flock.name || `Batch ${flock.id}`}</Text>
              <Text style={styles.flockAge}>Age: {flock.age || 0} days</Text>
            </View>

            <View style={styles.flockMetrics}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>FCR</Text>
                <Text style={styles.metricValue}>{(flock.fcr || 0).toFixed(2)}</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Mortality</Text>
                <Text style={styles.metricValue}>{(flock.mortality || 0).toFixed(1)}%</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Growth</Text>
                <Text style={styles.metricValue}>{flock.growth || 0}g/day</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Birds</Text>
                <Text style={styles.metricValue}>{flock.count || 0}</Text>
              </View>
            </View>

            {/* Performance indicator */}
            <View style={styles.performanceIndicator}>
              <Text style={styles.performanceLabel}>Performance:</Text>
              <View
                style={[
                  styles.performanceBadge,
                  flock.performance === 'excellent' && styles.performanceExcellent,
                  flock.performance === 'good' && styles.performanceGood,
                  flock.performance === 'average' && styles.performanceAverage,
                  flock.performance === 'poor' && styles.performancePoor,
                ]}
              >
                <Text style={styles.performanceBadgeText}>
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={styles.loadingText}>Loading performance data...</Text>
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
            <Text style={styles.title}>Flock Performance</Text>
            <Text style={styles.subtitle}>Last 30 days</Text>
          </View>

          {/* KPI Cards */}
          <Text style={styles.sectionTitle}>Summary Metrics</Text>
          {renderKPICards()}

          {/* FCR Comparison Chart */}
          <Text style={styles.sectionTitle}>Feed Conversion Ratio (FCR)</Text>
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
          <Text style={styles.sectionTitle}>Mortality Rate</Text>
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
              <Text style={styles.sectionTitle}>Growth Rate Trend</Text>
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
          <Text style={styles.sectionTitle}>Flock Details</Text>
          {renderFlockList()}
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
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  flockListContainer: {
    gap: 12,
  },
  flockCard: {
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E0E0E0',
  },
  flockName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  flockAge: {
    fontSize: 14,
    color: '#666',
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
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  performanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  performanceLabel: {
    fontSize: 14,
    color: '#666',
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
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
});

export default FlockPerformanceScreen;
