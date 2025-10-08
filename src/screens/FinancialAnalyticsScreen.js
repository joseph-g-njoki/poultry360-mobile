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
import PieChart from '../components/charts/PieChart';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * FinancialAnalyticsScreen Component
 *
 * Financial analytics dashboard showing:
 * - Revenue vs Expenses
 * - Profit margins
 * - Cost breakdown (feed, labor, medicine, etc.)
 * - ROI calculations
 * - Financial trends
 *
 * Features:
 * - Period comparison
 * - Cost center analysis
 * - Profitability metrics
 */
const FinancialAnalyticsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Financial data state
  const [financialData, setFinancialData] = useState(null);

  /**
   * Load financial analytics data
   */
  const loadFinancialData = useCallback(async (showLoader = true) => {
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

      // Fetch financial data
      const data = await analyticsService.getFinancialAnalytics(params);
      setFinancialData(data);
    } catch (err) {
      console.error('[FinancialAnalyticsScreen] Load error:', err);
      setError(err.message || 'Failed to load financial data');
      Alert.alert('Error', err.message || 'Failed to load financial data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Initial load
   */
  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFinancialData(false);
  }, [loadFinancialData]);

  /**
   * Prepare expense breakdown pie chart data
   */
  const prepareExpenseBreakdownData = () => {
    if (!financialData || !financialData.breakdown) {
      return null;
    }

    const breakdown = financialData.breakdown;
    const colors = {
      feed: '#FF6384',
      labor: '#36A2EB',
      medicine: '#FFCE56',
      utilities: '#4BC0C0',
      maintenance: '#9966FF',
      other: '#C9CBCF',
    };

    return Object.entries(breakdown).map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: value,
      color: colors[key] || '#999999',
      legendFontColor: theme.colors.textSecondary,
      legendFontSize: 12,
    }));
  };

  /**
   * Prepare revenue vs expenses trend data
   */
  const prepareRevenueTrendData = () => {
    if (!financialData || !financialData.revenueTrend) {
      return null;
    }

    return {
      labels: financialData.revenueTrend.labels || [],
      datasets: [
        {
          data: financialData.revenueTrend.values || [],
        },
      ],
    };
  };

  const prepareExpenseTrendData = () => {
    if (!financialData || !financialData.expenseTrend) {
      return null;
    }

    return {
      labels: financialData.expenseTrend.labels || [],
      datasets: [
        {
          data: financialData.expenseTrend.values || [],
        },
      ],
    };
  };

  /**
   * Prepare profit trend data
   */
  const prepareProfitTrendData = () => {
    if (!financialData || !financialData.profitTrend) {
      return null;
    }

    return {
      labels: financialData.profitTrend.labels || [],
      datasets: [
        {
          data: financialData.profitTrend.values || [],
        },
      ],
    };
  };

  /**
   * Render KPI cards
   */
  const renderKPICards = () => {
    if (!financialData) {
      return (
        <View>
          <KPICard title="Total Revenue" value="$0" icon="💰" loading={loading} />
          <KPICard title="Total Expenses" value="$0" icon="💸" loading={loading} />
          <KPICard title="Net Profit" value="$0" icon="📈" loading={loading} />
          <KPICard title="Profit Margin" value="0%" icon="📊" loading={loading} />
        </View>
      );
    }

    const profitColor = financialData.profit >= 0 ? '#34C759' : '#FF3B30';

    return (
      <View>
        <KPICard
          title="Total Revenue"
          value={`$${(financialData.revenue || 0).toLocaleString()}`}
          subtitle="Total income this period"
          icon="💰"
          color="#34C759"
          trend={
            financialData.revenueTrend?.percentageChange
              ? {
                  value: Math.abs(financialData.revenueTrend.percentageChange),
                  direction: financialData.revenueTrend.percentageChange > 0 ? 'up' : 'down',
                }
              : null
          }
        />

        <KPICard
          title="Total Expenses"
          value={`$${(financialData.expenses || 0).toLocaleString()}`}
          subtitle="Total costs this period"
          icon="💸"
          color="#FF9500"
          trend={
            financialData.expenseTrend?.percentageChange
              ? {
                  value: Math.abs(financialData.expenseTrend.percentageChange),
                  direction: financialData.expenseTrend.percentageChange > 0 ? 'up' : 'down',
                }
              : null
          }
        />

        <KPICard
          title="Net Profit"
          value={`$${(financialData.profit || 0).toLocaleString()}`}
          subtitle="Revenue minus expenses"
          icon="📈"
          color={profitColor}
          trend={
            financialData.profitTrend?.percentageChange
              ? {
                  value: Math.abs(financialData.profitTrend.percentageChange),
                  direction: financialData.profitTrend.percentageChange > 0 ? 'up' : 'down',
                }
              : null
          }
        />

        <KPICard
          title="Profit Margin"
          value={`${(financialData.profitMargin || 0).toFixed(1)}%`}
          subtitle="Net profit as % of revenue"
          icon="📊"
          color="#5AC8FA"
        />

        <KPICard
          title="Return on Investment"
          value={`${(financialData.roi || 0).toFixed(1)}%`}
          subtitle="ROI for this period"
          icon="💹"
          color="#007AFF"
        />
      </View>
    );
  };

  /**
   * Render cost breakdown summary
   */
  const renderCostBreakdown = () => {
    if (!financialData || !financialData.breakdown) {
      return (
        <View style={[styles.emptyContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.emptyText, { color: theme.colors.textLight }]}>No cost breakdown available</Text>
        </View>
      );
    }

    const breakdown = financialData.breakdown;
    const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    return (
      <View style={[styles.breakdownContainer, { backgroundColor: theme.colors.surface }]}>
        {Object.entries(breakdown).map(([category, amount]) => {
          const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
          return (
            <View key={category} style={styles.breakdownItem}>
              <View style={styles.breakdownHeader}>
                <Text style={[styles.breakdownCategory, { color: theme.colors.text }]}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
                <Text style={[styles.breakdownPercentage, { color: theme.colors.textSecondary }]}>{percentage}%</Text>
              </View>
              <View style={styles.breakdownDetails}>
                <Text style={[styles.breakdownAmount, { color: theme.colors.textSecondary }]}>${amount.toLocaleString()}</Text>
                <View style={[styles.breakdownBar, { backgroundColor: theme.colors.border }]}>
                  <View
                    style={[styles.breakdownBarFill, { width: `${percentage}%`, backgroundColor: theme.colors.primary }]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  /**
   * Render loading state
   */
  if (loading && !financialData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading financial data...</Text>
      </View>
    );
  }

  /**
   * Render main content
   */
  return (
    <ErrorBoundary>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Financial Analytics</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Last 30 days</Text>
          </View>

          {/* KPI Cards */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Financial Summary</Text>
          {renderKPICards()}

          {/* Expense Breakdown Pie Chart */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Expense Breakdown</Text>
          <PieChart
            title="Cost Distribution by Category"
            data={prepareExpenseBreakdownData()}
            height={220}
            loading={loading}
            error={financialData?.breakdown ? null : 'No expense data available'}
          />

          {/* Detailed Cost Breakdown */}
          {renderCostBreakdown()}

          {/* Revenue Trend */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Revenue Trend</Text>
          <LineChart
            title="Revenue Over Time"
            data={prepareRevenueTrendData()}
            height={220}
            color="#34C759"
            yAxisSuffix=" $"
            loading={loading}
            error={financialData?.revenueTrend ? null : 'No revenue trend available'}
          />

          {/* Expense Trend */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Expense Trend</Text>
          <LineChart
            title="Expenses Over Time"
            data={prepareExpenseTrendData()}
            height={220}
            color="#FF9500"
            yAxisSuffix=" $"
            loading={loading}
            error={financialData?.expenseTrend ? null : 'No expense trend available'}
          />

          {/* Profit Trend */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Profit Trend</Text>
          <LineChart
            title="Net Profit Over Time"
            data={prepareProfitTrendData()}
            height={220}
            color="#007AFF"
            yAxisSuffix=" $"
            loading={loading}
            error={financialData?.profitTrend ? null : 'No profit trend available'}
          />
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
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
  breakdownContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  breakdownItem: {
    marginBottom: 16,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownCategory: {
    fontSize: 16,
    fontWeight: '600',
  },
  breakdownPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownDetails: {
    gap: 8,
  },
  breakdownAmount: {
    fontSize: 14,
  },
  breakdownBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});

export default FinancialAnalyticsScreen;
