/**
 * Data Store Context
 *
 * Centralized reactive data store for the entire application.
 * Provides real-time updates across all screens via event subscriptions.
 *
 * Features:
 * - Automatic data refresh when events fire
 * - Data caching with TTL (Time To Live)
 * - Optimistic updates (immediate UI update + background sync)
 * - Hooks for easy access: useFarms(), useBatches(), useRecords(), useAnalytics()
 * - Loading and error states
 *
 * Usage:
 * // In your component
 * const { farms, loading, error, refreshFarms } = useFarms();
 * const { batches, loading, refreshBatches } = useBatches();
 * const { records, loading, refreshRecords } = useRecords('feed');
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dataEventBus, { EventTypes } from '../services/dataEventBus';
import fastApiService from '../services/fastApiService';

const DataStoreContext = createContext();

export const useDataStore = () => {
  const context = useContext(DataStoreContext);
  if (!context) {
    throw new Error('useDataStore must be used within a DataStoreProvider');
  }
  return context;
};

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

export const DataStoreProvider = ({ children }) => {
  // ==================== STATE ====================

  // Farms state
  const [farms, setFarms] = useState([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [farmsError, setFarmsError] = useState(null);
  const farmsCache = useRef({ data: null, timestamp: null });

  // Batches state
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState(null);
  const batchesCache = useRef({ data: null, timestamp: null });

  // Records state (all types)
  const [feedRecords, setFeedRecords] = useState([]);
  const [productionRecords, setProductionRecords] = useState([]);
  const [mortalityRecords, setMortalityRecords] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [waterRecords, setWaterRecords] = useState([]);
  const [weightRecords, setWeightRecords] = useState([]);

  const [recordsLoading, setRecordsLoading] = useState({});
  const [recordsError, setRecordsError] = useState({});
  const recordsCache = useRef({});

  // Analytics state
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const analyticsCache = useRef({ data: null, timestamp: null });

  // Dashboard data state
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const dashboardCache = useRef({ data: null, timestamp: null });

  // Track if component is mounted
  const isMountedRef = useRef(true);

  // ==================== CACHE HELPERS ====================

  const isCacheValid = (cache) => {
    if (!cache.data || !cache.timestamp) return false;
    const age = Date.now() - cache.timestamp;
    return age < CACHE_TTL;
  };

  const updateCache = (cache, data) => {
    cache.data = data;
    cache.timestamp = Date.now();
  };

  // ==================== DATA LOADING FUNCTIONS ====================

  /**
   * Load farms from fastApiService (offline-first, uses local database)
   */
  const loadFarms = useCallback(async (forceRefresh = false) => {
    // Check cache first unless forced refresh
    if (!forceRefresh && isCacheValid(farmsCache.current)) {
      console.log('[DataStore] Using cached farms');
      setFarms(farmsCache.current.data);
      return farmsCache.current.data;
    }

    try {
      setFarmsLoading(true);
      setFarmsError(null);

      // CRITICAL FIX: Use fastApiService instead of offlineFirstService
      // fastApiService reads directly from fastDatabase, no network required
      const response = await fastApiService.getFarms();
      const data = response?.data || response || [];

      if (isMountedRef.current) {
        setFarms(data);
        updateCache(farmsCache.current, data);
        console.log(`[DataStore] Loaded ${data.length} farms from fastDatabase`);
      }

      return data;
    } catch (error) {
      console.error('[DataStore] Error loading farms:', error);
      if (isMountedRef.current) {
        setFarmsError(error.message);
      }
      return [];
    } finally {
      if (isMountedRef.current) {
        setFarmsLoading(false);
      }
    }
  }, []);

  /**
   * Load batches from fastApiService (offline-first, uses local database)
   */
  const loadBatches = useCallback(async (forceRefresh = false) => {
    // Check cache first unless forced refresh
    if (!forceRefresh && isCacheValid(batchesCache.current)) {
      console.log('[DataStore] Using cached batches');
      setBatches(batchesCache.current.data);
      return batchesCache.current.data;
    }

    try {
      setBatchesLoading(true);
      setBatchesError(null);

      // CRITICAL FIX: Use fastApiService instead of offlineFirstService
      const response = await fastApiService.getFlocks();
      const data = response?.data || response || [];

      if (isMountedRef.current) {
        setBatches(data);
        updateCache(batchesCache.current, data);
        console.log(`[DataStore] Loaded ${data.length} batches from fastDatabase`);
      }

      return data;
    } catch (error) {
      console.error('[DataStore] Error loading batches:', error);
      if (isMountedRef.current) {
        setBatchesError(error.message);
      }
      return [];
    } finally {
      if (isMountedRef.current) {
        setBatchesLoading(false);
      }
    }
  }, []);

  /**
   * Load records by type from fastApiService (offline-first, uses local database)
   */
  const loadRecords = useCallback(async (recordType, forceRefresh = false) => {
    const cacheKey = `${recordType}_records`;

    // Initialize cache for this record type if needed
    if (!recordsCache.current[cacheKey]) {
      recordsCache.current[cacheKey] = { data: null, timestamp: null };
    }

    // Check cache first unless forced refresh
    if (!forceRefresh && isCacheValid(recordsCache.current[cacheKey])) {
      console.log(`[DataStore] Using cached ${recordType} records`);
      return recordsCache.current[cacheKey].data;
    }

    try {
      setRecordsLoading(prev => ({ ...prev, [recordType]: true }));
      setRecordsError(prev => ({ ...prev, [recordType]: null }));

      let response = null;
      let data = [];

      // CRITICAL FIX: Use fastApiService.getRecords() instead of offlineFirstService
      response = await fastApiService.getRecords(recordType);
      data = response?.data || response || [];

      if (isMountedRef.current) {
        switch (recordType) {
          case 'feed':
            setFeedRecords(data);
            break;
          case 'production':
            setProductionRecords(data);
            break;
          case 'mortality':
            setMortalityRecords(data);
            break;
          case 'health':
            setHealthRecords(data);
            break;
          case 'water':
            setWaterRecords(data);
            break;
          case 'weight':
            setWeightRecords(data);
            break;
          default:
            console.warn(`[DataStore] Unknown record type: ${recordType}`);
        }
      }

      updateCache(recordsCache.current[cacheKey], data);
      console.log(`[DataStore] Loaded ${data.length} ${recordType} records from fastDatabase`);

      return data;
    } catch (error) {
      console.error(`[DataStore] Error loading ${recordType} records:`, error);
      if (isMountedRef.current) {
        setRecordsError(prev => ({ ...prev, [recordType]: error.message }));
      }
      return [];
    } finally {
      if (isMountedRef.current) {
        setRecordsLoading(prev => ({ ...prev, [recordType]: false }));
      }
    }
  }, []);

  /**
   * Load analytics data from fastApiService (offline-first, uses local database)
   */
  const loadAnalytics = useCallback(async (params = {}, forceRefresh = false) => {
    // Check cache first unless forced refresh
    if (!forceRefresh && isCacheValid(analyticsCache.current)) {
      console.log('[DataStore] Using cached analytics');
      setAnalytics(analyticsCache.current.data);
      return analyticsCache.current.data;
    }

    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);

      // Calculate date range if not provided
      const defaultParams = {
        startDate: params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: params.endDate || new Date().toISOString().split('T')[0],
        ...params
      };

      // CRITICAL FIX: Use fastApiService.getAnalytics() instead of offlineFirstService
      const response = await fastApiService.getAnalytics(defaultParams);
      const data = response?.data || response || null;

      if (isMountedRef.current) {
        setAnalytics(data);
        updateCache(analyticsCache.current, data);
        console.log('[DataStore] Loaded analytics data from fastDatabase');
      }

      return data;
    } catch (error) {
      console.error('[DataStore] Error loading analytics:', error);
      if (isMountedRef.current) {
        setAnalyticsError(error.message);
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setAnalyticsLoading(false);
      }
    }
  }, []);

  /**
   * Load dashboard data from fastApiService (offline-first, uses local database)
   */
  const loadDashboard = useCallback(async (forceRefresh = false) => {
    // Check cache first unless forced refresh
    if (!forceRefresh && isCacheValid(dashboardCache.current)) {
      console.log('[DataStore] Using cached dashboard');
      setDashboardData(dashboardCache.current.data);
      return dashboardCache.current.data;
    }

    try {
      setDashboardLoading(true);
      setDashboardError(null);

      // CRITICAL FIX: Use fastApiService.getDashboard() instead of offlineFirstService
      const response = await fastApiService.getDashboard();
      const data = response?.data || response || null;

      if (isMountedRef.current) {
        setDashboardData(data);
        updateCache(dashboardCache.current, data);
        console.log('[DataStore] Loaded dashboard data from fastDatabase');
      }

      return data;
    } catch (error) {
      console.error('[DataStore] Error loading dashboard:', error);
      if (isMountedRef.current) {
        setDashboardError(error.message);
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setDashboardLoading(false);
      }
    }
  }, []);

  // ==================== EVENT HANDLERS ====================

  /**
   * Handle farm events
   */
  const handleFarmEvent = useCallback((payload) => {
    console.log('[DataStore] Farm event received, refreshing farms', payload);
    loadFarms(true); // Force refresh
  }, [loadFarms]);

  /**
   * Handle batch events
   */
  const handleBatchEvent = useCallback((payload) => {
    console.log('[DataStore] Batch event received, refreshing batches', payload);
    loadBatches(true); // Force refresh
  }, [loadBatches]);

  /**
   * Handle record events
   */
  const handleRecordEvent = useCallback((payload) => {
    console.log('[DataStore] Record event received, refreshing records', payload);

    // Refresh the specific record type if provided
    if (payload.recordType) {
      loadRecords(payload.recordType, true);
    } else {
      // Refresh all records if type not specified
      ['feed', 'production', 'mortality', 'health', 'water', 'weight'].forEach(type => {
        loadRecords(type, true);
      });
    }

    // Refresh analytics when records change (since analytics depends on records)
    // Use setTimeout to debounce multiple record events
    if (handleRecordEvent.analyticsRefreshTimer) {
      clearTimeout(handleRecordEvent.analyticsRefreshTimer);
    }
    handleRecordEvent.analyticsRefreshTimer = setTimeout(() => {
      console.log('[DataStore] Refreshing analytics due to record changes');
      loadAnalytics({}, true);
      loadDashboard(true);
    }, 1000); // Wait 1 second after last record event
  }, [loadRecords, loadAnalytics, loadDashboard]);

  /**
   * Handle sync complete event - refresh everything
   */
  const handleSyncComplete = useCallback((payload) => {
    console.log('[DataStore] Sync completed, refreshing all data', payload);

    // Refresh all data after sync
    loadFarms(true);
    loadBatches(true);
    loadDashboard(true);
    loadAnalytics({}, true); // Refresh analytics after sync

    // Refresh all record types
    ['feed', 'production', 'mortality', 'health', 'water', 'weight'].forEach(type => {
      loadRecords(type, true);
    });
  }, [loadFarms, loadBatches, loadDashboard, loadAnalytics, loadRecords]);

  /**
   * Handle analytics update event
   */
  const handleAnalyticsUpdate = useCallback((payload) => {
    console.log('[DataStore] Analytics update event received', payload);
    loadAnalytics(true);
    loadDashboard(true);
  }, [loadAnalytics, loadDashboard]);

  // ==================== SETUP EVENT SUBSCRIPTIONS ====================

  useEffect(() => {
    isMountedRef.current = true;

    console.log('[DataStore] Setting up event subscriptions');

    // Subscribe to farm events
    const farmUnsub = dataEventBus.subscribeMultiple(
      [EventTypes.FARM_CREATED, EventTypes.FARM_UPDATED, EventTypes.FARM_DELETED],
      handleFarmEvent
    );

    // Subscribe to batch events
    const batchUnsub = dataEventBus.subscribeMultiple(
      [EventTypes.BATCH_CREATED, EventTypes.BATCH_UPDATED, EventTypes.BATCH_DELETED],
      handleBatchEvent
    );

    // Subscribe to record events (all types)
    const recordUnsub = dataEventBus.subscribeMultiple([
      EventTypes.FEED_RECORD_CREATED, EventTypes.FEED_RECORD_UPDATED, EventTypes.FEED_RECORD_DELETED,
      EventTypes.PRODUCTION_RECORD_CREATED, EventTypes.PRODUCTION_RECORD_UPDATED, EventTypes.PRODUCTION_RECORD_DELETED,
      EventTypes.MORTALITY_RECORD_CREATED, EventTypes.MORTALITY_RECORD_UPDATED, EventTypes.MORTALITY_RECORD_DELETED,
      EventTypes.HEALTH_RECORD_CREATED, EventTypes.HEALTH_RECORD_UPDATED, EventTypes.HEALTH_RECORD_DELETED,
      EventTypes.WATER_RECORD_CREATED, EventTypes.WATER_RECORD_UPDATED, EventTypes.WATER_RECORD_DELETED,
      EventTypes.WEIGHT_RECORD_CREATED, EventTypes.WEIGHT_RECORD_UPDATED, EventTypes.WEIGHT_RECORD_DELETED,
      EventTypes.RECORD_CREATED, EventTypes.RECORD_UPDATED, EventTypes.RECORD_DELETED
    ], handleRecordEvent);

    // Subscribe to sync completion
    const syncUnsub = dataEventBus.subscribe(EventTypes.DATA_SYNCED, handleSyncComplete);

    // Subscribe to analytics updates
    const analyticsUnsub = dataEventBus.subscribe(EventTypes.ANALYTICS_UPDATED, handleAnalyticsUpdate);

    console.log('[DataStore] Event subscriptions established');

    // Cleanup on unmount
    return () => {
      console.log('[DataStore] Cleaning up event subscriptions');
      isMountedRef.current = false;
      farmUnsub();
      batchUnsub();
      recordUnsub();
      syncUnsub();
      analyticsUnsub();
    };
  }, [handleFarmEvent, handleBatchEvent, handleRecordEvent, handleSyncComplete, handleAnalyticsUpdate]);

  // ==================== OPTIMISTIC UPDATES ====================

  /**
   * Optimistically add item to local state before server confirms
   */
  const optimisticAdd = useCallback((type, item) => {
    console.log(`[DataStore] Optimistic add: ${type}`, item);

    switch (type) {
      case 'farm':
        setFarms(prev => [...prev, item]);
        break;
      case 'batch':
        setBatches(prev => [...prev, item]);
        break;
      case 'feed':
        setFeedRecords(prev => [...prev, item]);
        break;
      case 'production':
        setProductionRecords(prev => [...prev, item]);
        break;
      case 'mortality':
        setMortalityRecords(prev => [...prev, item]);
        break;
      case 'health':
        setHealthRecords(prev => [...prev, item]);
        break;
      case 'water':
        setWaterRecords(prev => [...prev, item]);
        break;
      case 'weight':
        setWeightRecords(prev => [...prev, item]);
        break;
    }
  }, []);

  /**
   * Optimistically update item in local state
   */
  const optimisticUpdate = useCallback((type, id, updates) => {
    console.log(`[DataStore] Optimistic update: ${type}`, { id, updates });

    const updateItem = (prev) => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );

    switch (type) {
      case 'farm':
        setFarms(updateItem);
        break;
      case 'batch':
        setBatches(updateItem);
        break;
      case 'feed':
        setFeedRecords(updateItem);
        break;
      case 'production':
        setProductionRecords(updateItem);
        break;
      case 'mortality':
        setMortalityRecords(updateItem);
        break;
      case 'health':
        setHealthRecords(updateItem);
        break;
      case 'water':
        setWaterRecords(updateItem);
        break;
      case 'weight':
        setWeightRecords(updateItem);
        break;
    }
  }, []);

  /**
   * Optimistically remove item from local state
   */
  const optimisticRemove = useCallback((type, id) => {
    console.log(`[DataStore] Optimistic remove: ${type}`, id);

    const removeItem = (prev) => prev.filter(item => item.id !== id);

    switch (type) {
      case 'farm':
        setFarms(removeItem);
        break;
      case 'batch':
        setBatches(removeItem);
        break;
      case 'feed':
        setFeedRecords(removeItem);
        break;
      case 'production':
        setProductionRecords(removeItem);
        break;
      case 'mortality':
        setMortalityRecords(removeItem);
        break;
      case 'health':
        setHealthRecords(removeItem);
        break;
      case 'water':
        setWaterRecords(removeItem);
        break;
      case 'weight':
        setWeightRecords(removeItem);
        break;
    }
  }, []);

  // ==================== CONTEXT VALUE ====================

  const contextValue = useMemo(() => ({
    // Farms
    farms,
    farmsLoading,
    farmsError,
    loadFarms,

    // Batches
    batches,
    batchesLoading,
    batchesError,
    loadBatches,

    // Records
    feedRecords,
    productionRecords,
    mortalityRecords,
    healthRecords,
    waterRecords,
    weightRecords,
    recordsLoading,
    recordsError,
    loadRecords,

    // Analytics
    analytics,
    analyticsLoading,
    analyticsError,
    loadAnalytics,

    // Dashboard
    dashboardData,
    dashboardLoading,
    dashboardError,
    loadDashboard,

    // Optimistic updates
    optimisticAdd,
    optimisticUpdate,
    optimisticRemove
  }), [
    farms, farmsLoading, farmsError, loadFarms,
    batches, batchesLoading, batchesError, loadBatches,
    feedRecords, productionRecords, mortalityRecords, healthRecords, waterRecords, weightRecords,
    recordsLoading, recordsError, loadRecords,
    analytics, analyticsLoading, analyticsError, loadAnalytics,
    dashboardData, dashboardLoading, dashboardError, loadDashboard,
    optimisticAdd, optimisticUpdate, optimisticRemove
  ]);

  return (
    <DataStoreContext.Provider value={contextValue}>
      {children}
    </DataStoreContext.Provider>
  );
};

