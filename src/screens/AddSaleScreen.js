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
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';

const AddSaleScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [batches, setBatches] = useState([]);

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
    fetchCustomersAndBatches();
  }, []);

  // Add a useEffect to reload data when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('🔄 AddSaleScreen: Screen focused - reloading data');
      fetchCustomersAndBatches();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    calculateTotalAmount();
  }, [formData.quantity, formData.unitPrice]);

  useEffect(() => {
    calculateAmountDue();
  }, [formData.totalAmount, formData.amountPaid]);

  const fetchCustomersAndBatches = async () => {
    try {
      console.log('🔄 AddSaleScreen: Fetching customers and batches...');
      const [customersResponse, batchesResponse] = await Promise.all([
        api.get('/api/v1/customers?limit=100'),
        api.get('/api/v1/batches?status=active'),
      ]);

      if (customersResponse.data?.data) {
        setCustomers(customersResponse.data.data);
        console.log(`✅ AddSaleScreen: Loaded ${customersResponse.data.data.length} customers`);
      } else {
        setCustomers([]);
        console.log('ℹ️ AddSaleScreen: No customers found');
      }

      if (batchesResponse.data) {
        const batchesData = Array.isArray(batchesResponse.data) ? batchesResponse.data : [];
        setBatches(batchesData);
        console.log(`✅ AddSaleScreen: Loaded ${batchesData.length} batches`);
      } else {
        setBatches([]);
        console.log('ℹ️ AddSaleScreen: No batches found');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setCustomers([]);
      setBatches([]);
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
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={formData[field]}
          onValueChange={(value) => setFormData({ ...formData, [field]: value })}
          style={styles.picker}
        >
          {options.map((option) => (
            <Picker.Item
              key={option.value}
              label={option.label}
              value={option.value}
            />
          ))}
        </Picker>
      </View>
    </View>
  );

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
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={String(formData.customerId)}
                onValueChange={(value) =>
                  setFormData({ ...formData, customerId: value === '' ? '' : parseInt(value) })
                }
                style={styles.picker}
              >
                <Picker.Item
                  label={Array.isArray(customers) && customers.length === 0 ? "No customers - Walk-in sale" : "Walk-in Customer"}
                  value=""
                />
                {Array.isArray(customers) && customers.map((customer) => (
                  customer && customer.id ? (
                    <Picker.Item
                      key={customer.id}
                      label={customer.phone ? `${customer.name} - ${customer.phone}` : customer.name}
                      value={String(customer.id)}
                    />
                  ) : null
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Batch (Optional)</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={String(formData.batchId)}
                onValueChange={(value) =>
                  setFormData({ ...formData, batchId: value === '' ? '' : parseInt(value) })
                }
                style={styles.picker}
              >
                <Picker.Item
                  label={Array.isArray(batches) && batches.length === 0 ? "No batches available - Create a batch first" : "No Batch"}
                  value=""
                />
                {Array.isArray(batches) && batches.map((batch) => (
                  batch && batch.id ? (
                    <Picker.Item
                      key={batch.id}
                      label={batch.batchNumber && batch.breed ? `${batch.batchNumber} - ${batch.breed} (${batch.currentQuantity || batch.quantity || 0} birds)` : `Batch ${batch.id}`}
                      value={String(batch.id)}
                    />
                  ) : null
                ))}
              </Picker>
            </View>
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
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
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
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
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
            <ActivityIndicator color="#FFFFFF" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#111827',
  },
  totalAmountContainer: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  totalAmountText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E40AF',
  },
  amountDueContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  amountDueText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#10B981',
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
