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
import notificationService from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useDashboardRefresh } from '../context/DashboardRefreshContext';
import { useFarms, useBatches } from '../context/DataStoreContext';

const RecordsScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { triggerDashboardRefresh } = useDashboardRefresh();

  // Use centralized context for farms and batches (auto-loads and updates)
  const { farms, loading: farmsLoading, refresh: refreshFarms } = useFarms();
  const { batches, loading: batchesLoading, refresh: refreshBatches } = useBatches();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  // Check if we have a pre-selected tab from navigation params
  const initialTab = route?.params?.initialTab || 'feed';
  const [activeTab, setActiveTab] = useState(initialTab); // feed, health, mortality, production, water, weight, vaccination

  // CRASH FIX: Track component mount status to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // FIX #4: Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const RECORDS_PER_PAGE = 20;
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
    // Vaccination specific
    vaccinationType: '',
    vaccinationDate: '',
    vaccinationHour: '08',
    vaccinationMinute: '00',
    vaccinationPeriod: 'AM',
    medication: '',
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

  const loadData = async (showLoadingIndicator = true, resetPagination = true) => {
    // CRASH FIX: Check mount status before any state updates
    if (!isMountedRef.current) {
      console.log('Component unmounted, aborting load');
      return;
    }

    try {
      // INSTANT DISPLAY FIX: Don't show loading spinner for local data
      // Set loading to false immediately since data is local and instant
      if (isMountedRef.current) {
        setLoading(false); // Data is local - no need for loading spinner
      }

      // FIX #4: Reset pagination on initial load or tab change
      if (resetPagination && isMountedRef.current) {
        setPage(1);
        setHasMore(true);
      }

      console.log(`🔄 Loading ${activeTab} records from LOCAL STORAGE (instant)`);

      // Load records for current tab (farms and batches come from context)
      const recordsResponse = await fastApiService.getRecords(activeTab);

      // CRASH FIX: Check mount status after async operations
      if (!isMountedRef.current) {
        console.log('Component unmounted during data load, skipping state update');
        return;
      }

      // Load records for current tab
      if (recordsResponse?.success && Array.isArray(recordsResponse.data)) {
        // FIX #4: Implement pagination - only load first page initially
        const allRecords = recordsResponse.data;
        const paginatedRecords = allRecords.slice(0, RECORDS_PER_PAGE);
        setRecords(paginatedRecords);
        setHasMore(allRecords.length > RECORDS_PER_PAGE);
        console.log(`✅ INSTANT DISPLAY: Loaded ${paginatedRecords.length} of ${allRecords.length} ${activeTab} records (page 1)`);
      } else {
        setRecords([]);
        setHasMore(false);
        console.log(`ℹ️ No ${activeTab} records found in database`);
      }

    } catch (error) {
      console.warn('Records load error:', error.message);

      // CRASH FIX: Check mount status before error state updates
      if (!isMountedRef.current) {
        return;
      }

      // On error, show empty state - no mock data
      setRecords([]);
      setHasMore(false);
      setLoading(false);
    }
  };

  // FIX #4: Load more records on scroll
  const loadMoreRecords = async () => {
    if (loadingMore || !hasMore || !isMountedRef.current) {
      return;
    }

    try {
      setLoadingMore(true);
      console.log(`📄 Loading more ${activeTab} records - page ${page + 1}`);

      // Load all records again and paginate
      const recordsResponse = await fastApiService.getRecords(activeTab);

      if (!isMountedRef.current) return;

      if (recordsResponse?.success && Array.isArray(recordsResponse.data)) {
        const allRecords = recordsResponse.data;
        const nextPage = page + 1;
        const startIndex = 0;
        const endIndex = nextPage * RECORDS_PER_PAGE;
        const paginatedRecords = allRecords.slice(startIndex, endIndex);

        setRecords(paginatedRecords);
        setPage(nextPage);
        setHasMore(allRecords.length > endIndex);

        console.log(`✅ Loaded ${paginatedRecords.length} of ${allRecords.length} records (page ${nextPage})`);
      }

      setLoadingMore(false);
    } catch (error) {
      console.error('Load more error:', error.message);
      if (isMountedRef.current) {
        setLoadingMore(false);
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

      // Refresh farms and batches from context
      refreshFarms(true);
      refreshBatches(true);

      // Quick refresh - load records data
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
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [refreshFarms, refreshBatches]); // Add dependencies

  const openModal = () => {
    console.log(`📋 Opening record modal with ${farms.length} farms and ${batches.length} batches from context`);

    // Initialize form with first farm/batch if available
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
      averageWeight: '',
      sampleSize: '',
      weightUnit: 'kg',
      vaccinationType: '',
      vaccinationDate: new Date().toISOString().split('T')[0],
      vaccinationHour: '08',
      vaccinationMinute: '00',
      vaccinationPeriod: 'AM',
      medication: '',
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
          console.log('🔄 Creating feed record with fastApiService...');
          await fastApiService.createRecord('feed', recordData);
          break;

        case 'health':
          recordData.healthStatus = formData.healthStatus;
          recordData.treatment = formData.treatment;
          console.log('🔄 Creating health record with fastApiService...');
          await fastApiService.createRecord('health', recordData);
          break;

        case 'mortality':
          if (!formData.count) {
            Alert.alert('Error', 'Please enter mortality count');
            return;
          }
          recordData.count = parseInt(formData.count);
          recordData.cause = formData.cause;
          console.log('🔄 Creating mortality record with fastApiService...');
          await fastApiService.createRecord('mortality', recordData);
          break;

        case 'production':
          recordData.eggsCollected = parseInt(formData.eggsCollected) || 0;
          recordData.weight = parseFloat(formData.weight) || 0;
          console.log('🔄 Creating production record with fastApiService...');
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
          console.log('🔄 Creating water record with fastApiService...');
          await fastApiService.createRecord('water', recordData);
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
          console.log('🔄 Creating weight record with fastApiService...');
          await fastApiService.createRecord('weight', recordData);
          break;

        case 'vaccination':
          if (!formData.vaccinationType || !formData.vaccinationDate) {
            Alert.alert('Error', 'Please enter vaccination type and date');
            return;
          }

          // Convert 12-hour to 24-hour format
          let hour = parseInt(formData.vaccinationHour);
          if (formData.vaccinationPeriod === 'PM' && hour !== 12) {
            hour += 12;
          } else if (formData.vaccinationPeriod === 'AM' && hour === 12) {
            hour = 0;
          }
          const vaccinationTime = `${hour.toString().padStart(2, '0')}:${formData.vaccinationMinute}`;

          recordData.vaccinationType = formData.vaccinationType;
          recordData.vaccinationDate = formData.vaccinationDate;
          recordData.vaccinationTime = vaccinationTime;
          recordData.medication = formData.medication || '';
          console.log('🔄 Creating vaccination record with fastApiService...');
          await fastApiService.createRecord('vaccination', recordData);

          // Schedule vaccination reminder
          console.log('🔔 Scheduling vaccination reminder...');
          await notificationService.scheduleVaccinationReminder({
            vaccinationType: recordData.vaccinationType,
            vaccinationDate: recordData.vaccinationDate,
            vaccinationTime: vaccinationTime,
            batchId: recordData.batchId
          });
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
        weight: 'Weight record added successfully!',
        vaccination: 'Vaccination record added successfully!'
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
              console.log('🔄 Starting record delete operation with fastApiService:', activeTab, record.id);
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

  const getFarmName = (item) => {
    // Handle both camelCase (farmId) and snake_case (farm_id)
    const farmId = item?.farmId || item?.farm_id;
    if (!farmId || !Array.isArray(farms)) return 'Unknown Farm';
    const farm = farms.find(f => f && f.id === farmId);
    return farm?.farmName || farm?.name || 'Unknown Farm';
  };

  const getBatchName = (item) => {
    // Handle both camelCase (batchId) and snake_case (batch_id)
    const batchId = item?.batchId || item?.batch_id;
    if (!batchId || !Array.isArray(batches)) return 'Unknown Batch';
    const batch = batches.find(b => b && b.id === batchId);
    return batch?.batchName || batch?.name || 'Unknown Batch';
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
          // Handle both camelCase and snake_case from database
          const feedType = item.feedType || item.feed_type || 'Unknown Feed';
          const quantity = item.quantity || item.quantity_kg || 0;
          const cost = item.cost || 0;

          return (
            <View style={styles(theme).recordContent}>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>🌾 Type: {feedType}</Text>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>📊 Quantity: {quantity} kg</Text>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>💰 Cost: ${cost}</Text>
            </View>
          );
        case 'health':
          // Handle both camelCase and snake_case from database
          const healthStatus = item.healthStatus || item.health_status || 'Unknown Status';
          const treatment = item.treatment || '';

          return (
            <View style={styles(theme).recordContent}>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>🏥 Status: {healthStatus}</Text>
              {treatment && <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>💊 Treatment: {treatment}</Text>}
            </View>
          );
        case 'mortality':
          // Handle both camelCase and snake_case from database
          const mortalityCount = item.count || 0;
          const mortalityCause = item.cause || '';

          return (
            <View style={styles(theme).recordContent}>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>⚠️ Deaths: {mortalityCount} birds</Text>
              {mortalityCause && <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>🔍 Cause: {mortalityCause}</Text>}
            </View>
          );
        case 'production':
          // Handle both camelCase and snake_case from database
          const eggsCollected = item.eggsCollected || item.eggs_collected || 0;
          const productionWeight = item.weight || item.total_weight || item.egg_weight_avg || 0;

          // DEBUG: Log production record to see field names
          console.log('🔍 Production record item:', JSON.stringify(item, null, 2));

          return (
            <View style={styles(theme).recordContent}>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>🥚 {eggsCollected} eggs</Text>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>⚖️ {productionWeight} kg</Text>
            </View>
          );
        case 'water':
          // Handle both camelCase and snake_case from database
          const waterQuantity = item.quantityLiters || item.quantity_liters || 0;
          const waterSource = item.waterSource || item.water_source || '';
          const waterQuality = item.quality || '';
          const waterTemp = item.temperature || '';

          return (
            <View style={styles(theme).recordContent}>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>💧 {waterQuantity} liters</Text>
              {waterSource && <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>🚰 Source: {waterSource}</Text>}
              {waterQuality && <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>✨ Quality: {waterQuality}</Text>}
              {waterTemp && <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>🌡️ {waterTemp}°C</Text>}
            </View>
          );
        case 'weight':
          // Handle both camelCase and snake_case from database
          const avgWeight = item.averageWeight || item.average_weight || 0;
          const sampleSize = item.sampleSize || item.sample_size || 0;

          return (
            <View style={styles(theme).recordContent}>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>⚖️ Average: {avgWeight} kg</Text>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>📊 Sample: {sampleSize} birds</Text>
            </View>
          );
        case 'vaccination':
          // Handle both camelCase and snake_case from database
          const vaccinationType = item.vaccinationType || item.vaccination_type || 'Unknown';
          const vaccinationDate = item.vaccinationDate || item.vaccination_date || '';
          const vaccinationTime = item.vaccinationTime || item.vaccination_time || '';
          const medication = item.medication || '';

          return (
            <View style={styles(theme).recordContent}>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>💉 Type: {vaccinationType}</Text>
              <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>📅 Date: {formatDate(vaccinationDate)}{vaccinationTime ? ` at ${vaccinationTime}` : ''}</Text>
              {medication && <Text style={[styles(theme).recordDetail, { color: theme.colors.text }]}>💊 Medication: {medication}</Text>}
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
          <Text style={[styles(theme).recordFarm, { color: theme.colors.textSecondary }]}>🏠 {getFarmName(item)}</Text>
          <Text style={[styles(theme).recordBatch, { color: theme.colors.textSecondary }]}>🐔 {getBatchName(item)}</Text>
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
        styles(theme).tabButton,
        activeTab === tabKey && [styles(theme).activeTabButton, { borderBottomColor: theme.colors.primary }]
      ]}
      onPress={() => setActiveTab(tabKey)}
    >
      <Text style={styles(theme).tabIcon}>{icon}</Text>
      <Text style={[
        styles(theme).tabText,
        { color: theme.colors.textSecondary },
        activeTab === tabKey && [styles(theme).activeTabText, { color: theme.colors.primary }]
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
            <View style={styles(theme).formGroup}>
              <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Feed Type *</Text>
              <TextInput
                style={[styles(theme).formInput, {
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

            <View style={styles(theme).row}>
              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Quantity (kg) *</Text>
                <TextInput
                  style={[styles(theme).formInput, {
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

              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Cost ($)</Text>
                <TextInput
                  style={[styles(theme).formInput, {
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
            <View style={styles(theme).formGroup}>
              <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Health Status *</Text>
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

            <View style={styles(theme).formGroup}>
              <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Treatment</Text>
              <TextInput
                style={[styles(theme).formInput, {
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
            <View style={styles(theme).row}>
              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Count *</Text>
                <TextInput
                  style={[styles(theme).formInput, {
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

              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Cause</Text>
                <TextInput
                  style={[styles(theme).formInput, {
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
            <View style={styles(theme).row}>
              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Eggs Collected</Text>
                <TextInput
                  style={[styles(theme).formInput, {
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

              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Weight (kg)</Text>
                <TextInput
                  style={[styles(theme).formInput, {
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
            <View style={styles(theme).formGroup}>
              <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Quantity (Liters) *</Text>
              <TextInput
                style={[styles(theme).formInput, {
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

            <View style={styles(theme).row}>
              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Water Source</Text>
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

              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Quality</Text>
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

            <View style={styles(theme).formGroup}>
              <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Temperature (°C)</Text>
              <TextInput
                style={[styles(theme).formInput, {
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
            <View style={styles(theme).row}>
              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Average Weight (kg) *</Text>
                <TextInput
                  style={[styles(theme).formInput, {
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

              <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Sample Size *</Text>
                <TextInput
                  style={[styles(theme).formInput, {
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

      case 'vaccination':
        return (
          <>
            <View style={styles(theme).formGroup}>
              <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Vaccination Type *</Text>
              <CustomPicker
                selectedValue={formData.vaccinationType}
                onValueChange={(itemValue) =>
                  setFormData(prev => ({ ...prev, vaccinationType: itemValue }))
                }
                items={[
                  { label: 'Newcastle Disease', value: 'Newcastle Disease' },
                  { label: 'Gumboro', value: 'Gumboro' },
                  { label: 'Marek\'s Disease', value: 'Marek\'s Disease' },
                  { label: 'Fowl Pox', value: 'Fowl Pox' },
                  { label: 'Infectious Bronchitis', value: 'Infectious Bronchitis' },
                  { label: 'Avian Influenza', value: 'Avian Influenza' },
                  { label: 'Fowl Cholera', value: 'Fowl Cholera' },
                  { label: 'Coccidiosis', value: 'Coccidiosis' }
                ]}
                placeholder="Select vaccination type"
              />
            </View>

            <View style={styles(theme).formGroup}>
              <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Vaccination Date *</Text>
              <TextInput
                style={[styles(theme).formInput, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.inputText
                }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.placeholder}
                value={formData.vaccinationDate}
                onChangeText={(text) =>
                  setFormData(prev => ({ ...prev, vaccinationDate: text }))
                }
              />
            </View>

            <View style={styles(theme).formGroup}>
              <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Vaccination Time</Text>
              <View style={styles(theme).timePickerRow}>
                <TextInput
                  style={[styles(theme).timeInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="12"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.vaccinationHour}
                  onChangeText={(text) => {
                    // Allow any text input while typing
                    setFormData(prev => ({ ...prev, vaccinationHour: text }));
                  }}
                  onBlur={() => {
                    // Validate and format when user leaves the field
                    let hour = formData.vaccinationHour.trim();
                    if (hour === '') {
                      setFormData(prev => ({ ...prev, vaccinationHour: '08' }));
                      return;
                    }
                    const num = parseInt(hour);
                    if (isNaN(num) || num < 1 || num > 12) {
                      setFormData(prev => ({ ...prev, vaccinationHour: '08' }));
                      return;
                    }
                    setFormData(prev => ({ ...prev, vaccinationHour: num.toString().padStart(2, '0') }));
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={[styles(theme).timeSeparator, { color: theme.colors.text }]}>:</Text>
                <TextInput
                  style={[styles(theme).timeInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="00"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.vaccinationMinute}
                  onChangeText={(text) => {
                    // Allow any text input while typing
                    setFormData(prev => ({ ...prev, vaccinationMinute: text }));
                  }}
                  onBlur={() => {
                    // Validate and format when user leaves the field
                    let minute = formData.vaccinationMinute.trim();
                    if (minute === '') {
                      setFormData(prev => ({ ...prev, vaccinationMinute: '00' }));
                      return;
                    }
                    const num = parseInt(minute);
                    if (isNaN(num) || num < 0 || num > 59) {
                      setFormData(prev => ({ ...prev, vaccinationMinute: '00' }));
                      return;
                    }
                    setFormData(prev => ({ ...prev, vaccinationMinute: num.toString().padStart(2, '0') }));
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <View style={styles(theme).periodButtons}>
                  <TouchableOpacity
                    style={[
                      styles(theme).periodButton,
                      {
                        backgroundColor: formData.vaccinationPeriod === 'AM' ? theme.colors.primary : theme.colors.surface,
                        borderColor: theme.colors.border
                      }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, vaccinationPeriod: 'AM' }))}
                  >
                    <Text style={[
                      styles(theme).periodText,
                      { color: formData.vaccinationPeriod === 'AM' ? theme.colors.buttonText : theme.colors.text }
                    ]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles(theme).periodButton,
                      {
                        backgroundColor: formData.vaccinationPeriod === 'PM' ? theme.colors.primary : theme.colors.surface,
                        borderColor: theme.colors.border
                      }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, vaccinationPeriod: 'PM' }))}
                  >
                    <Text style={[
                      styles(theme).periodText,
                      { color: formData.vaccinationPeriod === 'PM' ? theme.colors.buttonText : theme.colors.text }
                    ]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles(theme).formGroup}>
              <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Medication</Text>
              <TextInput
                style={[styles(theme).formInput, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.inputText
                }]}
                placeholder="Vaccine name (optional)"
                placeholderTextColor={theme.colors.placeholder}
                value={formData.medication}
                onChangeText={(text) =>
                  setFormData(prev => ({ ...prev, medication: text }))
                }
              />
            </View>
          </>
        );
    }
  };

  if (loading) {
    return (
      <View style={[styles(theme).loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles(theme).loadingText, { color: theme.colors.textSecondary }]}>Loading Records...</Text>
      </View>
    );
  }

  return (
    <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles(theme).header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles(theme).headerTitle, { color: theme.colors.text }]}>Records</Text>
        <TouchableOpacity
          style={[styles(theme).addButton, { backgroundColor: theme.colors.primary }]}
          onPress={openModal}
        >
          <Text style={styles(theme).addButtonText}>+ Add Record</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal style={[styles(theme).tabsContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]} showsHorizontalScrollIndicator={false}>
        {renderTabButton('feed', 'Feed', '🌾')}
        {renderTabButton('health', 'Health', '🏥')}
        {renderTabButton('mortality', 'Mortality', '⚠️')}
        {renderTabButton('production', 'Production', '🥚')}
        {renderTabButton('water', 'Water', '💧')}
        {renderTabButton('weight', 'Weight', '⚖️')}
        {renderTabButton('vaccination', 'Vaccination', '💉')}
      </ScrollView>

      {/* Records List */}
      {safeRecords.length === 0 ? (
        <View style={styles(theme).emptyContainer}>
          <Text style={styles(theme).emptyIcon}>📝</Text>
          <Text style={[styles(theme).emptyTitle, { color: theme.colors.text }]}>No {activeTab} records</Text>
          <Text style={[styles(theme).emptyText, { color: theme.colors.textSecondary }]}>
            Start recording your {activeTab} data to track your farm's performance
          </Text>
          <TouchableOpacity
            style={[styles(theme).emptyButton, { backgroundColor: theme.colors.primary }]}
            onPress={openModal}
          >
            <Text style={styles(theme).emptyButtonText}>Add First Record</Text>
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
          contentContainerStyle={styles(theme).recordsList}
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
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          updateCellsBatchingPeriod={100}
          getItemLayout={null}
          ListEmptyComponent={null}
          extraData={activeTab}
          onEndReached={loadMoreRecords}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore && hasMore ? (
              <View style={styles(theme).loadingMoreContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles(theme).loadingMoreText, { color: theme.colors.textSecondary }]}>
                  Loading more records...
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Add Record Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={[styles(theme).modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles(theme).modalContent, { backgroundColor: theme.colors.surface }]}>
            <ScrollView>
              <Text style={[styles(theme).modalTitle, { color: theme.colors.text }]}>
                Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Record
              </Text>

              {/* Common fields */}
              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Farm *</Text>
                <CustomPicker
                  selectedValue={String(formData.farmId)}
                  onValueChange={(itemValue) =>
                    setFormData(prev => ({ ...prev, farmId: itemValue === '' ? '' : parseInt(itemValue) }))
                  }
                  items={[
                    {
                      label: Array.isArray(farms) && farms.length === 0 ? "No farms - Create a farm first" : "-- Select a farm --",
                      value: ""
                    },
                    ...((Array.isArray(farms) ? farms : [])
                      .filter(farm => farm && (farm.id || farm._id))
                      .map(farm => ({
                        label: farm.location ? `${farm.farmName || farm.name || 'Unnamed Farm'} - ${farm.location}` : (farm.farmName || farm.name || 'Unnamed Farm'),
                        value: String(farm.id || farm._id)
                      })))
                  ]}
                  placeholder="Select a farm"
                />
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Batch *</Text>
                <CustomPicker
                  selectedValue={String(formData.batchId)}
                  onValueChange={(itemValue) =>
                    setFormData(prev => ({ ...prev, batchId: itemValue === '' ? '' : parseInt(itemValue) }))
                  }
                  items={[
                    {
                      label: Array.isArray(batches) && batches.length === 0 ? "No batches - Create a batch first" : "-- Select a batch --",
                      value: ""
                    },
                    ...((Array.isArray(batches) ? batches : [])
                      .filter(batch => batch && (batch.id || batch._id))
                      .map(batch => ({
                        label: batch.breed && batch.currentCount ? `${batch.batchName || batch.name || 'Unnamed Batch'} - ${batch.breed} (${batch.currentCount} birds)` : (batch.batchName || batch.name || 'Unnamed Batch'),
                        value: String(batch.id || batch._id)
                      })))
                  ]}
                  placeholder="Select a batch"
                />
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Date *</Text>
                <TextInput
                  style={[styles(theme).formInput, {
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

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Notes</Text>
                <TextInput
                  style={[styles(theme).formInput, styles(theme).textArea, {
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

              <View style={styles(theme).modalActions}>
                <TouchableOpacity
                  style={[styles(theme).cancelButton, { backgroundColor: theme.colors.borderSecondary }]}
                  onPress={closeModal}
                >
                  <Text style={[styles(theme).cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles(theme).saveButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSaveRecord}
                >
                  <Text style={styles(theme).saveButtonText}>Save Record</Text>
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
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeInput: {
    width: 60,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 18,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  periodButtons: {
    flexDirection: 'row',
    marginLeft: 10,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RecordsScreen;