import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import fastApiService from '../services/fastApiService';
import ScreenWrapper from '../components/ScreenWrapper';
import OfflineIndicator from '../components/OfflineIndicator';

const { width } = Dimensions.get('window');

const FinancialSummaryScreen = ({ navigation }) => {
  const authContext = useAuth();
  const themeContext = useTheme();
  const offlineContext = useOffline();

  // Validate contexts
  if (!authContext || !themeContext || !offlineContext) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2E8B57" />
      </View>
    );
  }

  const { user } = authContext;
  const { theme } = themeContext;
  const { isConnected } = offlineContext;

  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [cashFlow, setCashFlow] = useState(null);
  const [receivables, setReceivables] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // week, month, year

  const fetchFinancialData = async () => {
    try {
      setLoading(true);

      // Fetch comprehensive summary
      const summaryResponse = await fastApiService.get('/api/v1/financial/summary');
      if (summaryResponse && summaryResponse.data) {
        setSummary(summaryResponse.data);
      }

      // Fetch revenue trends
      const trendsResponse = await fastApiService.get('/api/v1/financial/revenue-trends', {
        params: { months: 6 },
      });
      if (trendsResponse && trendsResponse.data) {
        setTrends(trendsResponse.data);
      }

      // Fetch cash flow
      const cashFlowResponse = await fastApiService.get('/api/v1/financial/cash-flow');
      if (cashFlowResponse && cashFlowResponse.data) {
        setCashFlow(cashFlowResponse.data);
      }

      // Fetch receivables aging
      const receivablesResponse = await fastApiService.get(
        '/api/v1/financial/receivables-aging'
      );
      if (receivablesResponse && receivablesResponse.data) {
        setReceivables(receivablesResponse.data);
      }
    } catch (error) {
      console.error('Error fetching financial data:', error);
      Alert.alert('Error', 'Failed to load financial data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFinancialData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchFinancialData();
    }, [])
  );

  const formatCurrency = (amount) => {
    return `UGX ${parseFloat(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const formatPercentage = (value) => {
    return `${parseFloat(value || 0).toFixed(1)}%`;
  };

  const renderOverviewCards = () => {
    if (!summary) return null;

    return (
      <View style={styles.overviewContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Financial Overview</Text>

        <View style={styles.cardsRow}>
          <View style={[styles.overviewCard, { backgroundColor: '#2E8B57' }]}>
            <Ionicons name="trending-up" size={32} color="#fff" />
            <Text style={styles.cardValue}>{formatCurrency(summary.summary.totalRevenue)}</Text>
            <Text style={styles.cardLabel}>Total Revenue</Text>
          </View>

          <View style={[styles.overviewCard, { backgroundColor: '#4A90E2' }]}>
            <Ionicons name="checkmark-circle" size={32} color="#fff" />
            <Text style={styles.cardValue}>
              {formatCurrency(summary.summary.totalCollected)}
            </Text>
            <Text style={styles.cardLabel}>Collected</Text>
          </View>
        </View>

        <View style={styles.cardsRow}>
          <View style={[styles.overviewCard, { backgroundColor: '#FF8C00' }]}>
            <Ionicons name="time" size={32} color="#fff" />
            <Text style={styles.cardValue}>
              {formatCurrency(summary.summary.totalOutstanding)}
            </Text>
            <Text style={styles.cardLabel}>Outstanding</Text>
          </View>

          <View style={[styles.overviewCard, { backgroundColor: '#9370DB' }]}>
            <Ionicons name="stats-chart" size={32} color="#fff" />
            <Text style={styles.cardValue}>
              {formatPercentage(summary.summary.collectionRate)}
            </Text>
            <Text style={styles.cardLabel}>Collection Rate</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderInvoiceStats = () => {
    if (!summary || !summary.invoices) return null;

    return (
      <View style={styles.statsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Invoice Statistics</Text>

        <View style={[styles.statsCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#2E8B57' }]}>
                {summary.invoices.paid}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Paid</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#FF8C00' }]}>
                {summary.invoices.partial}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Partial</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#DC143C' }]}>
                {summary.invoices.overdue}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Overdue</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#808080' }]}>
                {summary.invoices.draft}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Draft</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPaymentMethods = () => {
    if (!summary || !summary.payments || !summary.payments.byMethod) return null;

    const methods = Object.entries(summary.payments.byMethod);
    if (methods.length === 0) return null;

    return (
      <View style={styles.statsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Methods</Text>

        <View style={[styles.statsCard, { backgroundColor: theme.cardBackground }]}>
          {methods.map(([method, amount], index) => (
            <View key={method} style={styles.methodRow}>
              <View style={styles.methodInfo}>
                <Ionicons
                  name={
                    method === 'cash'
                      ? 'cash-outline'
                      : method === 'mobile_money'
                      ? 'phone-portrait-outline'
                      : 'card-outline'
                  }
                  size={20}
                  color={theme.subText}
                />
                <Text style={[styles.methodName, { color: theme.text }]}>
                  {method.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.methodAmount, { color: theme.text }]}>
                {formatCurrency(amount)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderReceivablesAging = () => {
    if (!receivables) return null;

    return (
      <View style={styles.statsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Receivables Aging</Text>

        <View style={[styles.statsCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.agingRow}>
            <View style={styles.agingItem}>
              <Text style={[styles.agingAmount, { color: '#2E8B57' }]}>
                {formatCurrency(receivables.current)}
              </Text>
              <Text style={[styles.agingLabel, { color: theme.subText }]}>Current (0-30)</Text>
            </View>

            <View style={styles.agingItem}>
              <Text style={[styles.agingAmount, { color: '#FF8C00' }]}>
                {formatCurrency(receivables.days30)}
              </Text>
              <Text style={[styles.agingLabel, { color: theme.subText }]}>31-60 Days</Text>
            </View>
          </View>

          <View style={styles.agingRow}>
            <View style={styles.agingItem}>
              <Text style={[styles.agingAmount, { color: '#DC143C' }]}>
                {formatCurrency(receivables.days60)}
              </Text>
              <Text style={[styles.agingLabel, { color: theme.subText }]}>61-90 Days</Text>
            </View>

            <View style={styles.agingItem}>
              <Text style={[styles.agingAmount, { color: '#8B0000' }]}>
                {formatCurrency(receivables.days90Plus)}
              </Text>
              <Text style={[styles.agingLabel, { color: theme.subText }]}>90+ Days</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.actionsContainer}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate('Invoices')}
        >
          <Ionicons name="document-text" size={24} color="#2E8B57" />
          <Text style={[styles.actionText, { color: theme.text }]}>Invoices</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate('Payments')}
        >
          <Ionicons name="wallet" size={24} color="#4A90E2" />
          <Text style={[styles.actionText, { color: theme.text }]}>Payments</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate('Sales')}
        >
          <Ionicons name="cart" size={24} color="#FF8C00" />
          <Text style={[styles.actionText, { color: theme.text }]}>Sales</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate('Customers')}
        >
          <Ionicons name="people" size={24} color="#9370DB" />
          <Text style={[styles.actionText, { color: theme.text }]}>Customers</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E8B57" />
          <Text style={styles.loadingText}>Loading financial summary...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <OfflineIndicator />

      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Summary</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2E8B57']}
            tintColor="#2E8B57"
          />
        }
      >
        {renderOverviewCards()}
        {renderInvoiceStats()}
        {renderPaymentMethods()}
        {renderReceivablesAging()}
        {renderQuickActions()}

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  overviewContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  overviewCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  statsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodName: {
    fontSize: 14,
    fontWeight: '500',
  },
  methodAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  agingRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  agingItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  agingAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  agingLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});

export default FinancialSummaryScreen;
