import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import fastApiService from '../services/fastApiService';
import ScreenWrapper from '../components/ScreenWrapper';
import OfflineIndicator from '../components/OfflineIndicator';

const PaymentsScreen = ({ navigation }) => {
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

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('all'); // all, cash, mobile_money, bank_transfer, etc.

  const fetchPayments = async () => {
    try {
      setLoading(true);

      // Build query params
      const params = {};
      if (filter !== 'all') {
        params.paymentMethod = filter;
      }

      const response = await fastApiService.get('/api/v1/payments', { params });

      if (response && response.data) {
        setPayments(response.data.data || []);
      }

      // Fetch summary
      const summaryResponse = await fastApiService.get('/api/v1/payments/summary');
      if (summaryResponse && summaryResponse.data) {
        setSummary(summaryResponse.data);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      Alert.alert('Error', 'Failed to load payments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPayments();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchPayments();
    }, [filter])
  );

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash':
        return 'cash-outline';
      case 'mobile_money':
        return 'phone-portrait-outline';
      case 'bank_transfer':
        return 'business-outline';
      case 'credit_card':
        return 'card-outline';
      case 'cheque':
        return 'document-text-outline';
      default:
        return 'wallet-outline';
    }
  };

  const getPaymentMethodColor = (method) => {
    switch (method) {
      case 'cash':
        return '#2E8B57';
      case 'mobile_money':
        return '#FF8C00';
      case 'bank_transfer':
        return '#4A90E2';
      case 'credit_card':
        return '#9370DB';
      case 'cheque':
        return '#DC143C';
      default:
        return '#808080';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return `UGX ${parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const renderPaymentCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBackground }]}
      onPress={() => navigation.navigate('PaymentDetails', { paymentId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.paymentInfo}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: getPaymentMethodColor(item.paymentMethod) + '20' },
            ]}
          >
            <Ionicons
              name={getPaymentMethodIcon(item.paymentMethod)}
              size={24}
              color={getPaymentMethodColor(item.paymentMethod)}
            />
          </View>
          <View style={styles.paymentDetails}>
            <Text style={[styles.receiptNumber, { color: theme.text }]}>
              {item.receiptNumber || 'No Receipt'}
            </Text>
            <Text style={[styles.paymentMethod, { color: theme.subText }]}>
              {item.paymentMethod.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={[styles.amount, { color: '#2E8B57' }]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color={theme.subText} />
          <Text style={[styles.infoText, { color: theme.subText }]}>
            {item.customer?.name || 'Unknown Customer'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={theme.subText} />
          <Text style={[styles.infoText, { color: theme.subText }]}>
            {formatDate(item.paymentDate)} at {formatTime(item.paymentDate)}
          </Text>
        </View>

        {item.referenceNumber && (
          <View style={styles.infoRow}>
            <Ionicons name="barcode-outline" size={16} color={theme.subText} />
            <Text style={[styles.infoText, { color: theme.subText }]}>
              Ref: {item.referenceNumber}
            </Text>
          </View>
        )}

        {item.invoice && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={16} color={theme.subText} />
            <Text style={[styles.infoText, { color: theme.subText }]}>
              Invoice: {item.invoice.invoiceNumber}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSummaryCards = () => {
    if (!summary) return null;

    return (
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: '#2E8B57' }]}>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalAmount)}</Text>
          <Text style={styles.summaryLabel}>Total Received</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#4A90E2' }]}>
          <Text style={styles.summaryValue}>{summary.totalPayments}</Text>
          <Text style={styles.summaryLabel}>Transactions</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#FF8C00' }]}>
          <Text style={styles.summaryValue}>{formatCurrency(summary.thisMonthAmount)}</Text>
          <Text style={styles.summaryLabel}>This Month</Text>
        </View>
      </View>
    );
  };

  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {['all', 'cash', 'mobile_money', 'bank_transfer', 'credit_card'].map(
          (filterOption) => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterButton,
                filter === filterOption && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(filterOption)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === filterOption && styles.filterButtonTextActive,
                ]}
              >
                {filterOption.replace('_', ' ').charAt(0).toUpperCase() +
                  filterOption.replace('_', ' ').slice(1)}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E8B57" />
          <Text style={styles.loadingText}>Loading payments...</Text>
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
        <Text style={styles.headerTitle}>Payments</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('RecordPayment')}
          style={styles.addButton}
        >
          <Ionicons name="add-circle" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {renderSummaryCards()}
      {renderFilterButtons()}

      <FlatList
        data={payments}
        renderItem={renderPaymentCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2E8B57']}
            tintColor="#2E8B57"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No payments found</Text>
            <Text style={styles.emptySubText}>
              Record your first payment to get started
            </Text>
          </View>
        }
      />
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
  addButton: {
    padding: 8,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2E8B57',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentDetails: {
    flex: 1,
  },
  receiptNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  paymentMethod: {
    fontSize: 12,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});

export default PaymentsScreen;
