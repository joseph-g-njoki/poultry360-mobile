import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import CustomPicker from '../components/CustomPicker';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOptimizedFlatList } from '../hooks/useOptimizedFlatList';
import { useBatches } from '../context/DataStoreContext';

const VaccinationScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();

  // Use centralized context for batches (auto-loads and updates)
  const { batches, loading: batchesLoading, refresh: refreshBatches } = useBatches();

  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVaccination, setEditingVaccination] = useState(null);
  const [formData, setFormData] = useState({
    batchId: '',
    vaccinationType: '',
    vaccinationDate: '',
    medication: '',
    notes: '',
  });

  const isMountedRef = useRef(true);
  const flatListProps = useOptimizedFlatList(250);

  // Common vaccination types
  const vaccinationTypes = [
    'Newcastle Disease (ND)',
    'Infectious Bronchitis (IB)',
    'Gumboro (IBD)',
    'Marek\'s Disease',
    'Fowl Pox',
    'Avian Influenza',
    'Infectious Coryza',
    'Fowl Cholera',
    'Other',
  ];

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = async (showLoadingIndicator = true) => {
    if (!isMountedRef.current) return;

    try {
      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(true);
      }

      // Load vaccinations (batches come from context)
      const vaccinationsResponse = await apiService.getVaccinations();

      if (!isMountedRef.current) return;

      setVaccinations(Array.isArray(vaccinationsResponse) ? vaccinationsResponse : []);

      console.log(`✅ Loaded ${vaccinationsResponse?.length || 0} vaccinations`);
    } catch (error) {
      console.error('❌ Vaccinations load error:', error.message);
      if (isMountedRef.current) {
        setVaccinations([]);
        Alert.alert(
          'Data Load Error',
          'Unable to load vaccination records. Please check your connection and try refreshing.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      if (isMountedRef.current) {
        setRefreshing(true);
      }
      // Refresh batches from context
      refreshBatches(true);
      await loadData(false);
    } catch (error) {
      console.warn('⚠️ Refresh error:', error.message);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [refreshBatches]);

  const openModal = (vaccination = null) => {
    const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';
    if (!isManager) {
      Alert.alert('Access Denied', 'Only managers can create or edit vaccination records.');
      return;
    }

    setEditingVaccination(vaccination);
    setFormData({
      batchId: vaccination?.batchId?.toString() || (batches.length > 0 ? batches[0].id.toString() : ''),
      vaccinationType: vaccination?.vaccinationType || '',
      vaccinationDate: vaccination?.vaccinationDate
        ? new Date(vaccination.vaccinationDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      medication: vaccination?.medication || '',
      notes: vaccination?.notes || '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingVaccination(null);
    setFormData({
      batchId: '',
      vaccinationType: '',
      vaccinationDate: '',
      medication: '',
      notes: '',
    });
  };

  const handleSaveVaccination = async () => {
    // Validation
    if (!formData.batchId || formData.batchId === '' || formData.batchId === 'null') {
      Alert.alert('Validation Error', 'Please select a batch');
      return;
    }

    if (!formData.vaccinationType || formData.vaccinationType.trim() === '') {
      Alert.alert('Validation Error', 'Please select a vaccination type');
      return;
    }

    if (!formData.vaccinationDate || formData.vaccinationDate.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the vaccination date');
      return;
    }

    const batchIdNum = parseInt(formData.batchId, 10);
    if (isNaN(batchIdNum) || batchIdNum <= 0) {
      Alert.alert('Validation Error', 'Invalid batch selected');
      return;
    }

    // Validate date format
    let isoDate;
    try {
      if (formData.vaccinationDate.includes('T')) {
        isoDate = formData.vaccinationDate;
      } else {
        const dateObj = new Date(formData.vaccinationDate + 'T00:00:00.000Z');
        if (isNaN(dateObj.getTime())) {
          throw new Error('Invalid date');
        }
        isoDate = dateObj.toISOString();
      }
    } catch (dateError) {
      Alert.alert('Validation Error', 'Invalid date format. Please use YYYY-MM-DD format');
      return;
    }

    const vaccinationData = {
      batchId: batchIdNum,
      vaccinationType: formData.vaccinationType.trim(),
      date: isoDate,
      vaccinationDate: isoDate,
      medication: formData.medication.trim() || undefined,
      notes: formData.notes.trim() || '',
    };

    try {
      let response;
      if (editingVaccination) {
        response = await apiService.updateVaccination(editingVaccination.id, vaccinationData);
        if (response.message || response.data) {
          Alert.alert('Success', 'Vaccination record updated successfully!');
        }
      } else {
        response = await apiService.createVaccination(vaccinationData);
        if (response.message || response.data) {
          Alert.alert('Success', 'Vaccination record created successfully!');
        }
      }

      closeModal();
      await loadData();
    } catch (error) {
      console.error('❌ Save vaccination error:', error);
      Alert.alert('Error Saving Vaccination', error.message || 'An unexpected error occurred');
    }
  };

  const handleDeleteVaccination = (vaccination) => {
    const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';
    if (!isManager) {
      Alert.alert('Access Denied', 'Only managers can delete vaccination records.');
      return;
    }

    Alert.alert(
      'Delete Vaccination Record',
      `Are you sure you want to delete this vaccination record?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteVaccination(vaccination.id);
              Alert.alert('Success', 'Vaccination record deleted successfully!');
              await loadData();
            } catch (error) {
              console.error('Delete vaccination error:', error);
              Alert.alert('Error', error.message || 'Failed to delete vaccination record');
            }
          },
        },
      ]
    );
  };

  const getBatchName = (batchId) => {
    if (!batchId || !Array.isArray(batches)) return 'Unknown Batch';
    const batch = batches.find(b => b && b.id === batchId);
    return batch?.batchName || batch?.name || 'Unknown Batch';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const renderVaccinationCard = ({ item }) => {
    if (!item) return null;

    return (
      <View style={[styles(theme).vaccinationCard, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}>
        <View style={[styles(theme).cardHeader, { borderBottomColor: theme.colors.border }]}>
          <View style={styles(theme).cardTitleRow}>
            <Text style={[styles(theme).vaccinationType, { color: theme.colors.primary }]}>
              {item.vaccinationType || 'Unknown Type'}
            </Text>
            <View style={[styles(theme).statusBadge, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles(theme).statusIcon}>💉</Text>
              <Text style={[styles(theme).statusText, { color: theme.colors.buttonText }]}>Vaccinated</Text>
            </View>
          </View>
          <View style={styles(theme).cardActions}>
            {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') && (
              <>
                <TouchableOpacity style={styles(theme).editButton} onPress={() => openModal(item)}>
                  <Text style={styles(theme).editButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles(theme).deleteButton} onPress={() => handleDeleteVaccination(item)}>
                  <Text style={styles(theme).deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles(theme).cardDetails}>
          <View style={styles(theme).detailRow}>
            <Text style={[styles(theme).detailLabel, { color: theme.colors.textSecondary }]}>🐔 Batch:</Text>
            <Text style={[styles(theme).detailValue, { color: theme.colors.text }]}>{getBatchName(item.batchId)}</Text>
          </View>

          <View style={styles(theme).detailRow}>
            <Text style={[styles(theme).detailLabel, { color: theme.colors.textSecondary }]}>📅 Date:</Text>
            <Text style={[styles(theme).detailValue, { color: theme.colors.text }]}>{formatDate(item.vaccinationDate || item.date)}</Text>
          </View>

          {item.medication && (
            <View style={styles(theme).detailRow}>
              <Text style={[styles(theme).detailLabel, { color: theme.colors.textSecondary }]}>💊 Medication:</Text>
              <Text style={[styles(theme).detailValue, { color: theme.colors.text }]}>{item.medication}</Text>
            </View>
          )}

          {item.notes && (
            <View style={[styles(theme).notesContainer, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles(theme).notesLabel, { color: theme.colors.textSecondary }]}>📝 Notes:</Text>
              <Text style={[styles(theme).notesText, { color: theme.colors.text }]}>{item.notes}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles(theme).loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles(theme).loadingText, { color: theme.colors.textSecondary }]}>Loading Vaccinations...</Text>
      </View>
    );
  }

  return (
    <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles(theme).header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles(theme).headerTitle, { color: theme.colors.text }]}>Vaccination Records</Text>
        {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') && (
          <TouchableOpacity style={[styles(theme).addButton, { backgroundColor: theme.colors.primary }]} onPress={() => openModal()}>
            <Text style={styles(theme).addButtonText}>+ Add Vaccination</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Vaccinations List */}
      {!Array.isArray(vaccinations) || vaccinations.length === 0 ? (
        <View style={styles(theme).emptyContainer}>
          <Text style={styles(theme).emptyIcon}>💉</Text>
          <Text style={[styles(theme).emptyTitle, { color: theme.colors.text }]}>No Vaccination Records</Text>
          <Text style={[styles(theme).emptyText, { color: theme.colors.textSecondary }]}>
            {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner')
              ? 'Start tracking vaccinations for your flocks to maintain health records'
              : 'No vaccination records have been created yet'}
          </Text>
          {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') && (
            <TouchableOpacity style={[styles(theme).emptyButton, { backgroundColor: theme.colors.primary }]} onPress={() => openModal()}>
              <Text style={styles(theme).emptyButtonText}>Add First Vaccination</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={vaccinations}
          renderItem={renderVaccinationCard}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={styles(theme).vaccinationsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          {...flatListProps}
        />
      )}

      {/* Add/Edit Vaccination Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={[styles(theme).modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles(theme).modalContent, { backgroundColor: theme.colors.surface }]}>
            <ScrollView>
              <Text style={[styles(theme).modalTitle, { color: theme.colors.text }]}>
                {editingVaccination ? 'Edit Vaccination' : 'Add New Vaccination'}
              </Text>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Batch *</Text>
                <CustomPicker
                  selectedValue={String(formData.batchId)}
                  onValueChange={(itemValue) => setFormData(prev => ({ ...prev, batchId: itemValue }))}
                  items={Array.isArray(batches) && batches.length > 0
                    ? batches.filter(batch => batch && (batch.id || batch._id)).map((batch) => ({
                        label: batch.breed && batch.currentCount ? `${batch.batchName || batch.name || 'Unnamed Batch'} - ${batch.breed} (${batch.currentCount} birds)` : (batch.batchName || batch.name || 'Unnamed Batch'),
                        value: String(batch.id || batch._id)
                      }))
                    : []
                  }
                  placeholder={Array.isArray(batches) && batches.length === 0 ? "No batches - Create a batch first" : "-- Select a batch --"}
                />
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Vaccination Type *</Text>
                <CustomPicker
                  selectedValue={formData.vaccinationType}
                  onValueChange={(itemValue) => setFormData(prev => ({ ...prev, vaccinationType: itemValue }))}
                  items={vaccinationTypes.map((type) => ({ label: type, value: type }))}
                  placeholder="Select vaccination type"
                />
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Vaccination Date *</Text>
                <TextInput
                  style={[styles(theme).formInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.inputText }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.vaccinationDate}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, vaccinationDate: text }))}
                />
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Medication/Vaccine Name</Text>
                <TextInput
                  style={[styles(theme).formInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.inputText }]}
                  placeholder="e.g., Lasota, Gumboro vaccine"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.medication}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, medication: text }))}
                />
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Notes</Text>
                <TextInput
                  style={[styles(theme).formTextArea, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.inputText }]}
                  placeholder="Additional notes about the vaccination"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.notes}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles(theme).modalActions}>
                <TouchableOpacity style={[styles(theme).cancelButton, { backgroundColor: theme.colors.borderSecondary }]} onPress={closeModal}>
                  <Text style={[styles(theme).cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles(theme).saveButton, { backgroundColor: theme.colors.primary }]} onPress={handleSaveVaccination}>
                  <Text style={styles(theme).saveButtonText}>{editingVaccination ? 'Update' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: theme.colors.buttonText,
    fontWeight: 'bold',
  },
  vaccinationsList: {
    padding: 20,
  },
  vaccinationCard: {
    borderRadius: 12,
    marginBottom: 15,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    padding: 15,
    borderBottomWidth: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  vaccinationType: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    padding: 10,
    marginLeft: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 20,
  },
  deleteButton: {
    padding: 10,
    marginLeft: 5,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 20,
  },
  cardDetails: {
    padding: 15,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
  notesContainer: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  emptyButton: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  formTextArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
  },
  picker: {
    height: 50,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
  },
  saveButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default VaccinationScreen;
