import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import CustomPicker from '../components/CustomPicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import { useFarms, useBatches } from '../context/DataStoreContext';
import fastApiService from '../services/fastApiService';
import ScreenWrapper from '../components/ScreenWrapper';
import { Ionicons } from '@expo/vector-icons';

const AddExpenseScreen = ({ navigation, route }) => {
  const { expense } = route.params || {};
  const isEditing = !!expense;

  const authContext = useAuth();
  const themeContext = useTheme();
  const offlineContext = useOffline();

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
  const { farms, loading: farmsLoading, refresh: refreshFarms } = useFarms();
  const { batches, loading: batchesLoading, refresh: refreshBatches } = useBatches();

  // Form state
  const [formData, setFormData] = useState({
    category: expense?.category || 'feed',
    subcategory: expense?.subcategory || '',
    description: expense?.description || '',
    amount: expense?.amount ? expense.amount.toString() : '',
    expenseDate: expense?.expenseDate ? new Date(expense.expenseDate) : new Date(),
    supplier: expense?.supplier || '',
    receiptNumber: expense?.receiptNumber || '',
    receiptUrl: expense?.receiptUrl || '',
    paymentMethod: expense?.paymentMethod || 'cash',
    notes: expense?.notes || '',
    farmId: expense?.farmId || null,
    batchId: expense?.batchId || null,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Filter batches by selected farm
  const filteredBatches = formData.farmId
    ? batches.filter(batch => batch.farmId === formData.farmId)
    : batches;

  const validateForm = () => {
    const newErrors = {};

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.description || formData.description.trim() === '') {
      newErrors.description = 'Description is required';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required';
    }

    if (!formData.expenseDate) {
      newErrors.expenseDate = 'Expense date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    if (!isConnected) {
      Alert.alert('Offline', 'You are offline. Expense will be saved when connection is restored.');
      // TODO: Save to offline queue
      return;
    }

    setSaving(true);

    try {
      // Format the date properly
      const formattedDate = formData.expenseDate.toISOString().split('T')[0];

      const payload = {
        ...formData,
        expenseDate: formattedDate,
        amount: parseFloat(formData.amount),
        farmId: formData.farmId || undefined,
        batchId: formData.batchId || undefined,
      };

      let response;
      if (isEditing) {
        response = await fastApiService.patch(`/expenses/${expense.id}`, payload);
      } else {
        response = await fastApiService.post('/expenses', payload);
      }

      if (response.success) {
        Alert.alert(
          'Success',
          `Expense ${isEditing ? 'updated' : 'created'} successfully`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        throw new Error(response.message || 'Failed to save expense');
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', error.message || 'Failed to save expense. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData({ ...formData, expenseDate: selectedDate });
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const categories = [
    { label: 'Feed', value: 'feed' },
    { label: 'Medication', value: 'medication' },
    { label: 'Labor', value: 'labor' },
    { label: 'Utilities', value: 'utilities' },
    { label: 'Maintenance', value: 'maintenance' },
    { label: 'Equipment', value: 'equipment' },
    { label: 'Transport', value: 'transport' },
    { label: 'Packaging', value: 'packaging' },
    { label: 'Other', value: 'other' },
  ];

  const paymentMethods = [
    { label: 'Cash', value: 'cash' },
    { label: 'Bank Transfer', value: 'bank_transfer' },
    { label: 'Mobile Money', value: 'mobile_money' },
    { label: 'Credit', value: 'credit' },
    { label: 'Debit Card', value: 'debit_card' },
    { label: 'Credit Card', value: 'credit_card' },
    { label: 'Check', value: 'check' },
    { label: 'Other', value: 'other' },
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {isEditing ? 'Edit Expense' : 'Add Expense'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          {/* Category */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Category <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.pickerContainer, { backgroundColor: theme.cardBackground }]}>
              <Picker
                selectedValue={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                style={[styles.picker, { color: theme.text }]}
              >
                {categories.map((cat) => (
                  <Picker.Item key={cat.value} label={cat.label} value={cat.value} />
                ))}
              </Picker>
            </View>
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
          </View>

          {/* Subcategory */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Subcategory</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text }]}
              placeholder="e.g., Grower Feed, Antibiotics"
              placeholderTextColor={theme.secondaryText}
              value={formData.subcategory}
              onChangeText={(text) => setFormData({ ...formData, subcategory: text })}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text }]}
              placeholder="Enter expense description"
              placeholderTextColor={theme.secondaryText}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={2}
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
          </View>

          {/* Amount */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Amount (UGX) <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text }]}
              placeholder="0.00"
              placeholderTextColor={theme.secondaryText}
              value={formData.amount}
              onChangeText={(text) => setFormData({ ...formData, amount: text })}
              keyboardType="decimal-pad"
            />
            {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
          </View>

          {/* Expense Date */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Expense Date <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: theme.cardBackground }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.text} />
              <Text style={[styles.dateButtonText, { color: theme.text }]}>{formatDate(formData.expenseDate)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={formData.expenseDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Supplier */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Supplier</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text }]}
              placeholder="Supplier name"
              placeholderTextColor={theme.secondaryText}
              value={formData.supplier}
              onChangeText={(text) => setFormData({ ...formData, supplier: text })}
            />
          </View>

          {/* Payment Method */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Payment Method</Text>
            <View style={[styles.pickerContainer, { backgroundColor: theme.cardBackground }]}>
              <Picker
                selectedValue={formData.paymentMethod}
                onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                style={[styles.picker, { color: theme.text }]}
              >
                {paymentMethods.map((method) => (
                  <Picker.Item key={method.value} label={method.label} value={method.value} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Receipt Number */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Receipt Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text }]}
              placeholder="Receipt/Invoice number"
              placeholderTextColor={theme.secondaryText}
              value={formData.receiptNumber}
              onChangeText={(text) => setFormData({ ...formData, receiptNumber: text })}
            />
          </View>

          {/* Farm (Optional) */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Farm (Optional)</Text>
            <View style={[styles.pickerContainer, { backgroundColor: theme.cardBackground }]}>
              <Picker
                selectedValue={formData.farmId ? String(formData.farmId) : ''}
                onValueChange={(value) => setFormData({ ...formData, farmId: value === '' ? null : parseInt(value), batchId: null })}
                style={[styles.picker, { color: theme.text }]}
              >
                <Picker.Item
                  label={Array.isArray(farms) && farms.length === 0 ? "No farms - Create a farm first" : "-- Select Farm --"}
                  value=""
                />
                {Array.isArray(farms) && farms
                  .filter(farm => farm && (farm.id || farm._id))
                  .map((farm) => (
                    <Picker.Item
                      key={farm.id || farm._id}
                      label={farm.location ? `${farm.farmName || farm.name || 'Unnamed Farm'} - ${farm.location}` : (farm.farmName || farm.name || 'Unnamed Farm')}
                      value={String(farm.id || farm._id)}
                    />
                  ))}
              </Picker>
            </View>
          </View>

          {/* Batch (Optional) */}
          {formData.farmId && (
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Batch (Optional)</Text>
              <View style={[styles.pickerContainer, { backgroundColor: theme.cardBackground }]}>
                <Picker
                  selectedValue={formData.batchId ? String(formData.batchId) : ''}
                  onValueChange={(value) => setFormData({ ...formData, batchId: value === '' ? null : parseInt(value) })}
                  style={[styles.picker, { color: theme.text }]}
                >
                  <Picker.Item
                    label={Array.isArray(filteredBatches) && filteredBatches.length === 0 ? "No batches for this farm" : "-- Select Batch --"}
                    value=""
                  />
                  {Array.isArray(filteredBatches) && filteredBatches
                    .filter(batch => batch && (batch.id || batch._id))
                    .map((batch) => (
                      <Picker.Item
                        key={batch.id || batch._id}
                        label={batch.breed && batch.currentCount ? `${batch.batchName || batch.name || 'Unnamed Batch'} - ${batch.breed} (${batch.currentCount} birds)` : (batch.batchName || batch.name || 'Unnamed Batch')}
                        value={String(batch.id || batch._id)}
                      />
                    ))}
                </Picker>
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.cardBackground, color: theme.text }]}
              placeholder="Additional notes..."
              placeholderTextColor={theme.secondaryText}
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveButtonText}>{isEditing ? 'Update Expense' : 'Save Expense'}</Text>
            )}
          </TouchableOpacity>

          {/* Delete Button (only when editing) */}
          {isEditing && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const response = await fastApiService.delete(`/expenses/${expense.id}`);
                        if (response.success) {
                          Alert.alert('Success', 'Expense deleted successfully', [
                            { text: 'OK', onPress: () => navigation.goBack() },
                          ]);
                        }
                      } catch (error) {
                        Alert.alert('Error', 'Failed to delete expense');
                      }
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.deleteButtonText}>Delete Expense</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 14,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#2E8B57',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddExpenseScreen;
