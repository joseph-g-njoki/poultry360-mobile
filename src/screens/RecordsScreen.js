import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import CustomPicker from '../components/CustomPicker';
import fastApiService from '../services/fastApiService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useDashboardRefresh } from '../context/DashboardRefreshContext';

const RecordsScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { triggerDashboardRefresh } = useDashboardRefresh();
  const [records, setRecords] = useState([]);
  const [farms, setFarms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  // Check if we have a pre-selected tab from navigation params
  const initialTab = route?.params?.initialTab || 'feed';
  const [activeTab, setActiveTab] = useState(initialTab); // feed, health, mortality, production, water, weight

  // CRASH FIX: Track component mount status to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const [formData, setFormData] = useState({
    type: 'feed',
    farmId: '',
    batchId: '',
    date: '',
    quantity: '',
    feedType: '',
    cost: '',
    notes: '',
    // Health specific
    healthStatus: '',
    treatment: '',
    // Mortality specific
    count: '',
    cause: '',
    // Production specific
    eggsCollected: '',
    weight: '',
    // Water specific
    quantityLiters: '',
    waterSource: '',
    quality: '',
    temperature: '',
    // Weight specific
    averageWeight: '',
    sampleSize: '',
    weightUnit: 'kg',
  });

  useEffect(() => {
    isMountedRef.current = true;

    loadData();

    return () => {
      isMountedRef.current = false;
    };
  }, [activeTab]);

  // Handle route params to switch tabs when navigating from dashboard
  useEffect(() => {
    if (route?.params?.initialTab && route.params.initialTab !== activeTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Add a safety effect to ensure records is always an array
  useEffect(() => {
    if (!Array.isArray(records) && isMountedRef.current) {
      setRecords([]);
    }
  }, [records]);

  const loadData = async (showLoadingIndicator = true) => {
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
      const [farmsResponse, batchesResponse, recordsResponse] = await Promise.all([
        fastApiService.getFarms(),
        fastApiService.getFlocks(),
        fastApiService.getRecords(activeTab)
      ]);

      // CRASH FIX: Check mount status after async operations
      if (!isMountedRef.current) {
        console.log('Component unmounted during data load, skipping state update');
        return;
      }

      // Update farms with real data
      if (farmsResponse?.success && Array.isArray(farmsResponse.data)) {
        const farmsData = farmsResponse.data.map(farm => ({
          id: farm.id,
          name: farm.farmName || farm.name || 'Unnamed Farm'
        }));
        setFarms(farmsData);
        console.log(`✅ Loaded ${farmsData.length} farms from database`);
      } else {
        setFarms([]);
        console.log('ℹ️ No farms found in database');
      }

      // Update batches with real data
      if (batchesResponse?.success && Array.isArray(batchesResponse.data)) {
        const batchesData = batchesResponse.data.map(batch => ({
          id: batch.id,
          name: batch.batchName || batch.name || 'Unnamed Batch',
          batchName: batch.batchName || batch.name || 'Unnamed Batch'
        }));
        setBatches(batchesData);
        console.log(`✅ Loaded ${batchesData.length} batches from database`);
      } else {
        setBatches([]);
        console.log('ℹ️ No batches found in database');
      }

      // Load records for current tab
      if (recordsResponse?.success && Array.isArray(recordsResponse.data)) {
        setRecords(recordsResponse.data);
        console.log(`✅ Loaded ${recordsResponse.data.length} ${activeTab} records from database`);
      } else {
        setRecords([]);
        console.log(`ℹ️ No ${activeTab} records found in database`);
      }

      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(false);
      }

    } catch (error) {
      console.warn('Records load error:', error.message);

      // CRASH FIX: Check mount status before error state updates
      if (!isMountedRef.current) {
        return;
      }

      // On error, show empty state - no mock data
      setRecords([]);
      setFarms([]);
      setBatches([]);

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
      console.log('🔄 Records refresh initiated...');

      // Quick refresh - load data immediately
      if (isMountedRef.current) {
        await loadData(false); // Don't show loading indicator during refresh
      }

      console.log('✅ Records refresh completed');

    } catch (refreshError) {
      console.warn('⚠️  Refresh error:', refreshError.message);

      // CRASH FIX: Check mount status before error state updates
      if (!isMountedRef.current) return;

      // On error, show empty state - no mock data
      setRecords([]);
      setFarms([]);
      setBatches([]);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, []); // Remove activeTab dependency to prevent recreation

  const openModal = async () => {
    // CRASH FIX: Retry logic with database readiness check for farms
    if (!farms || farms.length === 0) {
      let currentFarms = [];
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries && currentFarms.length === 0) {
        try {
          await fastApiService.init();

          if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
            console.log(`🔄 Retry ${retryCount}/${maxRetries} - Reloading farms...`);
          }

          const farmsResponse = await fastApiService.getFarms();
          if (farmsResponse?.success && Array.isArray(farmsResponse.data) && farmsResponse.data.length > 0) {
            currentFarms = farmsResponse.data.map(farm => ({
              id: farm.id,
              name: farm.farmName || farm.name || 'Unnamed Farm',
              location: farm.location || ''
            }));
            setFarms(currentFarms);
            console.log(`✅ RecordsScreen: Loaded ${currentFarms.length} farms (attempt ${retryCount + 1})`);
            break;
          } else {
            retryCount++;
          }
        } catch (error) {
          console.error(`❌ Error loading farms (attempt ${retryCount + 1}):`, error.message);
          retryCount++;
        }
      }
    }

    // CRASH FIX: Retry logic for batches
    if (!batches || batches.length === 0) {
      let currentBatches = [];
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries && currentBatches.length === 0) {
        try {
          await fastApiService.init();

          if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
            console.log(`🔄 Retry ${retryCount}/${maxRetries} - Reloading batches...`);
          }

          const batchesResponse = await fastApiService.getFlocks();
          if (batchesResponse?.success && Array.isArray(batchesResponse.data) && batchesResponse.data.length > 0) {
            currentBatches = batchesResponse.data.map(batch => ({
              id: batch.id,
              name: batch.batchName || batch.name || 'Unnamed Batch',
              batchName: batch.batchName || batch.name || 'Unnamed Batch',
              breed: batch.breed || '',
              quantity: batch.quantity || 0
            }));
            setBatches(currentBatches);
            console.log(`✅ RecordsScreen: Loaded ${currentBatches.length} batches (attempt ${retryCount + 1})`);
            break;
          } else {
            retryCount++;
          }
        } catch (error) {
          console.error(`❌ Error loading batches (attempt ${retryCount + 1}):`, error.message);
          retryCount++;
        }
      }
    }

    // Ensure we have safe access to farms and batches
    const safeFarms = Array.isArray(farms) ? farms : [];
    const safeBatches = Array.isArray(batches) ? batches : [];

    setFormData({
      type: activeTab,
      farmId: safeFarms.length > 0 && safeFarms[0]?.id ? String(safeFarms[0].id) : '',
      batchId: safeBatches.length > 0 && safeBatches[0]?.id ? String(safeBatches[0].id) : '',
      date: new Date().toISOString().split('T')[0],
      quantity: '',
      feedType: '',
      cost: '',
      notes: '',
      healthStatus: 'healthy',
      treatment: '',
      count: '',
      cause: '',
      eggsCollected: '',
      weight: '',
      quantityLiters: '',
      waterSource: 'Borehole',
      quality: 'Clean',
      temperature: '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const handleSaveRecord = async () => {
    if (!formData.farmId || !formData.batchId || !formData.date) {
      Alert.alert('Error', 'Please fill in farm, batch, and date');
      return;
    }

    const recordData = {
      farmId: formData.farmId,
      batchId: formData.batchId,
      date: formData.date,
      notes: formData.notes,
    };

    try {
      console.log('🔄 Starting record save operation for type:', activeTab);

      switch (activeTab) {
        case 'feed':
          if (!formData.quantity || !formData.feedType) {
            Alert.alert('Error', 'Please fill in quantity and feed type');
            return;
          }
          recordData.quantity = parseFloat(formData.quantity);
          recordData.feedType = formData.feedType;
          recordData.cost = parseFloat(formData.cost) || 0;
          console.log('🔄 Creating feed record...');
          await fastApiService.createRecord('feed', recordData);
          break;

        case 'health':
          recordData.healthStatus = formData.healthStatus;
          recordData.treatment = formData.treatment;
          console.log('🔄 Creating health record...');
          await fastApiService.createRecord('health', recordData);
          break;

        case 'mortality':
          if (!formData.count) {
            Alert.alert('Error', 'Please enter mortality count');
            return;
          }
          recordData.count = parseInt(formData.count);
          recordData.cause = formData.cause;
          console.log('🔄 Creating mortality record...');
          await fastApiService.createRecord('mortality', recordData);
          break;

        case 'production':
          recordData.eggsCollected = parseInt(formData.eggsCollected) || 0;
          recordData.weight = parseFloat(formData.weight) || 0;
          console.log('🔄 Creating production record...');
          await fastApiService.createRecord('production', recordData);
          break;

        case 'water':
          if (!formData.quantityLiters) {
            Alert.alert('Error', 'Please enter water quantity in liters');
            return;
          }
          recordData.quantityLiters = parseFloat(formData.quantityLiters);
          recordData.waterSource = formData.waterSource || null;
          recordData.quality = formData.quality || null;
          recordData.temperature = formData.temperature ? parseFloat(formData.temperature) : null;
          recordData.dateRecorded = formData.date;
          console.log('🔄 Creating water record...');
          await fastApiService.createWaterRecord(recordData);
          break;

        case 'weight':
          if (!formData.averageWeight || !formData.sampleSize) {
            Alert.alert('Error', 'Please enter average weight and sample size');
            return;
          }
          recordData.averageWeight = parseFloat(formData.averageWeight);
          recordData.sampleSize = parseInt(formData.sampleSize);
          recordData.weightUnit = 'kg';
          recordData.dateRecorded = formData.date;
          console.log('🔄 Creating weight record...');
          await fastApiService.createWeightRecord(recordData);
          break;
      }

      console.log('🔄 Record save operation completed successfully');

      // Show specific success message based on record type
      const successMessages = {
        feed: 'Feed record added successfully!',
        health: 'Health record added successfully!',
        mortality: 'Mortality record added successfully!',
        production: 'Production record added successfully!',
        water: 'Water record added successfully!',
        weight: 'Weight record added successfully!'
      };

      Alert.alert('Success', successMessages[activeTab] || 'Record saved successfully!');
      closeModal();
      await loadData(); // Wait for data to reload

      // ALWAYS trigger dashboard refresh after successful save
      console.log('🔄 Record saved - dashboard refresh triggered');
      triggerDashboardRefresh();

    } catch (error) {
      console.error('Save record error:', error);
      Alert.alert('Error', error.message || 'Failed to save record');
    }
  };

  const handleDeleteRecord = (record) => {
    // Enhanced safety check for record object
    if (!record || !record.id) {
      Alert.alert('Error', 'Invalid record data');
      return;
    }

    // Check if user has permission to delete (only managers and above)
    const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';
    if (!isManager) {
      Alert.alert('Access Denied', 'Only managers can delete records. Contact your manager if you need to remove this record.');
      return;
    }

    Alert.alert(
      'Delete Record',
      `Are you sure you want to delete this ${activeTab} record from ${formatDate(record.date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔄 Starting record delete operation:', activeTab, record.id);
              const response = await fastApiService.deleteRecord(activeTab, record.id);

              if (response.success) {
                Alert.alert('Success', 'Deleted successfully!');
                console.log('✅ Record deleted successfully');
                await loadData(); // Reload data to reflect deletion

                // Trigger dashboard refresh after record delete
                triggerDashboardRefresh();
                console.log('🔄 Record deleted - dashboard refresh triggered');
              } else {
                throw new Error(response.error || 'Failed to delete record');
              }
            } catch (error) {
              console.error('Delete record error:', error);
              Alert.alert('Error', error.message || 'Failed to delete record');
            }
          },
        },
      ]
    );
  };

  const getFarmName = (farmId) => {
    if (!farmId || !Array.isArray(farms)) return 'Unknown Farm';
    const farm = farms.find(f => f && f.id === farmId);
    return farm?.name || 'Unknown Farm';
  };

  const getBatchName = (batchId) => {
    if (!batchId || !Array.isArray(batches)) return 'Unknown Batch';
    const batch = batches.find(b => b && b.id === batchId);
    return batch?.name || batch?.batchName || 'Unknown Batch';
  };

  const renderRecord = useCallback(({ item, index }) => {
    // Enhanced safety check for item
    if (!item || typeof item !== 'object') {
      console.warn('Invalid item at index:', index, item);
      return null;
    }

    // Additional validation for required properties
    if (!item.id) {
      console.warn('Item missing id at index:', index, item);
      return null;
    }

    const renderContent = () => {
      switch (activeTab) {
        case 'feed':
          return (
            <View style={styles.recordContent}>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>🌾 {item.feedType || 'Unknown Feed'}</Text>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>📊 {item.quantity || 0} kg</Text>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>💰 ${item.cost || 0}</Text>
            </View>
          );
        case 'health':
          return (
            <View style={styles.recordContent}>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>🏥 {item.healthStatus || 'Unknown Status'}</Text>
              {item.treatment && <Text style={[styles.recordDetail, { color: theme.colors.text }]}>💊 {item.treatment}</Text>}
            </View>
          );
        case 'mortality':
          return (
            <View style={styles.recordContent}>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>⚠️ {item.count} birds</Text>
              {item.cause && <Text style={[styles.recordDetail, { color: theme.colors.text }]}>🔍 {item.cause}</Text>}
            </View>
          );
        case 'production':
          return (
            <View style={styles.recordContent}>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>🥚 {item.eggsCollected || 0} eggs</Text>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>⚖️ {item.weight || 0} kg</Text>
            </View>
          );
        case 'water':
          return (
            <View style={styles.recordContent}>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>💧 {item.quantityLiters || 0} liters</Text>
              {item.waterSource && <Text style={[styles.recordDetail, { color: theme.colors.text }]}>🚰 {item.waterSource}</Text>}
              {item.quality && <Text style={[styles.recordDetail, { color: theme.colors.text }]}>✨ {item.quality}</Text>}
              {item.temperature && <Text style={[styles.recordDetail, { color: theme.colors.text }]}>🌡️ {item.temperature}°C</Text>}
            </View>
          );
        case 'weight':
          return (
            <View style={styles.recordContent}>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>⚖️ {item.averageWeight || 0} kg</Text>
              <Text style={[styles.recordDetail, { color: theme.colors.text }]}>📊 Sample: {item.sampleSize || 0} birds</Text>
            </View>
          );
        default:
          return null;
      }
    };

    return (
      <View style={[styles(theme).recordCard, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}>
        <View style={styles(theme).recordHeader}>
          <View style={styles(theme).recordHeaderLeft}>
            <Text style={[styles(theme).recordDate, { color: theme.colors.text }]}>{formatDate(item.date)}</Text>
            <Text style={[styles(theme).recordType, { color: theme.colors.primary, backgroundColor: theme.colors.demoBackground }]}>{activeTab.toUpperCase()}</Text>
          </View>
          {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') && (
            <TouchableOpacity
              style={styles(theme).deleteRecordButton}
              onPress={() => handleDeleteRecord(item)}
            >
              <Text style={styles(theme).deleteRecordButtonText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles(theme).recordDetails}>
          <Text style={[styles(theme).recordFarm, { color: theme.colors.textSecondary }]}>🏠 {getFarmName(item.farmId)}</Text>
          <Text style={[styles(theme).recordBatch, { color: theme.colors.textSecondary }]}>🐔 {getBatchName(item.batchId)}</Text>
        </View>

        {renderContent()}

        {item.notes && (
          <Text style={[styles(theme).recordNotes, { color: theme.colors.textSecondary, borderTopColor: theme.colors.border }]}>📝 {item.notes}</Text>
        )}
      </View>
    );
  }, [activeTab, farms, batches, user?.role, theme.colors]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Memoized filtered records to prevent unnecessary re-renders
  const safeRecords = useMemo(() => {
    if (!Array.isArray(records)) {
      return [];
    }
    return records.filter(record => record && typeof record === 'object' && record.id);
  }, [records]);

  const renderTabButton = (tabKey, label, icon) => (
    <TouchableOpacity
      key={tabKey}
      style={[
        styles.tabButton,
        activeTab === tabKey && [styles.activeTabButton, { borderBottomColor: theme.colors.primary }]
      ]}
      onPress={() => setActiveTab(tabKey)}
    >
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[
        styles.tabText,
        { color: theme.colors.textSecondary },
        activeTab === tabKey && [styles.activeTabText, { color: theme.colors.primary }]
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderForm = () => {
    switch (activeTab) {
      case 'feed':
        return (
          <>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Feed Type *</Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.inputText
                }]}
                placeholder="e.g., Starter, Grower, Finisher"
                placeholderTextColor={theme.colors.placeholder}
                value={formData.feedType}
                onChangeText={(text) =>
                  setFormData(prev => ({ ...prev, feedType: text }))
                }
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Quantity (kg) *</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="0.0"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.quantity}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, quantity: text }))
                  }
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Cost ($)</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.cost}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, cost: text }))
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        );

      case 'health':
        return (
          <>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Health Status *</Text>
              <CustomPicker
                selectedValue={formData.healthStatus}
                onValueChange={(itemValue) =>
                  setFormData(prev => ({ ...prev, healthStatus: itemValue }))
                }
                items={[
                  { label: 'Healthy', value: 'healthy' },
                  { label: 'Sick', value: 'sick' },
                  { label: 'Under Treatment', value: 'under_treatment' },
                  { label: 'Recovered', value: 'recovered' }
                ]}
                placeholder="Select health status"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Treatment</Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.inputText
                }]}
                placeholder="Treatment given (optional)"
                placeholderTextColor={theme.colors.placeholder}
                value={formData.treatment}
                onChangeText={(text) =>
                  setFormData(prev => ({ ...prev, treatment: text }))
                }
              />
            </View>
          </>
        );

      case 'mortality':
        return (
          <>
            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Count *</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Number of birds"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.count}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, count: text }))
                  }
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Cause</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Cause (optional)"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.cause}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, cause: text }))
                  }
                />
              </View>
            </View>
          </>
        );

      case 'production':
        return (
          <>
            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Eggs Collected</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Number of eggs"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.eggsCollected}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, eggsCollected: text }))
                  }
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Weight (kg)</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Total weight"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.weight}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, weight: text }))
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        );

      case 'water':
        return (
          <>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Quantity (Liters) *</Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.inputText
                }]}
                placeholder="0.0"
                placeholderTextColor={theme.colors.placeholder}
                value={formData.quantityLiters}
                onChangeText={(text) =>
                  setFormData(prev => ({ ...prev, quantityLiters: text }))
                }
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Water Source</Text>
                <CustomPicker
                  selectedValue={formData.waterSource}
                  onValueChange={(itemValue) =>
                    setFormData(prev => ({ ...prev, waterSource: itemValue }))
                  }
                  items={[
                    { label: 'Borehole', value: 'Borehole' },
                    { label: 'Municipal', value: 'Municipal' },
                    { label: 'Well', value: 'Well' },
                    { label: 'River', value: 'River' },
                    { label: 'Rainwater', value: 'Rainwater' },
                    { label: 'Other', value: 'Other' }
                  ]}
                  placeholder="Select water source"
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Quality</Text>
                <CustomPicker
                  selectedValue={formData.quality}
                  onValueChange={(itemValue) =>
                    setFormData(prev => ({ ...prev, quality: itemValue }))
                  }
                  items={[
                    { label: 'Clean', value: 'Clean' },
                    { label: 'Slightly Turbid', value: 'Slightly Turbid' },
                    { label: 'Turbid', value: 'Turbid' },
                    { label: 'Contaminated', value: 'Contaminated' }
                  ]}
                  placeholder="Select water quality"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Temperature (°C)</Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.inputText
                }]}
                placeholder="Optional"
                placeholderTextColor={theme.colors.placeholder}
                value={formData.temperature}
                onChangeText={(text) =>
                  setFormData(prev => ({ ...prev, temperature: text }))
                }
                keyboardType="numeric"
              />
            </View>
          </>
        );

      case 'weight':
        return (
          <>
            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Average Weight (kg) *</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="0.0"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.averageWeight}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, averageWeight: text }))
                  }
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Sample Size *</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Number of birds weighed"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.sampleSize}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, sampleSize: text }))
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        );
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading Records...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Records</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={openModal}
        >
          <Text style={styles.addButtonText}>+ Add Record</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal style={[styles.tabsContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]} showsHorizontalScrollIndicator={false}>
        {renderTabButton('feed', 'Feed', '🌾')}
        {renderTabButton('health', 'Health', '🏥')}
        {renderTabButton('mortality', 'Mortality', '⚠️')}
        {renderTabButton('production', 'Production', '🥚')}
        {renderTabButton('water', 'Water', '💧')}
        {renderTabButton('weight', 'Weight', '⚖️')}
      </ScrollView>

      {/* Records List */}
      {safeRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No {activeTab} records</Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Start recording your {activeTab} data to track your farm's performance
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
            onPress={openModal}
          >
            <Text style={styles.emptyButtonText}>Add First Record</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={safeRecords}
          renderItem={renderRecord}
          keyExtractor={(item, index) => {
            if (item && item.id) {
              return `${activeTab}_${item.id}`;
            }
            return `record_${activeTab}_${index}`;
          }}
          contentContainerStyle={styles.recordsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          updateCellsBatchingPeriod={100}
          getItemLayout={null}
          ListEmptyComponent={null}
          extraData={activeTab}
        />
      )}

      {/* Add Record Modal */}
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
                Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Record
              </Text>

              {/* Common fields */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Farm *</Text>
                <CustomPicker
                  selectedValue={String(formData.farmId)}
                  onValueChange={(itemValue) =>
                    setFormData(prev => ({ ...prev, farmId: itemValue === '' ? '' : parseInt(itemValue) }))
                  }
                  items={[
                    { label: Array.isArray(farms) && farms.length === 0 ? "No farms available - Create a farm first" : "Select a farm", value: "" },
                    ...((Array.isArray(farms) ? farms : []).filter(farm => farm && farm.id).map(farm => ({
                      label: farm.location ? `${farm.name} - ${farm.location}` : farm.name || 'Unnamed Farm',
                      value: String(farm.id)
                    })))
                  ]}
                  placeholder="Select a farm"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Batch *</Text>
                <CustomPicker
                  selectedValue={String(formData.batchId)}
                  onValueChange={(itemValue) =>
                    setFormData(prev => ({ ...prev, batchId: itemValue === '' ? '' : parseInt(itemValue) }))
                  }
                  items={[
                    { label: Array.isArray(batches) && batches.length === 0 ? "No batches available - Create a batch first" : "Select a batch", value: "" },
                    ...((Array.isArray(batches) ? batches : []).filter(batch => batch && batch.id).map(batch => ({
                      label: batch.breed && batch.quantity ? `${batch.name || batch.batchName} - ${batch.breed} (${batch.quantity} birds)` : (batch.name || batch.batchName || 'Unnamed Batch'),
                      value: String(batch.id)
                    })))
                  ]}
                  placeholder="Select a batch"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Date *</Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.date}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, date: text }))
                  }
                />
              </View>

              {/* Type-specific fields */}
              {renderForm()}

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Notes</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Additional notes (optional)"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.notes}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, notes: text }))
                  }
                  multiline
                  numberOfLines={3}
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
                  onPress={handleSaveRecord}
                >
                  <Text style={styles.saveButtonText}>Save Record</Text>
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
  tabsContainer: {
    borderBottomWidth: 1,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginHorizontal: 5,
  },
  activeTabButton: {
    borderBottomWidth: 3,
  },
  tabIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  recordsList: {
    padding: 20,
  },
  recordCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deleteRecordButton: {
    padding: 5,
    marginLeft: 10,
  },
  deleteRecordButtonText: {
    fontSize: 18,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 15,
  },
  recordType: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recordDetails: {
    marginBottom: 10,
  },
  recordFarm: {
    fontSize: 14,
    marginBottom: 4,
  },
  recordBatch: {
    fontSize: 14,
    marginBottom: 8,
  },
  recordContent: {
    marginBottom: 10,
  },
  recordDetail: {
    fontSize: 14,
    marginBottom: 4,
  },
  recordNotes: {
    fontSize: 14,
    fontStyle: 'italic',
    borderTopWidth: 1,
    paddingTop: 10,
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
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formGroup: {
    marginBottom: 20,
  },
  halfWidth: {
    width: '48%',
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
  textArea: {
    height: 80,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default RecordsScreen;