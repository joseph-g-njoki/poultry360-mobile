import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

const CustomersScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/customers?page=1&limit=100');

      if (response.data && response.data.data) {
        setCustomers(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      Alert.alert('Error', 'Failed to load customers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCustomers();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchCustomers();
    }, [])
  );

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery) ||
    (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatCurrency = (amount) => {
    return `UGX ${Number(amount).toLocaleString()}`;
  };

  const getCustomerTypeColor = (type) => {
    switch (type) {
      case 'retail':
        return '#3B82F6';
      case 'wholesale':
        return '#8B5CF6';
      case 'distributor':
        return '#EC4899';
      default:
        return '#6B7280';
    }
  };

  const renderCustomerItem = ({ item }) => (
    <TouchableOpacity
      style={styles(theme).customerCard}
      onPress={() => navigation.navigate('CustomerDetails', { customerId: item.id })}
    >
      <View style={styles(theme).customerHeader}>
        <View style={styles(theme).avatarContainer}>
          <Text style={styles(theme).avatarText}>
            {item.name.substring(0, 2).toUpperCase()}
          </Text>
        </View>

        <View style={styles(theme).customerInfo}>
          <Text style={styles(theme).customerName}>{item.name}</Text>
          <View style={styles(theme).contactRow}>
            <Ionicons name="call-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles(theme).contactText}>{item.phone}</Text>
          </View>
          {item.email && (
            <View style={styles(theme).contactRow}>
              <Ionicons name="mail-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={styles(theme).contactText}>{item.email}</Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles(theme).typeBadge,
            { backgroundColor: getCustomerTypeColor(item.customerType) },
          ]}
        >
          <Text style={styles(theme).typeText}>
            {item.customerType.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles(theme).statsSection}>
        <View style={styles(theme).statItem}>
          <Ionicons name="receipt-outline" size={20} color={theme.colors.textSecondary} />
          <Text style={styles(theme).statLabel}>Orders</Text>
          <Text style={styles(theme).statValue}>{item.totalOrders || 0}</Text>
        </View>

        <View style={styles(theme).statDivider} />

        <View style={styles(theme).statItem}>
          <Ionicons name="cash-outline" size={20} color="#22C55E" />
          <Text style={styles(theme).statLabel}>Total Sales</Text>
          <Text style={styles(theme).statValue}>
            {formatCurrency(item.totalSales || 0)}
          </Text>
        </View>

        <View style={styles(theme).statDivider} />

        <View style={styles(theme).statItem}>
          <Ionicons name="wallet-outline" size={20} color="#F59E0B" />
          <Text style={styles(theme).statLabel}>Balance</Text>
          <Text style={styles(theme).statValue}>
            {formatCurrency(item.balance || 0)}
          </Text>
        </View>
      </View>

      {item.lastPurchaseDate && (
        <View style={styles(theme).lastPurchaseRow}>
          <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles(theme).lastPurchaseText}>
            Last purchase: {new Date(item.lastPurchaseDate).toLocaleDateString('en-GB')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Loading customers...</Text>
      </View>
    );
  }

  return (
    <View style={styles(theme).container}>
      <View style={styles(theme).searchContainer}>
        <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={styles(theme).searchInput}
          placeholder="Search customers..."
          placeholderTextColor={theme.colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomerItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles(theme).emptyContainer}>
            <Ionicons name="people-outline" size={64} color={theme.colors.border} />
            <Text style={styles(theme).emptyText}>
              {searchQuery ? 'No customers found' : 'No customers yet'}
            </Text>
            <Text style={styles(theme).emptySubtext}>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Tap the + button to add your first customer'}
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
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <AddCustomerModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          fetchCustomers();
        }}
      />
    </View>
  );
};

const AddCustomerModal = ({ visible, onClose, onSuccess }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    customerType: 'retail',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.email) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/v1/customers', formData);
      Alert.alert('Success', 'Customer added successfully');
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        taxId: '',
        customerType: 'retail',
        notes: '',
      });
      onSuccess();
    } catch (error) {
      console.error('Error creating customer:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to create customer'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles(theme).modalOverlay}>
        <View style={styles(theme).modalContent}>
          <View style={styles(theme).modalHeader}>
            <Text style={styles(theme).modalTitle}>Add New Customer</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles(theme).modalBody}>
            <View style={styles(theme).inputGroup}>
              <Text style={styles(theme).label}>Name *</Text>
              <TextInput
                style={styles(theme).input}
                value={formData.name}
                onChangeText={(value) => setFormData({ ...formData, name: value })}
                placeholder="Enter customer name"
                placeholderTextColor={theme.colors.placeholder}
              />
            </View>

            <View style={styles(theme).inputGroup}>
              <Text style={styles(theme).label}>Email *</Text>
              <TextInput
                style={styles(theme).input}
                value={formData.email}
                onChangeText={(value) => setFormData({ ...formData, email: value })}
                placeholder="Enter email address"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles(theme).inputGroup}>
              <Text style={styles(theme).label}>Phone *</Text>
              <TextInput
                style={styles(theme).input}
                value={formData.phone}
                onChangeText={(value) => setFormData({ ...formData, phone: value })}
                placeholder="Enter phone number"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles(theme).inputGroup}>
              <Text style={styles(theme).label}>Address</Text>
              <TextInput
                style={styles(theme).input}
                value={formData.address}
                onChangeText={(value) => setFormData({ ...formData, address: value })}
                placeholder="Enter address (optional)"
                placeholderTextColor={theme.colors.placeholder}
              />
            </View>

            <View style={styles(theme).inputGroup}>
              <Text style={styles(theme).label}>Customer Type</Text>
              <View style={styles(theme).typeButtons}>
                {['retail', 'wholesale', 'distributor'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles(theme).typeButton,
                      formData.customerType === type && styles(theme).typeButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, customerType: type })}
                  >
                    <Text
                      style={[
                        styles(theme).typeButtonText,
                        formData.customerType === type && styles(theme).typeButtonTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles(theme).modalFooter}>
            <TouchableOpacity
              style={styles(theme).cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles(theme).cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles(theme).submitButton, loading && styles(theme).submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles(theme).submitButtonText}>Add Customer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 80,
  },
  customerCard: {
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
  customerHeader: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customerInfo: {
    flex: 1,
    gap: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsSection: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  lastPurchaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastPurchaseText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  modalBody: {
    padding: 20,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.inputText,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  submitButton: {
    flex: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CustomersScreen;
