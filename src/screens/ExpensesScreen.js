import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import fastApiService from '../services/fastApiService';
import OfflineIndicator from '../components/OfflineIndicator';
import ScreenWrapper from '../components/ScreenWrapper';
import LoadingState from '../components/LoadingState';
import { Ionicons } from '@expo/vector-icons';

const ExpensesScreen = ({ navigation, route }) => {
  // Context validation
  const authContext = useAuth();
  const themeContext = useTheme();
  const offlineContext = useOffline();

  if (!authContext || !themeContext || !offlineContext) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={{ fontSize: 14, color: '#666666', marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  const { user } = authContext;
  const { theme } = themeContext;
  const { isConnected } = offlineContext;

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState({
    category: null,
    startDate: null,
    endDate: null,
  });
  const [searchQuery, setSearchQuery] = useState('');

  const isMountedRef = useRef(true);

  // Load expenses when screen comes into focus (handles both initial load and navigation)
  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      loadExpenses(false);
      return () => {
        isMountedRef.current = false;
      };
    }, [])
  );

  const loadExpenses = async (showLoading = true) => {
    try {
      if (showLoading && isMountedRef.current) {
        setLoading(true);
      }

      // Build query parameters
      const params = {};
      if (filter.category) params.category = filter.category;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate) params.endDate = filter.endDate;
      if (searchQuery) params.supplier = searchQuery;

      // Use fastApiService unified endpoints
      const response = await fastApiService.getExpenses(params);

      if (response.success && isMountedRef.current) {
        setExpenses(response.data || []);
      }

      // Load summary
      const summaryResponse = await fastApiService.getExpensesSummary();
      if (summaryResponse.success && isMountedRef.current) {
        setSummary(summaryResponse.data || []);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      if (isMountedRef.current) {
        Alert.alert('Error', 'Failed to load expenses. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadExpenses(false);
  }, [filter, searchQuery]);

  const handleDeleteExpense = async (expenseId) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use fastApiService unified delete method
              const response = await fastApiService.deleteExpense(expenseId);
              if (response.success) {
                Alert.alert('Success', 'Expense deleted successfully');
                loadExpenses(false);
              } else {
                throw new Error(response.error || 'Delete failed');
              }
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', error.message || 'Failed to delete expense');
            }
          },
        },
      ]
    );
  };

  const getCategoryIcon = (category) => {
    const icons = {
      feed: 'nutrition',
      medication: 'medical',
      labor: 'people',
      utilities: 'flash',
      maintenance: 'build',
      equipment: 'hardware-chip',
      transport: 'car',
      packaging: 'cube',
      other: 'ellipsis-horizontal',
    };
    return icons[category] || 'cash';
  };

  const getCategoryColor = (category) => {
    const colors = {
      feed: '#FF9800',
      medication: '#F44336',
      labor: '#2196F3',
      utilities: '#FFEB3B',
      maintenance: '#9C27B0',
      equipment: '#00BCD4',
      transport: '#4CAF50',
      packaging: '#795548',
      other: '#607D8B',
    };
    return colors[category] || '#666';
  };

  const formatCurrency = (amount) => {
    return `UGX ${parseFloat(amount || 0).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderExpenseCard = ({ item }) => (
    <TouchableOpacity
      style={styles(theme).expenseCard}
      onPress={() => navigation.navigate('AddExpense', { expense: item })}
    >
      <View style={styles(theme).expenseHeader}>
        <View style={[styles(theme).categoryBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
          <Ionicons name={getCategoryIcon(item.category)} size={24} color={getCategoryColor(item.category)} />
        </View>
        <View style={styles(theme).expenseInfo}>
          <Text style={styles(theme).expenseDescription}>{item.description}</Text>
          <Text style={styles(theme).expenseCategory}>
            {item.category.toUpperCase()} {item.subcategory ? `• ${item.subcategory}` : ''}
          </Text>
        </View>
        <View style={styles(theme).expenseActions}>
          <Text style={styles(theme).expenseAmount}>{formatCurrency(item.amount)}</Text>
          <TouchableOpacity onPress={() => handleDeleteExpense(item.id)}>
            <Ionicons name="trash-outline" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles(theme).expenseFooter}>
        <Text style={styles(theme).expenseDate}>
          <Ionicons name="calendar-outline" size={12} /> {formatDate(item.expenseDate)}
        </Text>
        {item.supplier && (
          <Text style={styles(theme).expenseSupplier}>
            <Ionicons name="person-outline" size={12} /> {item.supplier}
          </Text>
        )}
        <Text style={styles(theme).paymentMethod}>
          <Ionicons name="card-outline" size={12} /> {item.paymentMethod?.replace('_', ' ').toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSummaryCard = () => {
    if (!summary || !Array.isArray(summary) || summary.length === 0) return null;

    const totalExpenses = summary.reduce((sum, cat) => sum + parseFloat(cat.totalAmount || 0), 0);

    return (
      <View style={styles(theme).summaryCard}>
        <Text style={styles(theme).summaryTitle}>Expense Summary</Text>
        <View style={styles(theme).totalExpenseContainer}>
          <Text style={styles(theme).totalExpenseLabel}>Total Expenses</Text>
          <Text style={styles(theme).totalExpenseAmount}>{formatCurrency(totalExpenses)}</Text>
        </View>
        <View style={styles(theme).categoryBreakdown}>
          {summary.slice(0, 3).map((cat, index) => (
            <View key={index} style={styles(theme).categoryItem}>
              <View style={styles(theme).categoryItemHeader}>
                <Ionicons name={getCategoryIcon(cat.category)} size={16} color={getCategoryColor(cat.category)} />
                <Text style={styles(theme).categoryItemName}>{cat.category}</Text>
              </View>
              <Text style={styles(theme).categoryItemAmount}>
                {formatCurrency(cat.totalAmount)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return <LoadingState message="Loading expenses..." />;
  }

  return (
    <ScreenWrapper>
      <View style={[styles(theme).container, { backgroundColor: theme.background }]}>
        <OfflineIndicator />

        {/* Header */}
        <View style={styles(theme).header}>
          <Text style={[styles(theme).headerTitle, { color: theme.text }]}>Expenses</Text>
          <TouchableOpacity
            style={styles(theme).addButton}
            onPress={() => navigation.navigate('AddExpense', { expense: null })}
          >
            <Ionicons name="add-circle" size={32} color="#2E8B57" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles(theme).searchContainer, { backgroundColor: theme.cardBackground }]}>
          <Ionicons name="search" size={20} color={theme.secondaryText} />
          <TextInput
            style={[styles(theme).searchInput, { color: theme.text }]}
            placeholder="Search by supplier..."
            placeholderTextColor={theme.secondaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => loadExpenses(false)}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); loadExpenses(false); }}>
              <Ionicons name="close-circle" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles(theme).filterContainer}>
          {['all', 'feed', 'medication', 'labor', 'utilities', 'equipment', 'other'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles(theme).filterPill,
                {
                  backgroundColor: filter.category === (cat === 'all' ? null : cat) ? '#2E8B57' : theme.cardBackground,
                },
              ]}
              onPress={() => {
                setFilter({ ...filter, category: cat === 'all' ? null : cat });
                setTimeout(() => loadExpenses(false), 100);
              }}
            >
              <Text
                style={[
                  styles(theme).filterPillText,
                  { color: filter.category === (cat === 'all' ? null : cat) ? '#FFF' : theme.text },
                ]}
              >
                {cat.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Summary Card */}
        {renderSummaryCard()}

        {/* Expenses List */}
        <FlatList
          data={expenses}
          renderItem={renderExpenseCard}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E8B57']} />}
          ListEmptyComponent={
            <View style={styles(theme).emptyState}>
              <Ionicons name="wallet-outline" size={64} color={theme.secondaryText} />
              <Text style={[styles(theme).emptyStateText, { color: theme.secondaryText }]}>No expenses recorded yet</Text>
              <TouchableOpacity
                style={styles(theme).emptyStateButton}
                onPress={() => navigation.navigate('AddExpense', { expense: null })}
              >
                <Text style={styles(theme).emptyStateButtonText}>Add First Expense</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={expenses.length === 0 ? styles(theme).emptyListContainer : styles(theme).listContainer}
        />
      </View>
    </ScreenWrapper>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
    maxHeight: 50,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    elevation: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  totalExpenseContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginBottom: 12,
  },
  totalExpenseLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  totalExpenseAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  categoryBreakdown: {
    gap: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  categoryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryItemName: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  categoryItemAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  expenseCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  expenseActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  expenseDate: {
    fontSize: 12,
  },
  expenseSupplier: {
    fontSize: 12,
  },
  paymentMethod: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#2E8B57',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: theme.colors.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ExpensesScreen;
