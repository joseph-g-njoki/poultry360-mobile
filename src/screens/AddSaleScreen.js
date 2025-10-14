import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomPicker from '../components/CustomPicker';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useBatches } from '../context/DataStoreContext';

const AddSaleScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { batches, loading: batchesLoading, refresh: refreshBatches } = useBatches();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    batchId: '',
    saleDate: new Date(),
    productType: 'birds',
    quantity: '',
    unit: 'birds',
    unitPrice: '',
    totalAmount: '',
    paymentStatus: 'paid',
    amountPaid: '',
    amountDue: '0',
    paymentMethod: 'cash',
    paymentDate: new Date(),
    notes: '',
    invoiceNumber: '',
    deliveryAddress: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Add a useEffect to reload data when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('🔄 AddSaleScreen: Screen focused - reloading data');
      fetchCustomers();
      refreshBatches(true);
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    calculateTotalAmount();
  }, [formData.quantity, formData.unitPrice]);

  useEffect(() => {
    calculateAmountDue();
  }, [formData.totalAmount, formData.amountPaid]);

  const fetchCustomers = async () => {
    try {
      console.log('🔄 AddSaleScreen: Fetching customers...');
      const customersResponse = await api.get('/api/v1/customers?limit=100');

      if (customersResponse.data?.data) {
        setCustomers(customersResponse.data.data);
        console.log(`✅ AddSaleScreen: Loaded ${customersResponse.data.data.length} customers`);
      } else {
        setCustomers([]);
        console.log('ℹ️ AddSaleScreen: No customers found');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
    }
  };

  const calculateTotalAmount = () => {
    const quantity = parseFloat(formData.quantity) || 0;
    const unitPrice = parseFloat(formData.unitPrice) || 0;
    const total = quantity * unitPrice;
    setFormData((prev) => ({ ...prev, totalAmount: total.toString() }));
  };

  const calculateAmountDue = () => {
    const total = parseFloat(formData.totalAmount) || 0;
    const paid = parseFloat(formData.amountPaid) || 0;
    const due = Math.max(0, total - paid);
    setFormData((prev) => ({ ...prev, amountDue: due.toString() }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid quantity');
      return;
    }

    if (!formData.unitPrice || parseFloat(formData.unitPrice) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid unit price');
      return;
    }

    try {
      setLoading(true);

      const saleData = {
        customerId: formData.customerId || undefined,
        batchId: formData.batchId || undefined,
        saleDate: formData.saleDate.toISOString(),
        productType: formData.productType,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        unitPrice: parseFloat(formData.unitPrice),
        totalAmount: parseFloat(formData.totalAmount),
        paymentStatus: formData.paymentStatus,
        amountPaid: parseFloat(formData.amountPaid) || 0,
        amountDue: parseFloat(formData.amountDue) || 0,
        paymentMethod: formData.paymentMethod,
        paymentDate:
          formData.paymentStatus === 'paid'
            ? formData.paymentDate.toISOString()
            : undefined,
        notes: formData.notes || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        deliveryAddress: formData.deliveryAddress || undefined,
      };

      await api.post('/api/v1/sales', saleData);

      Alert.alert('Success', 'Sale recorded successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error creating sale:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to create sale. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label, field, placeholder, keyboardType = 'default', multiline = false) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={formData[field]}
        onChangeText={(value) => setFormData({ ...formData, [field]: value })}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );

  const renderPicker = (label, field, options) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <CustomPicker
        selectedValue={formData[field]}
        onValueChange={(value) => setFormData({ ...formData, [field]: value })}
        items={options}
        placeholder={`Select ${label.toLowerCase()}`}
      />
    </View>
  );

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer & Product</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer (Optional)</Text>
            <CustomPicker
              selectedValue={String(formData.customerId)}
              onValueChange={(value) =>
                setFormData({ ...formData, customerId: value === '' ? '' : parseInt(value) })
              }
              items={[
                { label: Array.isArray(customers) && customers.length === 0 ? "No customers - Walk-in sale" : "Walk-in Customer", value: "" },
                ...((Array.isArray(customers) ? customers : []).filter(customer => customer && customer.id).map(customer => ({
                  label: customer.phone ? `${customer.name} - ${customer.phone}` : customer.name,
                  value: String(customer.id)
                })))
              ]}
              placeholder="Select customer"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Batch (Optional)</Text>
            <CustomPicker
              selectedValue={String(formData.batchId)}
              onValueChange={(value) =>
                setFormData({ ...formData, batchId: value === '' ? '' : parseInt(value) })
              }
              items={[
                { label: Array.isArray(batches) && batches.length === 0 ? "No batches - Create a batch first" : "-- Select Batch --", value: "" },
                ...((Array.isArray(batches) ? batches : [])
                  .filter(batch => batch && (batch.id || batch._id))
                  .map(batch => ({
                    label: batch.breed && batch.currentCount ? `${batch.batchName || batch.name || 'Unnamed Batch'} - ${batch.breed} (${batch.currentCount} birds)` : (batch.batchName || batch.name || `Batch ${batch.id || batch._id}`),
                    value: String(batch.id || batch._id)
                  })))
              ]}
              placeholder="Select batch"
            />
          </View>

          {renderPicker('Product Type', 'productType', [
            { label: 'Birds', value: 'birds' },
            { label: 'Eggs', value: 'eggs' },
            { label: 'Meat', value: 'meat' },
            { label: 'Other', value: 'other' },
          ])}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Sale Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
              <Text style={styles.dateText}>
                {formData.saleDate.toLocaleDateString('en-GB')}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={formData.saleDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) {
                    setFormData({ ...formData, saleDate: date });
                  }
                }}
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quantity & Pricing</Text>

          {renderInput('Quantity', 'quantity', 'Enter quantity', 'numeric')}
          {renderInput('Unit', 'unit', 'e.g., birds, kg, trays', 'default')}
          {renderInput('Unit Price', 'unitPrice', 'Enter price per unit', 'numeric')}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Total Amount</Text>
            <View style={styles.totalAmountContainer}>
              <Text style={styles.totalAmountText}>
                UGX {parseFloat(formData.totalAmount || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>

          {renderPicker('Payment Status', 'paymentStatus', [
            { label: 'Paid', value: 'paid' },
            { label: 'Pending', value: 'pending' },
            { label: 'Partial', value: 'partial' },
          ])}

          {renderPicker('Payment Method', 'paymentMethod', [
            { label: 'Cash', value: 'cash' },
            { label: 'Mobile Money', value: 'mobile_money' },
            { label: 'Bank Transfer', value: 'bank_transfer' },
            { label: 'Credit', value: 'credit' },
            { label: 'Other', value: 'other' },
          ])}

          {renderInput('Amount Paid', 'amountPaid', 'Enter amount paid', 'numeric')}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount Due</Text>
            <View style={styles.amountDueContainer}>
              <Text style={styles.amountDueText}>
                UGX {parseFloat(formData.amountDue || 0).toLocaleString()}
              </Text>
            </View>
          </View>

          {formData.paymentStatus === 'paid' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowPaymentDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.dateText}>
                  {formData.paymentDate.toLocaleDateString('en-GB')}
                </Text>
              </TouchableOpacity>
              {showPaymentDatePicker && (
                <DateTimePicker
                  value={formData.paymentDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowPaymentDatePicker(Platform.OS === 'ios');
                    if (date) {
                      setFormData({ ...formData, paymentDate: date });
                    }
                  }}
                />
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          {renderInput('Invoice Number', 'invoiceNumber', 'Enter invoice number (optional)')}
          {renderInput('Delivery Address', 'deliveryAddress', 'Enter delivery address (optional)')}
          {renderInput('Notes', 'notes', 'Enter any additional notes', 'default', true)}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Record Sale</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.inputText,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: theme.colors.inputText,
  },
  dateButton: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    color: theme.colors.inputText,
  },
  totalAmountContainer: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  totalAmountText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  amountDueContainer: {
    backgroundColor: theme.colors.error + '20',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  amountDueText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.error,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.inputBackground,
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
    backgroundColor: theme.colors.success,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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

export default AddSaleScreen;