// ==================== CUSTOM HOOKS ====================

/**
 * Hook to access farms data
 */
export const useFarms = () => {
  const { farms, farmsLoading, farmsError, loadFarms } = useDataStore();

  // Load farms on mount if not already loaded
  useEffect(() => {
    if (farms.length === 0 && !farmsLoading && !farmsError) {
      loadFarms();
    }
  }, []);

  return {
    farms,
    loading: farmsLoading,
    error: farmsError,
    refresh: loadFarms
  };
};

/**
 * Hook to access batches data
 */
export const useBatches = () => {
  const { batches, batchesLoading, batchesError, loadBatches } = useDataStore();

  // Load batches on mount if not already loaded
  useEffect(() => {
    if (batches.length === 0 && !batchesLoading && !batchesError) {
      loadBatches();
    }
  }, []);

  return {
    batches,
    loading: batchesLoading,
    error: batchesError,
    refresh: loadBatches
  };
};

/**
 * Hook to access records data by type
 */
export const useRecords = (recordType) => {
  const {
    feedRecords, productionRecords, mortalityRecords,
    healthRecords, waterRecords, weightRecords,
    recordsLoading, recordsError, loadRecords
  } = useDataStore();

  const getRecordsByType = useCallback(() => {
    switch (recordType) {
      case 'feed': return feedRecords;
      case 'production': return productionRecords;
      case 'mortality': return mortalityRecords;
      case 'health': return healthRecords;
      case 'water': return waterRecords;
      case 'weight': return weightRecords;
      default: return [];
    }
  }, [recordType, feedRecords, productionRecords, mortalityRecords, healthRecords, waterRecords, weightRecords]);

  // Load records on mount if not already loaded
  useEffect(() => {
    const records = getRecordsByType();
    if (records.length === 0 && !recordsLoading[recordType] && !recordsError[recordType]) {
      loadRecords(recordType);
    }
  }, [recordType]);

  return {
    records: getRecordsByType(),
    loading: recordsLoading[recordType] || false,
    error: recordsError[recordType] || null,
    refresh: () => loadRecords(recordType, true)
  };
};

/**
 * Hook to access analytics data
 */
export const useAnalytics = () => {
  const { analytics, analyticsLoading, analyticsError, loadAnalytics } = useDataStore();

  // Load analytics on mount if not already loaded
  useEffect(() => {
    if (!analytics && !analyticsLoading && !analyticsError) {
      loadAnalytics();
    }
  }, []);

  return {
    analytics,
    loading: analyticsLoading,
    error: analyticsError,
    refresh: loadAnalytics
  };
};

/**
 * Hook to access dashboard data
 */
export const useDashboard = () => {
  const { dashboardData, dashboardLoading, dashboardError, loadDashboard } = useDataStore();

  // Load dashboard on mount if not already loaded
  useEffect(() => {
    if (!dashboardData && !dashboardLoading && !dashboardError) {
      loadDashboard();
    }
  }, []);

  return {
    dashboard: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    refresh: loadDashboard
  };
};

export default DataStoreContext;
