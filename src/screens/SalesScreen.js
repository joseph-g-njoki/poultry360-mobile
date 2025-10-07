import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

const SalesScreen = () => {
  const navigation = useNavigation();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const [salesResponse, summaryResponse] = await Promise.all([
        api.get('/api/v1/sales?page=1&limit=50'),
        api.get('/api/v1/sales/summary'),
      ]);

      if (salesResponse.data && salesResponse.data.data) {
        setSales(salesResponse.data.data);
      }

      if (summaryResponse.data) {
        setSummary(summaryResponse.data);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
      Alert.alert('Error', 'Failed to load sales. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSales();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchSales();
    }, [])
  );

  const formatCurrency = (amount) => {
    return `UGX ${Number(amount).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return '#22C55E';
      case 'pending':
        return '#F59E0B';
      case 'partial':
        return '#3B82F6';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getPaymentStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'partial':
        return 'hourglass';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const renderSaleItem = ({ item }) => (
    <TouchableOpacity
      style={styles.saleCard}
      onPress={() => navigation.navigate('SaleDetails', { saleId: item.id })}
    >
      <View style={styles.saleHeader}>
        <View style={styles.saleHeaderLeft}>
          <Text style={styles.saleInvoice}>
            {item.invoiceNumber || `#${item.id.substring(0, 8)}`}
          </Text>
          <Text style={styles.saleDate}>{formatDate(item.saleDate)}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getPaymentStatusColor(item.paymentStatus) },
          ]}
        >
          <Ionicons
            name={getPaymentStatusIcon(item.paymentStatus)}
            size={14}
            color="#FFFFFF"
          />
          <Text style={styles.statusText}>
            {item.paymentStatus.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.saleDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {item.customer?.name || 'Walk-in Customer'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="cube-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {item.quantity} {item.unit} ({item.productType})
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="card-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {item.paymentMethod.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.amountSection}>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Total:</Text>
          <Text style={styles.amountValue}>
            {formatCurrency(item.totalAmount)}
          </Text>
        </View>
        {item.amountDue > 0 && (
          <View style={styles.amountRow}>
            <Text style={[styles.amountLabel, { color: '#EF4444' }]}>Due:</Text>
            <Text style={[styles.amountValue, { color: '#EF4444' }]}>
              {formatCurrency(item.amountDue)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSummaryCard = () => {
    if (!summary) return null;

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Sales Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Ionicons name="receipt-outline" size={24} color="#3B82F6" />
            <Text style={styles.summaryValue}>{summary.totalSales}</Text>
            <Text style={styles.summaryLabel}>Total Sales</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="cash-outline" size={24} color="#22C55E" />
            <Text style={styles.summaryValue}>
              {formatCurrency(summary.totalRevenue)}
            </Text>
            <Text style={styles.summaryLabel}>Revenue</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="card-outline" size={24} color="#10B981" />
            <Text style={styles.summaryValue}>
              {formatCurrency(summary.totalPaid)}
            </Text>
            <Text style={styles.summaryLabel}>Paid</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="alert-circle-outline" size={24} color="#F59E0B" />
            <Text style={styles.summaryValue}>
              {formatCurrency(summary.totalDue)}
            </Text>
            <Text style={styles.summaryLabel}>Due</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading sales...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sales}
        renderItem={renderSaleItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderSummaryCard}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No sales recorded yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to record your first sale
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddSale')}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  summaryContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  saleCard: {
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
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  saleHeaderLeft: {
    flex: 1,
  },
  saleInvoice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  saleDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saleDetails: {
    marginBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
  },
  amountSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    gap: 6,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default SalesScreen;
