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
      style={[styles(theme).card, { backgroundColor: theme.cardBackground }]}
      onPress={() => navigation.navigate('InvoiceDetails', { invoiceId: item.id })}
    >
      <View style={styles(theme).cardHeader}>
        <View style={styles(theme).invoiceNumber}>
          <Text style={[styles(theme).invoiceNumberText, { color: theme.text }]}>
            {item.invoiceNumber}
          </Text>
          <View style={[styles(theme).statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles(theme).statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[styles(theme).amount, { color: theme.text }]}>
          {formatCurrency(item.total)}
        </Text>
      </View>

      <View style={styles(theme).cardBody}>
        <View style={styles(theme).infoRow}>
          <Ionicons name="person-outline" size={16} color={theme.subText} />
          <Text style={[styles(theme).infoText, { color: theme.subText }]}>
            {item.customer?.name || 'Unknown Customer'}
          </Text>
        </View>

        <View style={styles(theme).infoRow}>
          <Ionicons name="calendar-outline" size={16} color={theme.subText} />
          <Text style={[styles(theme).infoText, { color: theme.subText }]}>
            Due: {formatDate(item.dueDate)}
          </Text>
        </View>

        {item.amountDue > 0 && (
          <View style={styles(theme).infoRow}>
            <Ionicons name="cash-outline" size={16} color="#DC143C" />
            <Text style={[styles(theme).infoText, { color: '#DC143C' }]}>
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
      <View style={styles(theme).summaryContainer}>
        <View style={[styles(theme).summaryCard, { backgroundColor: '#2E8B57' }]}>
          <Text style={styles(theme).summaryValue}>{formatCurrency(summary.totalAmount)}</Text>
          <Text style={styles(theme).summaryLabel}>Total Invoiced</Text>
        </View>

        <View style={[styles(theme).summaryCard, { backgroundColor: '#4A90E2' }]}>
          <Text style={styles(theme).summaryValue}>{formatCurrency(summary.totalPaid)}</Text>
          <Text style={styles(theme).summaryLabel}>Total Paid</Text>
        </View>

        <View style={[styles(theme).summaryCard, { backgroundColor: '#FF8C00' }]}>
          <Text style={styles(theme).summaryValue}>{formatCurrency(summary.totalDue)}</Text>
          <Text style={styles(theme).summaryLabel}>Outstanding</Text>
        </View>
      </View>
    );
  };

  const renderFilterButtons = () => (
    <View style={styles(theme).filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {['all', 'paid', 'partial', 'overdue', 'draft'].map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles(theme).filterButton,
              filter === filterOption && styles(theme).filterButtonActive,
            ]}
            onPress={() => setFilter(filterOption)}
          >
            <Text
              style={[
                styles(theme).filterButtonText,
                filter === filterOption && styles(theme).filterButtonTextActive,
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
        <View style={styles(theme).loadingContainer}>
          <ActivityIndicator size="large" color="#2E8B57" />
          <Text style={styles(theme).loadingText}>Loading invoices...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <OfflineIndicator />

      <View style={[styles(theme).header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles(theme).backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles(theme).headerTitle}>Invoices</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateInvoice')}
          style={styles(theme).addButton}
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
        contentContainerStyle={styles(theme).listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2E8B57']}
            tintColor="#2E8B57"
          />
        }
        ListEmptyComponent={
          <View style={styles(theme).emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles(theme).emptyText}>No invoices found</Text>
            <Text style={styles(theme).emptySubText}>
              Create your first invoice to get started
            </Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
};

const styles = (theme) => StyleSheet.create({
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
    color: theme.colors.buttonText,
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
    color: theme.colors.buttonText,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.buttonText,
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
    color: theme.colors.textSecondary,
  },
  filterButtonTextActive: {
    color: theme.colors.buttonText,
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
    color: theme.colors.buttonText,
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
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
});

export default InvoicesScreen;
