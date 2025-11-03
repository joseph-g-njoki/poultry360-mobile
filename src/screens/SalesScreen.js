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
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import fastApiService from '../services/fastApiService';
import OfflineIndicator from '../components/OfflineIndicator';

const SalesScreen = () => {
  const { theme } = useTheme();
  const { isConnected } = useOffline();
  const navigation = useNavigation();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);

  const fetchSales = async () => {
    try {

      // Use fastApiService for unified data management
      const [salesResponse, summaryResponse] = await Promise.all([
        fastApiService.getSales({ page: 1, limit: 50 }),
        fastApiService.getSalesSummary(),
      ]);

      console.log('📊 SalesScreen: Sales response:', salesResponse);
      console.log('📊 SalesScreen: Summary response:', summaryResponse);

      if (salesResponse.success && salesResponse.data) {
        setSales(salesResponse.data);
      }

      if (summaryResponse.success && summaryResponse.data) {
        setSummary(summaryResponse.data);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
      if (isConnected) {
        Alert.alert('Error', 'Failed to load sales. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchSales();
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
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
      style={styles(theme).saleCard}
      onPress={() => navigation.navigate('SaleDetails', { saleId: item.id })}
    >
      <View style={styles(theme).saleHeader}>
        <View style={styles(theme).saleHeaderLeft}>
          <Text style={styles(theme).saleInvoice}>
            {item.invoiceNumber || `#${item.id.substring(0, 8)}`}
          </Text>
          <Text style={styles(theme).saleDate}>{formatDate(item.saleDate)}</Text>
        </View>
        <View
          style={[
            styles(theme).statusBadge,
            { backgroundColor: getPaymentStatusColor(item.paymentStatus) },
          ]}
        >
          <Ionicons
            name={getPaymentStatusIcon(item.paymentStatus)}
            size={14}
            color="#FFFFFF"
          />
          <Text style={styles(theme).statusText}>
            {item.paymentStatus.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles(theme).saleDetails}>
        <View style={styles(theme).detailRow}>
          <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles(theme).detailText}>
            {item.customer?.name || 'Walk-in Customer'}
          </Text>
        </View>

        <View style={styles(theme).detailRow}>
          <Ionicons name="cube-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles(theme).detailText}>
            {item.quantity} {item.unit} ({item.productType})
          </Text>
        </View>

        <View style={styles(theme).detailRow}>
          <Ionicons name="card-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles(theme).detailText}>
            {item.paymentMethod.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles(theme).amountSection}>
        <View style={styles(theme).amountRow}>
          <Text style={styles(theme).amountLabel}>Total:</Text>
          <Text style={styles(theme).amountValue}>
            {formatCurrency(item.totalAmount)}
          </Text>
        </View>
        {item.amountDue > 0 && (
          <View style={styles(theme).amountRow}>
            <Text style={[styles(theme).amountLabel, { color: '#EF4444' }]}>Due:</Text>
            <Text style={[styles(theme).amountValue, { color: '#EF4444' }]}>
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
      <View style={styles(theme).summaryContainer}>
        <Text style={styles(theme).summaryTitle}>Sales Summary</Text>
        <View style={styles(theme).summaryGrid}>
          <View style={styles(theme).summaryItem}>
            <Ionicons name="receipt-outline" size={24} color="#3B82F6" />
            <Text style={styles(theme).summaryValue}>{summary.totalSales}</Text>
            <Text style={styles(theme).summaryLabel}>Total Sales</Text>
          </View>
          <View style={styles(theme).summaryItem}>
            <Ionicons name="cash-outline" size={24} color="#22C55E" />
            <Text style={styles(theme).summaryValue}>
              {formatCurrency(summary.totalRevenue)}
            </Text>
            <Text style={styles(theme).summaryLabel}>Revenue</Text>
          </View>
          <View style={styles(theme).summaryItem}>
            <Ionicons name="card-outline" size={24} color={theme.colors.primary} />
            <Text style={styles(theme).summaryValue}>
              {formatCurrency(summary.totalPaid)}
            </Text>
            <Text style={styles(theme).summaryLabel}>Paid</Text>
          </View>
          <View style={styles(theme).summaryItem}>
            <Ionicons name="alert-circle-outline" size={24} color="#F59E0B" />
            <Text style={styles(theme).summaryValue}>
              {formatCurrency(summary.totalDue)}
            </Text>
            <Text style={styles(theme).summaryLabel}>Due</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Loading sales...</Text>
      </View>
    );
  }

  return (
    <View style={styles(theme).container}>
      <OfflineIndicator />
      <FlatList
        data={sales}
        renderItem={renderSaleItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderSummaryCard}
        ListEmptyComponent={
          <View style={styles(theme).emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
            <Text style={styles(theme).emptyText}>No sales recorded yet</Text>
            <Text style={styles(theme).emptySubtext}>
              Tap the + button to record your first sale
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles(theme).listContent}
      />

      <TouchableOpacity
        style={styles(theme).fab}
        onPress={() => navigation.navigate('AddSale')}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  summaryContainer: {
    backgroundColor: theme.colors.surface,
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
    color: theme.colors.text,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  saleCard: {
    backgroundColor: theme.colors.surface,
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
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  saleDate: {
    fontSize: 14,
    color: theme.colors.textSecondary,
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
    color: theme.colors.buttonText,
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
    color: theme.colors.text,
  },
  amountSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
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
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.primary,
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
