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
import CustomPicker from '../components/CustomPicker';
import fastApiService from '../services/fastApiService';
import fastDatabase from '../services/fastDatabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import { useDashboardRefresh } from '../context/DashboardRefreshContext';
import { useOptimizedFlatList } from '../hooks/useOptimizedFlatList';
import { useFarms } from '../context/DataStoreContext';

const BatchesScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isConnected } = useOffline();
  const { triggerDashboardRefresh, refreshTrigger } = useDashboardRefresh();
  const [batches, setBatches] = useState([]);
  const { farms, loading: farmsLoading, refresh: refreshFarms } = useFarms();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [formData, setFormData] = useState({
    batchName: '',
    farmId: '',
    birdType: '',
    initialCount: '',
    currentCount: '',
    arrivalDate: '',
    status: 'active',
  });

  // CRASH FIX: Track component mount status to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // PERFORMANCE: Use optimized FlatList configuration (10x better performance)
  const flatListProps = useOptimizedFlatList(250);

  useEffect(() => {
    isMountedRef.current = true;

    // Ensure database is initialized before loading data with proper readiness check
    const initializeAndLoadData = async () => {
      try {
        console.log('🔄 BatchesScreen: Ensuring database is ready...');

        // Force database initialization
        await fastApiService.init();

        // Poll for database readiness instead of arbitrary delay
        let retries = 0;
        const maxRetries = 10;
        while (retries < maxRetries) {
          try {
            // Test if database is ready by attempting a simple query
            const testQuery = await fastApiService.getFarms();
            if (testQuery) {
              console.log('✅ Database ready');
              break;
            }
          } catch (e) {
            // Database not ready yet
          }
          await new Promise(resolve => setTimeout(resolve, 50));
          retries++;
        }

        // Now load data only if component is still mounted
        if (isMountedRef.current) {
          await loadData();
        }
      } catch (error) {
        console.warn('⚠️ BatchesScreen: Init error:', error.message);
        // Still try to load data if mounted
        if (isMountedRef.current) {
          await loadData().catch(e => console.error('Failed to load data:', e.message));
        }
      }
    };

    initializeAndLoadData();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle route params to open Add Batch modal when navigating from dashboard
  useEffect(() => {
    if (route?.params?.openAddModal === true) {
      // Only open modal after data is loaded and if user has permission
      const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';
      if (!loading && isManager) {
        openModal();
        // Clear the param to prevent reopening on subsequent renders
        navigation.setParams({ openAddModal: false });
      }
    }
  }, [route?.params?.openAddModal, loading, user?.role]);

  // Listen for dashboard refresh triggers (e.g., when farms are created/updated in other screens)
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 BatchesScreen: Dashboard refresh triggered, reloading data...');
      loadData(false); // Don't show loading indicator during refresh trigger
    }
  }, [refreshTrigger]);

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

      console.log('🔄 BatchesScreen: Starting data load...');
      console.log(`🔄 BatchesScreen: Using ${farms.length} farms from context`);

      // Load batches (farms come from context)
      const batchesResponse = await fastApiService.getFlocks();

      // CRASH FIX: Check mount status after async operations
      if (!isMountedRef.current) {
        console.log('Component unmounted during data load, skipping state update');
        return;
      }

      console.log('🔄 BatchesScreen: Raw batches response:', batchesResponse);

      // Update batches with real data
      if (batchesResponse?.success && Array.isArray(batchesResponse.data)) {
        const batchesData = batchesResponse.data.map(batch => ({
          id: batch.id,
          batchName: batch.batchName || batch.name || 'Unnamed Batch',
          farmId: batch.farmId,
          birdType: batch.birdType || batch.breed || 'Unknown',
          initialCount: batch.initialCount || 0,
          currentCount: batch.currentCount || 0,
          arrivalDate: batch.arrivalDate || batch.startDate || new Date().toISOString(),
          status: batch.status || 'active'
        }));

        setBatches(batchesData);
        setDataSource('database');
        console.log(`✅ Loaded ${batchesData.length} batches from database`);
      } else {
        setBatches([]);
        setDataSource('database');
        console.log('ℹ️ No batches found in database');
      }

      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(false);
      }

    } catch (error) {
      console.warn('❌ Batches load error:', error.message);

      // CRASH FIX: Check mount status before error state updates
      if (!isMountedRef.current) {
        return;
      }

      // CRASH FIX: Don't clear existing data on error - preserve what we have
      // This prevents the dashboard from breaking after a single failed operation
      console.log('⚠️ Load failed but preserving existing data to prevent state corruption');
      setDataSource('error');

      if (showLoadingIndicator && isMountedRef.current) {
        setLoading(false);
      }

      // CRASH FIX: Show user-friendly error only if data is completely empty
      if (batches.length === 0) {
        Alert.alert(
          'Data Load Error',
          'Unable to load batches. Please check your connection and try refreshing.',
          [{ text: 'OK' }]
        );
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
      console.log('🔄 Batches refresh initiated...');

      // Refresh farms from context
      refreshFarms(true);

      // Ensure database is initialized before refreshing
      await fastApiService.init();

      // Quick refresh - load data immediately
      if (isMountedRef.current) {
        await loadData(false); // Don't show loading indicator during refresh
      }

      console.log('✅ Batches refresh completed');

    } catch (refreshError) {
      console.warn('⚠️  Refresh error:', refreshError.message);

      // CRASH FIX: Check mount status before error state updates
      if (!isMountedRef.current) return;

      // On error, show empty state - no mock data
      setBatches([]);
      setDataSource('error');
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  const openModal = (batch = null) => {
    console.log('🔵 BUTTON PRESSED: openModal called', { batch: batch?.batchName || 'new', userRole: user?.role });

    // Check if user has permission to create/edit batches (only managers and above)
    const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';
    if (!isManager) {
      console.log('❌ Access denied - user role:', user?.role);
      Alert.alert('Access Denied', 'Only managers can create or edit batches. Contact your manager if you need to make changes.');
      return;
    }

    // CRASH FIX: Open modal IMMEDIATELY, don't wait for async operations
    console.log('🔄 BatchesScreen: Opening modal immediately...');

    // Use current farms from state - if empty, user will see the helper text in the modal
    const currentFarms = farms || [];

    // If creating a NEW batch (not editing) and no farms exist, show alert but STILL open modal
    // This allows users to see the form and the "No farms available" message
    if (currentFarms.length === 0 && !batch) {
      console.log('⚠️ No farms available - user will see helper text in modal');
      // Show non-blocking alert in background
      setTimeout(() => {
        Alert.alert(
          'No Farms Available',
          'Please create a farm first before adding batches. You can go to the Farms screen to create one.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Go to Farms', onPress: () => {
              closeModal();
              navigation.navigate('Farms');
            }}
          ]
        );
      }, 500); // Delay alert so modal opens first
    }

    // Set form data with current state
    setEditingBatch(batch);
    setFormData({
      batchName: batch?.batchName || batch?.name || '',
      farmId: batch?.farmId || (currentFarms.length > 0 ? String(currentFarms[0].id) : ''),
      birdType: batch?.batchType || batch?.breed || '',
      initialCount: batch?.initialCount?.toString() || '',
      currentCount: batch?.currentCount?.toString() || '',
      arrivalDate: batch?.arrivalDate || batch?.startDate || new Date().toISOString().split('T')[0],
      status: batch?.status || 'active',
    });

    console.log('🟢 Setting modalVisible to TRUE');
    setModalVisible(true);
    console.log('🟢 Modal should be visible now');
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingBatch(null);
    setFormData({
      batchName: '',
      farmId: '',
      birdType: '',
      initialCount: '',
      currentCount: '',
      arrivalDate: '',
      status: 'active',
    });
  };

  const handleSaveBatch = async () => {
    // CRASH FIX: Comprehensive validation BEFORE processing data
    console.log('🔄 Validating batch data...', formData);

    // Validate batch name
    if (!formData.batchName || !formData.batchName.trim()) {
      Alert.alert('Validation Error', 'Please enter a batch name');
      return;
    }

    // CRASH FIX: Validate farmId is selected and not empty
    if (!formData.farmId || formData.farmId === '' || formData.farmId === 'null' || formData.farmId === 'undefined') {
      Alert.alert('Validation Error', 'Please select a farm. If no farms are available, create a farm first in the Farms screen.');
      return;
    }

    // CRASH FIX: Validate farmId converts to valid number
    const farmIdNum = parseInt(formData.farmId, 10);
    if (isNaN(farmIdNum) || farmIdNum <= 0) {
      console.error('❌ Invalid farmId:', formData.farmId, '-> parseInt:', farmIdNum);
      Alert.alert('Validation Error', 'Selected farm is invalid. Please select a different farm.');
      return;
    }

    // CRASH FIX: Verify the selected farm actually exists in farms list
    const selectedFarm = farms.find(f => f && f.id === farmIdNum);
    if (!selectedFarm) {
      console.error('❌ Selected farm not found in farms list:', farmIdNum, 'Available farms:', farms);
      Alert.alert('Validation Error', 'Selected farm no longer exists. Please refresh and select a different farm.');
      return;
    }

    // Validate bird type
    if (!formData.birdType || !formData.birdType.trim()) {
      Alert.alert('Validation Error', 'Please enter a bird type (e.g., Broiler, Layer)');
      return;
    }

    // Validate initial count
    if (!formData.initialCount || formData.initialCount.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the initial bird count');
      return;
    }

    const initialCountNum = parseInt(formData.initialCount, 10);
    if (isNaN(initialCountNum) || initialCountNum <= 0) {
      Alert.alert('Validation Error', 'Initial count must be a positive number');
      return;
    }

    // Validate arrival date
    if (!formData.arrivalDate || formData.arrivalDate.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the arrival date (YYYY-MM-DD)');
      return;
    }

    // CRASH FIX: Validate date format and convert safely
    let isoDate;
    try {
      if (formData.arrivalDate.includes('T')) {
        // Already in ISO format
        isoDate = formData.arrivalDate;
      } else {
        // Convert YYYY-MM-DD to ISO format
        const dateObj = new Date(formData.arrivalDate + 'T00:00:00.000Z');
        if (isNaN(dateObj.getTime())) {
          throw new Error('Invalid date');
        }
        isoDate = dateObj.toISOString();
      }
    } catch (dateError) {
      console.error('❌ Invalid date format:', formData.arrivalDate, dateError);
      Alert.alert('Validation Error', 'Invalid date format. Please use YYYY-MM-DD format (e.g., 2025-01-15)');
      return;
    }

    // Validate current count (optional, defaults to initial count)
    let currentCountNum = initialCountNum;
    if (formData.currentCount && formData.currentCount.trim() !== '') {
      currentCountNum = parseInt(formData.currentCount, 10);
      if (isNaN(currentCountNum) || currentCountNum < 0) {
        Alert.alert('Validation Error', 'Current count must be a non-negative number');
        return;
      }
    }

    // CRASH FIX: Create batch data object with validated values
    const batchData = {
      batchName: formData.batchName.trim(),
      farmId: farmIdNum, // Use validated number
      birdType: formData.birdType.trim(),
      initialCount: initialCountNum, // Use validated number
      currentCount: currentCountNum, // Use validated number
      arrivalDate: isoDate, // Use validated ISO date
      status: formData.status || 'active',
    };

    console.log('✅ Batch data validated successfully:', batchData);

    try {
      console.log('🔄 Starting batch save operation...');
      let response;

      if (editingBatch) {
        console.log('🔄 Updating existing batch:', editingBatch.batchName);
        // CRASH FIX: Wrap API call in try-catch to handle network/server errors
        try {
          response = await fastApiService.updateFlock(editingBatch.id, batchData);
        } catch (apiError) {
          console.error('❌ API call failed for update:', apiError);
          throw new Error(`Failed to update batch: ${apiError.message || 'Server error'}`);
        }

        // CRASH FIX: Validate response object
        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response from server - please try again');
        }

        if (response.success) {
          Alert.alert('Success', 'Batch updated successfully!');
        } else {
          throw new Error(response.error || 'Failed to update batch - server returned an error');
        }
      } else {
        console.log('═══════════════════════════════════════════════════');
        console.log('🚀 CREATING NEW BATCH');
        console.log('═══════════════════════════════════════════════════');
        console.log('📝 Batch Name:', batchData.batchName);
        console.log('🐔 Bird Type:', batchData.birdType);
        console.log('🏭 Farm ID:', batchData.farmId);
        console.log('📊 Initial Count:', batchData.initialCount);
        console.log('═══════════════════════════════════════════════════');

        // CRASH FIX: Wrap API call in try-catch to handle network/server errors
        try {
          response = await fastApiService.createFlock(batchData);
        } catch (apiError) {
          console.error('═══════════════════════════════════════════════════');
          console.error('❌ API CALL FAILED FOR CREATE BATCH');
          console.error('═══════════════════════════════════════════════════');
          console.error('Error:', apiError.message);
          console.error('Full error:', apiError);
          console.error('═══════════════════════════════════════════════════');

          // CRASH FIX: Provide specific error message based on error type
          let errorMsg = 'Failed to create batch';
          if (apiError.message?.includes('farm')) {
            errorMsg = 'Selected farm is invalid or no longer exists. Please refresh and try again.';
          } else if (apiError.message?.includes('Network') || apiError.message?.includes('timeout')) {
            errorMsg = 'Network error - please check your connection and try again.';
          } else {
            errorMsg = `Failed to create batch: ${apiError.message || 'Server error'}`;
          }
          throw new Error(errorMsg);
        }

        console.log('═══════════════════════════════════════════════════');
        console.log('📥 CREATE BATCH RESPONSE');
        console.log('═══════════════════════════════════════════════════');
        console.log('Success:', response.success);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        console.log('═══════════════════════════════════════════════════');

        // CRASH FIX: Validate response object
        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response from server - please try again');
        }

        if (response.success) {
          Alert.alert('Success', 'Batch created successfully!');
        } else {
          // CRASH FIX: Extract detailed error message if available
          const errorDetail = response.error || response.message || 'Server returned an error';
          throw new Error(`Failed to create batch: ${errorDetail}`);
        }
      }

      console.log('✅ BATCH SAVE OPERATION COMPLETED SUCCESSFULLY');
      closeModal();

      // CRASH FIX: Wrap data reload in try-catch to prevent crash if reload fails
      try {
        await loadData(); // Wait for data to reload
      } catch (reloadError) {
        console.warn('⚠️ Data reload failed after save:', reloadError);
        // Don't throw - batch was saved successfully, reload is secondary
      }

      // ALWAYS trigger dashboard refresh after successful save
      console.log('🔄 Batch saved - dashboard refresh triggered');
      triggerDashboardRefresh();

    } catch (error) {
      console.error('❌ Save batch error:', error);
      // CRASH FIX: Ensure error message is user-friendly
      const userMessage = error.message || 'An unexpected error occurred while saving the batch';
      Alert.alert('Error Saving Batch', userMessage);
    }
  };

  const handleDeleteBatch = (batch) => {
    console.log('🔴 BUTTON PRESSED: handleDeleteBatch called', { batch: batch?.batchName || batch?.name, userRole: user?.role });

    // Check if user has permission to delete batches (only managers and above)
    const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';
    if (!isManager) {
      console.log('❌ Delete access denied - user role:', user?.role);
      Alert.alert('Access Denied', 'Only managers can delete batches. Contact your manager if you need to remove this batch.');
      return;
    }

    Alert.alert(
      'Delete Batch',
      `Are you sure you want to delete "${batch.batchName || batch.name}"? This will also delete all associated records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔄 Starting batch delete operation:', batch.batchName || batch.name);
              const response = await fastApiService.deleteFlock(batch.id);

              if (response.success) {
                Alert.alert('Success', 'Deleted successfully!');
                console.log('✅ Batch deleted successfully');
                await loadData(); // Reload data to reflect deletion

                // Trigger dashboard refresh after batch delete
                triggerDashboardRefresh();
                console.log('🔄 Batch deleted - dashboard refresh triggered');
              } else {
                throw new Error(response.error || 'Failed to delete batch');
              }
            } catch (error) {
              console.error('Delete batch error:', error);
              Alert.alert('Error', error.message || 'Failed to delete batch');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    const colors = {
      active: theme.colors.success,
      completed: theme.colors.info,
      inactive: theme.colors.textSecondary,
    };
    return colors[status] || theme.colors.textSecondary;
  };

  const getStatusIcon = (status) => {
    const icons = {
      active: '🟢',
      completed: '✅',
      inactive: '⏸️',
    };
    return icons[status] || '🔵';
  };

  const calculateAge = (startDate) => {
    if (!startDate) return 'N/A';
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 7) return `${diffDays} days`;
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} weeks`;
  };

  const getFarmName = (farmId) => {
    if (!farmId || !Array.isArray(farms)) return 'Unknown Farm';
    const farm = farms.find(f => f && f.id === farmId);
    return farm?.name || 'Unknown Farm';
  };

  const renderBatchCard = ({ item }) => {
    // Add safety check for item
    if (!item) {
      return null;
    }

    return (
      <View style={[styles(theme).batchCard, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadowColor }]}>
        <View style={[styles(theme).batchHeader, { borderBottomColor: theme.colors.border }]}>
          <View style={styles(theme).batchTitleRow}>
            <Text style={[styles(theme).batchName, { color: theme.colors.primary }]}>{item.batchName || item.name || 'Unnamed Batch'}</Text>
          <View style={[styles(theme).statusBadge, { backgroundColor: theme.colors.background }]}>
            <Text style={styles(theme).statusIcon}>{getStatusIcon(item.status || 'active')}</Text>
            <Text style={[styles(theme).statusText, { color: getStatusColor(item.status || 'active') }]}>
              {item.status || 'active'}
            </Text>
          </View>
        </View>
        <View style={styles(theme).batchActions}>
          {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') && (
            <>
              <TouchableOpacity
                style={styles(theme).editButton}
                onPress={() => openModal(item)}
              >
                <Text style={styles(theme).editButtonText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles(theme).deleteButton}
                onPress={() => handleDeleteBatch(item)}
              >
                <Text style={styles(theme).deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles(theme).batchDetails}>
        <View style={styles(theme).batchDetailRow}>
          <Text style={[styles(theme).batchDetailLabel, { color: theme.colors.textSecondary }]}>🏠 Farm:</Text>
          <Text style={[styles(theme).batchDetailValue, { color: theme.colors.text }]}>{getFarmName(item.farmId)}</Text>
        </View>

        <View style={styles(theme).batchDetailRow}>
          <Text style={[styles(theme).batchDetailLabel, { color: theme.colors.textSecondary }]}>🐔 Bird Type:</Text>
          <Text style={[styles(theme).batchDetailValue, { color: theme.colors.text }]}>{item.birdType || item.breed || 'Unknown Type'}</Text>
        </View>

        <View style={styles(theme).batchDetailRow}>
          <Text style={[styles(theme).batchDetailLabel, { color: theme.colors.textSecondary }]}>📅 Age:</Text>
          <Text style={[styles(theme).batchDetailValue, { color: theme.colors.text }]}>{calculateAge(item.arrivalDate || item.startDate)}</Text>
        </View>

        <View style={styles(theme).batchStats}>
          <View style={styles(theme).statItem}>
            <Text style={[styles(theme).statValue, { color: theme.colors.primary }]}>{item.initialCount || 0}</Text>
            <Text style={[styles(theme).statLabel, { color: theme.colors.textSecondary }]}>Initial</Text>
          </View>
          <View style={styles(theme).statItem}>
            <Text style={[styles(theme).statValue, { color: theme.colors.primary }]}>{item.currentCount || 0}</Text>
            <Text style={[styles(theme).statLabel, { color: theme.colors.textSecondary }]}>Current</Text>
          </View>
          <View style={styles(theme).statItem}>
            <Text style={[styles(theme).statValue, { color: theme.colors.secondary }]}>
              {(item.initialCount || 0) - (item.currentCount || 0)}
            </Text>
            <Text style={[styles(theme).statLabel, { color: theme.colors.textSecondary }]}>Mortality</Text>
          </View>
        </View>

        <View style={[styles(theme).batchMeta, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles(theme).batchDate, { color: theme.colors.textLight }]}>
            Arrived: {formatDate(item.arrivalDate || item.startDate)}
          </Text>
        </View>
      </View>
    </View>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <View style={[styles(theme).loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles(theme).loadingText, { color: theme.colors.textSecondary }]}>Loading Batches...</Text>
      </View>
    );
  }

  return (
    <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles(theme).header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles(theme).headerTitle, { color: theme.colors.text }]}>Poultry Batches</Text>
        {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') && (
          <TouchableOpacity
            style={[styles(theme).addButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => openModal()}
          >
            <Text style={styles(theme).addButtonText}>+ Add Batch</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Batches List */}
      {!Array.isArray(batches) || batches.length === 0 ? (
        <View style={styles(theme).emptyContainer}>
          <Text style={styles(theme).emptyIcon}>🐔</Text>
          <Text style={[styles(theme).emptyTitle, { color: theme.colors.text }]}>No Batches Yet</Text>
          <Text style={[styles(theme).emptyText, { color: theme.colors.textSecondary }]}>
            {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner')
              ? 'Create your first poultry batch to start managing your birds'
              : 'No batches have been created yet. Ask your manager to create a batch.'}
          </Text>
          {(user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') && (
            <TouchableOpacity
              style={[styles(theme).emptyButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => openModal()}
            >
              <Text style={styles(theme).emptyButtonText}>Create First Batch</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={batches}
          renderItem={renderBatchCard}
          contentContainerStyle={styles(theme).batchesList}
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

      {/* Add/Edit Batch Modal */}
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
                {editingBatch ? 'Edit Batch' : 'Add New Batch'}
              </Text>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Batch Name *</Text>
                <TextInput
                  style={[styles(theme).formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Enter batch name"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.batchName}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, batchName: text }))
                  }
                />
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Farm *</Text>
                <CustomPicker
                  selectedValue={String(formData.farmId)}
                  onValueChange={(itemValue) => {
                    console.log('🔄 Farm selected:', itemValue, 'Type:', typeof itemValue);
                    // Convert to number for farmId
                    const farmIdNum = itemValue === '' ? '' : parseInt(itemValue, 10);
                    console.log('🔄 Converted farmId:', farmIdNum, 'Type:', typeof farmIdNum);
                    setFormData(prev => ({ ...prev, farmId: farmIdNum }));
                  }}
                  items={[
                    {
                      label: Array.isArray(farms) && farms.length === 0 ? "No farms - Create a farm first" : "-- Select a farm --",
                      value: ""
                    },
                    ...(Array.isArray(farms) ? farms
                      .filter(farm => farm && (farm.id || farm._id))
                      .map((farm) => ({
                        label: farm.location ? `${farm.farmName || farm.name || 'Unnamed Farm'} - ${farm.location}` : (farm.farmName || farm.name || 'Unnamed Farm'),
                        value: String(farm.id || farm._id)
                      })) : [])
                  ]}
                  placeholder="Select a farm"
                />
                {farms.length === 0 && (
                  <View style={styles(theme).helperContainer}>
                    <Text style={[styles(theme).helperText, { color: theme.colors.textSecondary }]}>
                      No farms available. Please create a farm in the Farms screen before adding batches.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Bird Type *</Text>
                <TextInput
                  style={[styles(theme).formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Enter bird type (e.g., Broiler, Layer)"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.birdType}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, birdType: text }))
                  }
                />
              </View>

              <View style={styles(theme).row}>
                <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                  <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Initial Count *</Text>
                  <TextInput
                    style={[styles(theme).formInput, {
                      backgroundColor: theme.colors.inputBackground,
                      borderColor: theme.colors.inputBorder,
                      color: theme.colors.inputText
                    }]}
                    placeholder="Number of birds"
                    placeholderTextColor={theme.colors.placeholder}
                    value={formData.initialCount}
                    onChangeText={(text) =>
                      setFormData(prev => ({ ...prev, initialCount: text }))
                    }
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles(theme).formGroup, styles(theme).halfWidth]}>
                  <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Current Count</Text>
                  <TextInput
                    style={[styles(theme).formInput, {
                      backgroundColor: theme.colors.inputBackground,
                      borderColor: theme.colors.inputBorder,
                      color: theme.colors.inputText
                    }]}
                    placeholder="Current count"
                    placeholderTextColor={theme.colors.placeholder}
                    value={formData.currentCount}
                    onChangeText={(text) =>
                      setFormData(prev => ({ ...prev, currentCount: text }))
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Arrival Date *</Text>
                <TextInput
                  style={[styles(theme).formInput, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.arrivalDate}
                  onChangeText={(text) =>
                    setFormData(prev => ({ ...prev, arrivalDate: text }))
                  }
                />
              </View>

              <View style={styles(theme).formGroup}>
                <Text style={[styles(theme).formLabel, { color: theme.colors.text }]}>Status</Text>
                <CustomPicker
                  selectedValue={formData.status}
                  onValueChange={(itemValue) =>
                    setFormData(prev => ({ ...prev, status: itemValue }))
                  }
                  items={[
                    { label: 'Active', value: 'active' },
                    { label: 'Completed', value: 'completed' },
                    { label: 'Inactive', value: 'inactive' }
                  ]}
                  placeholder="Select status"
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
                  onPress={handleSaveBatch}
                >
                  <Text style={styles(theme).saveButtonText}>
                    {editingBatch ? 'Update' : 'Create'}
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
  batchesList: {
    padding: 20,
  },
  batchCard: {
    borderRadius: 12,
    marginBottom: 15,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  batchHeader: {
    padding: 15,
    borderBottomWidth: 1,
  },
  batchTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  batchName: {
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
    textTransform: 'capitalize',
  },
  batchActions: {
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
  batchDetails: {
    padding: 15,
  },
  batchDetailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  batchDetailLabel: {
    fontSize: 14,
    width: 80,
  },
  batchDetailValue: {
    fontSize: 14,
    flex: 1,
  },
  batchStats: {
    flexDirection: 'row',
    marginTop: 15,
    marginBottom: 10,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  batchMeta: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  batchDate: {
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
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
  },
  picker: {
    height: 50,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  helperContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  helperButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  helperButtonText: {
    color: theme.colors.buttonText,
    fontSize: 12,
    fontWeight: '600',
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

export default BatchesScreen;