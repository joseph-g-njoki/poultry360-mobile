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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import fastApiService from '../services/fastApiService';
import ScreenWrapper from '../components/ScreenWrapper';
import OfflineIndicator from '../components/OfflineIndicator';

const InvoicesScreen = ({ navigation }) => {
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

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('all'); // all, paid, partial, overdue, draft

  const fetchInvoices = async () => {
    try {
      setLoading(true);

      // Build query params
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }

      const response = await fastApiService.get('/api/v1/invoices', { params });

      if (response && response.data) {
        setInvoices(response.data.data || []);
      }

      // Fetch summary
      const summaryResponse = await fastApiService.get('/api/v1/invoices/summary');
      if (summaryResponse && summaryResponse.data) {
        setSummary(summaryResponse.data);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      Alert.alert('Error', 'Failed to load invoices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchInvoices();
    }, [filter])
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return '#2E8B57';
      case 'partial':
        return '#FF8C00';
      case 'overdue':
        return '#DC143C';
      case 'draft':
        return '#808080';
      default:
        return '#4A90E2';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    return `UGX ${parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const renderInvoiceCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBackground }]}
      onPress={() => navigation.navigate('InvoiceDetails', { invoiceId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.invoiceNumber}>
          <Text style={[styles.invoiceNumberText, { color: theme.text }]}>
            {item.invoiceNumber}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[styles.amount, { color: theme.text }]}>
          {formatCurrency(item.total)}
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
            Due: {formatDate(item.dueDate)}
          </Text>
        </View>

        {item.amountDue > 0 && (
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={16} color="#DC143C" />
            <Text style={[styles.infoText, { color: '#DC143C' }]}>
              Outstanding: {formatCurrency(item.amountDue)}
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
          <Text style={styles.summaryLabel}>Total Invoiced</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#4A90E2' }]}>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalPaid)}</Text>
          <Text style={styles.summaryLabel}>Total Paid</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#FF8C00' }]}>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalDue)}</Text>
          <Text style={styles.summaryLabel}>Outstanding</Text>
        </View>
      </View>
    );
  };

  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {['all', 'paid', 'partial', 'overdue', 'draft'].map((filterOption) => (
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
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E8B57" />
          <Text style={styles.loadingText}>Loading invoices...</Text>
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
        <Text style={styles.headerTitle}>Invoices</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateInvoice')}
          style={styles.addButton}
        >
          <Ionicons name="add-circle" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {renderSummaryCards()}
      {renderFilterButtons()}

      <FlatList
        data={invoices}
        renderItem={renderInvoiceCard}
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
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No invoices found</Text>
            <Text style={styles.emptySubText}>
              Create your first invoice to get started
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invoiceNumber: {
    flex: 1,
  },
  invoiceNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  amount: {
    fontSize: 20,
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

export default InvoicesScreen;
