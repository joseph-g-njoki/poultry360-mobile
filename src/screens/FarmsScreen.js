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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import { useDashboardRefresh } from '../context/DashboardRefreshContext';
import fastApiService from '../services/fastApiService';
import OfflineIndicator, { SyncStatusBadge } from '../components/OfflineIndicator';

const FarmsScreen = () => {
  const { theme } = useTheme();
  const { isConnected, performSync } = useOffline();
  const { triggerDashboardRefresh } = useDashboardRefresh();
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFarm, setEditingFarm] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    farmType: 'broiler',
    description: '',
  });

  // CRASH FIX: Track component mount status to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    loadFarms();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadFarms = async (showLoadingIndicator = true) => {
    // CRASH FIX: Check mount status before any state updates
    if (!isMountedRef.current) {
      console.log('Component unmounted, aborting load');
      return;
    }

    try {
      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(true);
      }

      // Load real data from database
      const response = await fastApiService.getFarms();

      // CRASH FIX: Check mount status after async operations
      if (!isMountedRef.current) {
        console.log('Component unmounted during data load, skipping state update');
        return;
      }

      if (response?.success && Array.isArray(response.data)) {
        // Map the real database data
        const farmsData = response.data.map(farm => ({
          id: farm.id,
          name: farm.farmName || farm.name || 'Unnamed Farm',
          location: farm.location || 'Unknown Location',
          farmType: farm.farmType || 'broiler',
          description: farm.description || farm.notes || '',
          batchCount: farm.batchCount || 0,
          totalBirds: farm.totalBirds || 0,
          createdAt: farm.createdAt || new Date().toISOString()
        }));

        setFarms(farmsData);
        setDataSource(response.source || 'database');
        console.log(`✅ Loaded ${farmsData.length} farms from database`);
      } else {
        // No data found - this is normal for new installs
        setFarms([]);
        setDataSource('database');
        console.log('ℹ️ No farms found in database');
      }

      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(false);
      }

    } catch (error) {
      console.warn('Farms load error:', error.message);

      // CRASH FIX: Check mount status before error state updates
      if (!isMountedRef.current) {
        return;
      }

      // On error, show empty state - no mock data
      setFarms([]);
      setDataSource('error');

      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(false);
      }
    }
  };


  const onRefresh = useCallback(async () => {
    // CRASH FIX: Check mount status before refresh
    if (!isMountedRef.current) return;

    try {
      if (isMountedRef.current) {
        setRefreshing(true);
      }
      console.log('🔄 Farms refresh initiated...');

      // Refresh real data from database
      if (isMountedRef.current) {
        await loadFarms(false); // Don't show loading indicator during refresh
      }

      // Optional: Try sync in background if available (non-blocking)
      if (isConnected && performSync && isMountedRef.current) {
        performSync()
          .then(syncResult => {
            if (syncResult?.success && isMountedRef.current) {
              console.log('✅ Background sync completed');
              // Optionally reload data after sync
              loadFarms(false);
            }
          })
          .catch(syncError => {
            console.log('ℹ️  Background sync failed:', syncError.message);
            // Ignore sync failures during refresh
          });
      }

      console.log('✅ Farms refresh completed');

    } catch (refreshError) {
      console.warn('⚠️  Refresh error:', refreshError.message);

      // CRASH FIX: Check mount status before error state updates
      if (!isMountedRef.current) return;

      // On error, show empty state - no mock data
      setFarms([]);
      setDataSource('error');
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [isConnected, performSync]);

  const openModal = (farm = null) => {
    setEditingFarm(farm);
    setFormData({
      name: farm?.name || '',
      location: farm?.location || '',
      farmType: farm?.farmType || 'broiler',
      description: farm?.description || farm?.notes || '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingFarm(null);
    setFormData({ name: '', location: '', farmType: 'broiler', description: '' });
  };

  const handleSaveFarm = async () => {
    if (!formData.name.trim() || !formData.location.trim()) {
      Alert.alert('Error', 'Please fill in farm name and location');
      return;
    }

    try {
      console.log('🔄 Starting farm save operation...');
      let response;

      if (editingFarm) {
        console.log('🔄 Updating existing farm:', editingFarm.name);
        response = await fastApiService.updateFarm(editingFarm.id, formData);
        if (response.success) {
          Alert.alert('Success', 'Updated successfully!');
        } else {
          throw new Error(response.error || 'Failed to update farm');
        }
      } else {
        console.log('🔄 Creating new farm:', formData.name);
        response = await fastApiService.createFarm(formData);
        if (response.success) {
          Alert.alert('Success', 'Farm created successfully!');
        } else {
          throw new Error(response.error || 'Failed to create farm');
        }
      }

      console.log('🔄 Farm save operation completed successfully');
      closeModal();
      await loadFarms(); // Wait for farms to reload

      // ALWAYS trigger dashboard refresh after successful save
      console.log('🔄 Farm saved - dashboard refresh triggered');
      triggerDashboardRefresh();

    } catch (error) {
      console.error('Save farm error:', error);
      Alert.alert('Error', error.message || 'Failed to save farm');
    }
  };

  const handleDeleteFarm = (farm) => {
    Alert.alert(
      'Delete Farm',
      `Are you sure you want to delete "${farm.name}"? This will also delete all associated batches and records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔄 Starting farm delete operation:', farm.name);
              const response = await fastApiService.deleteFarm(farm.id);

              if (response.success) {
                Alert.alert('Success', 'Deleted successfully!');
                console.log('✅ Farm deleted successfully');
                await loadFarms(); // Reload farms to reflect deletion

                // Trigger dashboard refresh after farm delete
                triggerDashboardRefresh();
                console.log('🔄 Farm deleted - dashboard refresh triggered');
              } else {
                throw new Error(response.error || 'Failed to delete farm');
              }
            } catch (error) {
              console.error('Delete farm error:', error);
              Alert.alert('Error', error.message || 'Failed to delete farm');
            }
          },
        },
      ]
    );
  };

  const renderFarmCard = ({ item }) => {
    // Add safety check for item
    if (!item) {
      return null;
    }

    return (
      <View style={[styles.farmCard, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}>
        <View style={[styles.farmHeader, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.farmName, { color: theme.colors.primary }]}>{item.name || 'Unnamed Farm'}</Text>
        <View style={styles.farmActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openModal(item)}
          >
            <Text style={styles.editButtonText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteFarm(item)}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.farmDetails}>
        <View style={styles.farmDetailRow}>
          <Text style={[styles.farmDetailLabel, { color: theme.colors.textSecondary }]}>📍 Location:</Text>
          <Text style={[styles.farmDetailValue, { color: theme.colors.text }]}>{item.location || 'Unknown Location'}</Text>
        </View>

        <View style={styles.farmDetailRow}>
          <Text style={[styles.farmDetailLabel, { color: theme.colors.textSecondary }]}>🏭 Type:</Text>
          <Text style={[styles.farmDetailValue, { color: theme.colors.text }]}>{item.farmType ? item.farmType.charAt(0).toUpperCase() + item.farmType.slice(1) : 'Broiler'}</Text>
        </View>

        {(item.description || item.notes) && (
          <View style={styles.farmDetailRow}>
            <Text style={[styles.farmDetailLabel, { color: theme.colors.textSecondary }]}>📝 Description:</Text>
            <Text style={[styles.farmDetailValue, { color: theme.colors.text }]}>{item.description || item.notes}</Text>
          </View>
        )}

        <View style={styles.farmStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.primary }]}>{item.batchCount || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Batches</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.primary }]}>{item.totalBirds || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Birds</Text>
          </View>
        </View>

        <View style={[styles.farmMeta, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.farmDate, { color: theme.colors.textLight }]}>
            Created: {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>
    </View>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading Farms...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>My Farms</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => openModal()}
        >
          <Text style={styles.addButtonText}>+ Add Farm</Text>
        </TouchableOpacity>
      </View>

      {/* Farms List */}
      {farms.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Farms Yet</Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Start by creating your first farm to manage your poultry operations
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => openModal()}
          >
            <Text style={styles.emptyButtonText}>Create First Farm</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={Array.isArray(farms) ? farms : []}
          renderItem={renderFarmCard}
          keyExtractor={(item, index) => (item?.id ? item.id.toString() : `farm_${index}`)}
          contentContainerStyle={styles.farmsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          initialNumToRender={10}
        />
      )}

      {/* Add/Edit Farm Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <ScrollView>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingFarm ? 'Edit Farm' : 'Add New Farm'}
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Farm Name *</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Enter farm name"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, name: text }))
                  }
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Location *</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Enter farm location"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.location}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, location: text }))
                  }
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Farm Type</Text>
                <View style={[styles.pickerContainer, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder
                }]}>
                  <Picker
                    selectedValue={formData.farmType}
                    style={[styles.picker, { color: theme.colors.inputText }]}
                    onValueChange={(itemValue) =>
                      setFormData(prev => ({ ...prev, farmType: itemValue }))
                    }
                  >
                    <Picker.Item label="Broiler" value="broiler" color={theme.colors.inputText} />
                    <Picker.Item label="Layer" value="layer" color={theme.colors.inputText} />
                    <Picker.Item label="Breeder" value="breeder" color={theme.colors.inputText} />
                    <Picker.Item label="Mixed" value="mixed" color={theme.colors.inputText} />
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Enter farm description (optional)"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, description: text }))
                  }
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.colors.borderSecondary }]}
                  onPress={closeModal}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSaveFarm}
                >
                  <Text style={styles.saveButtonText}>
                    {editingFarm ? 'Update' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
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
    color: '#fff',
    fontWeight: 'bold',
  },
  farmsList: {
    padding: 20,
  },
  farmCard: {
    borderRadius: 12,
    marginBottom: 15,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  farmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  farmName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  farmActions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: 5,
    marginLeft: 10,
  },
  editButtonText: {
    fontSize: 18,
  },
  deleteButton: {
    padding: 5,
    marginLeft: 5,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  farmDetails: {
    padding: 15,
  },
  farmDetailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  farmDetailLabel: {
    fontSize: 14,
    width: 100,
  },
  farmDetailValue: {
    fontSize: 14,
    flex: 1,
  },
  farmStats: {
    flexDirection: 'row',
    marginTop: 15,
    marginBottom: 10,
  },
  statItem: {
    alignItems: 'center',
    marginRight: 30,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  farmMeta: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  farmDate: {
    fontSize: 12,
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
    color: '#fff',
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
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default FarmsScreen;