import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import apiService from './api';
import offlineDataService from './offlineDataService';
import { syncCircuitBreaker } from '../utils/circuitBreaker';
import dataEventBus, { EventTypes } from './dataEventBus';
import fastDatabaseImport from './fastDatabase'; // P0-1 FIX: For ID mapping support

// FIX: Handle both default and named exports from fastDatabase
const fastDatabase = fastDatabaseImport.default || fastDatabaseImport;

class SyncService {
  constructor() {
    this.isSync = false;
    this.syncCallbacks = [];
    this.maxRetries = 3;
    this.batchSize = 10;

    // CRASH-003 FIX: Circuit breaker retry configuration
    this.circuitBreakerRetryDelay = 5000; // 5 seconds initial delay
    this.circuitBreakerMaxRetries = 3;
    this.circuitBreakerBackoffMultiplier = 2; // Exponential backoff

    // Table sync order (respecting foreign key constraints)
    this.syncOrder = [
      'organizations',
      'users',
      'farms',
      'poultry_batches',
      'customers',
      'feed_records',
      'production_records',
      'mortality_records',
      'health_records',
      'water_records',
      'weight_records',
      'expenses',
      'sales'
    ];

    // API endpoint mapping
    this.endpointMapping = {
      organizations: {
        create: '/organizations',
        update: '/organizations',
        delete: '/organizations',
        get: '/organizations'
      },
      users: {
        create: '/auth/register',
        update: '/users',
        delete: '/users',
        get: '/users'
      },
      farms: {
        create: '/farms',
        update: '/farms',
        delete: '/farms',
        get: '/farms'
      },
      poultry_batches: {
        create: '/flocks',
        update: '/flocks',
        delete: '/flocks',
        get: '/flocks'
      },
      feed_records: {
        create: '/feed-records',
        update: '/feed-records',
        delete: '/feed-records',
        get: '/feed-records'
      },
      production_records: {
        create: '/production-records',
        update: '/production-records',
        delete: '/production-records',
        get: '/production-records'
      },
      mortality_records: {
        create: '/mortality-records',
        update: '/mortality-records',
        delete: '/mortality-records',
        get: '/mortality-records'
      },
      health_records: {
        create: '/health-records',
        update: '/health-records',
        delete: '/health-records',
        get: '/health-records'
      },
      water_records: {
        create: '/water-records',
        update: '/water-records',
        delete: '/water-records',
        get: '/water-records'
      },
      weight_records: {
        create: '/weight-records',
        update: '/weight-records',
        delete: '/weight-records',
        get: '/weight-records'
      },
      expenses: {
        create: '/expenses',
        update: '/expenses',
        delete: '/expenses',
        get: '/expenses'
      },
      customers: {
        create: '/api/v1/customers',
        update: '/api/v1/customers',
        delete: '/api/v1/customers',
        get: '/api/v1/customers'
      },
      sales: {
        create: '/api/v1/sales',
        update: '/api/v1/sales',
        delete: '/api/v1/sales',
        get: '/api/v1/sales'
      }
    };
  }

  // Add sync status callback
  addSyncCallback(callback) {
    this.syncCallbacks.push(callback);
  }

  removeSyncCallback(callback) {
    this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
  }

  notifySyncCallbacks(status) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in sync callback:', error);
      }
    });
  }

  // CRASH-003 FIX: Auto-retry mechanism with exponential backoff for circuit breaker failures
  async syncDataWithRetry(options = {}) {
    const {
      maxRetries = this.circuitBreakerMaxRetries,
      initialDelay = this.circuitBreakerRetryDelay,
      backoffMultiplier = this.circuitBreakerBackoffMultiplier,
      onRetry = null
    } = options;

    let lastError = null;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.syncData();

        // Check if sync was blocked by circuit breaker
        if (result.blocked && result.reason === 'circuit_open' && attempt < maxRetries) {
          lastError = new Error(result.message);
          console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after circuit breaker block (waiting ${delay}ms)...`);

          // Notify about retry
          if (onRetry) {
            onRetry(attempt, maxRetries, delay);
          }

          this.notifySyncCallbacks({
            type: 'sync_retrying',
            attempt,
            maxRetries,
            delay,
            reason: 'circuit_open'
          });

          // Wait with exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= backoffMultiplier;

          continue; // Retry
        }

        // Return result (success or failure that shouldn't be retried)
        return result;

      } catch (error) {
        // This catch handles any unhandled errors from syncData
        lastError = error;
        console.error(`❌ Sync attempt ${attempt}/${maxRetries} failed:`, error.message);

        if (attempt < maxRetries) {
          console.log(`🔄 Retrying in ${delay}ms...`);

          if (onRetry) {
            onRetry(attempt, maxRetries, delay);
          }

          this.notifySyncCallbacks({
            type: 'sync_retrying',
            attempt,
            maxRetries,
            delay,
            error: error.message
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= backoffMultiplier;
        }
      }
    }

    // All retries exhausted
    console.error(`❌ Sync failed after ${maxRetries} attempts`);
    this.notifySyncCallbacks({
      type: 'sync_failed_permanently',
      error: lastError?.message || 'Unknown error',
      attempts: maxRetries
    });

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      message: `Sync failed after ${maxRetries} attempts`,
      retryable: false
    };
  }

  // UNIFIED BATCH SYNC - Main sync function with batch operations
  async syncData() {
    // CRASH FIX: Don't sync when app is backgrounded (prevents overheating)
    if (AppState.currentState !== 'active') {
      console.log('App in background, skipping sync');
      return { success: false, message: 'App in background' };
    }

    if (this.isSyncing) {
      console.log('ℹ️  Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    // CRASH-003 FIX: Wrap circuit breaker execution in try-catch to handle "Circuit open" errors
    try {
      // Wrap entire sync operation in circuit breaker to prevent cascading failures
      return await syncCircuitBreaker.execute(async () => {
        return this._performSync();
      });
    } catch (error) {
      // Handle circuit breaker errors gracefully
      if (error.message.includes('Circuit breaker is OPEN')) {
        console.warn('⏸️  Circuit breaker is open, sync blocked:', error.message);

        // Notify UI about circuit breaker state
        this.notifySyncCallbacks({
          type: 'sync_blocked',
          reason: 'circuit_open',
          message: error.message,
          canRetry: true
        });

        return {
          success: false,
          blocked: true,
          reason: 'circuit_open',
          message: error.message,
          retryable: true
        };
      } else if (error.message.includes('Operation timeout')) {
        console.error('⏱️  Sync operation timeout:', error.message);

        this.notifySyncCallbacks({
          type: 'sync_failed',
          reason: 'timeout',
          error: error.message
        });

        return {
          success: false,
          error: 'Sync timeout',
          message: error.message,
          retryable: true
        };
      } else {
        // Other circuit breaker or sync errors
        console.error('❌ Sync failed with error:', error);

        this.notifySyncCallbacks({
          type: 'sync_failed',
          error: error.message
        });

        return {
          success: false,
          error: error.message,
          message: `Sync failed: ${error.message}`,
          retryable: true
        };
      }
    }
  }

  async _performSync() {

    // CRASH FIX: More robust sync lock with guaranteed cleanup
    const syncLockTimeout = 180000; // 3 minutes (reduced from 5 to prevent hangs)
    let syncTimeoutId = null;
    let lockAcquired = false;
    let cleanupExecuted = false;

    // CRASH FIX: Guaranteed cleanup function
    const guaranteedCleanup = () => {
      if (cleanupExecuted) return; // Prevent double cleanup
      cleanupExecuted = true;

      if (syncTimeoutId) {
        clearTimeout(syncTimeoutId);
        syncTimeoutId = null;
      }

      if (lockAcquired) {
        this.isSyncing = false;
        console.log('🔓 Sync lock released (guaranteed cleanup)');
      }
    };

    try {
      this.isSyncing = true;
      lockAcquired = true;

      // CRASH FIX: Set timeout to force unlock sync if it hangs
      syncTimeoutId = setTimeout(() => {
        console.error('🚨 Sync timeout reached after 3 minutes, forcing unlock');
        guaranteedCleanup();
      }, syncLockTimeout);

      console.log('🔄 Starting unified batch sync...');
      this.notifySyncCallbacks({ type: 'sync_started' });

      // Pre-sync validation
      await this.validatePreSyncConditions();

      // Step 1: Get device ID
      const deviceId = await this.getDeviceId();

      // Step 2: Get last sync timestamp
      const lastSyncTimestamp = await AsyncStorage.getItem('lastSyncTimestamp');
      console.log(`📅 Last sync: ${lastSyncTimestamp ? new Date(lastSyncTimestamp).toLocaleString() : 'Never'}`);

      // Step 3: Collect all pending records (BATCH)
      console.log('📦 Collecting pending records for batch upload...');
      const pendingRecords = await this.getPendingRecords();
      const totalPending = Object.values(pendingRecords).reduce((sum, records) => sum + records.length, 0);
      console.log(`📊 Found ${totalPending} pending records across ${Object.keys(pendingRecords).length} tables`);

      // Step 4: Call unified sync endpoint with batch data
      console.log('🔄 Calling unified /api/v1/sync endpoint...');
      this.notifySyncCallbacks({ type: 'syncing', pendingCount: totalPending });

      // CRASH-003 FIX: Add explicit error handling for API call
      let syncResponse;
      try {
        // P1-1 FIX: Implement INCREMENTAL SYNC with ?since= query parameter
        // Only fetch records modified after lastSyncTimestamp to reduce bandwidth
        let syncEndpoint = '/v1/sync';
        if (lastSyncTimestamp) {
          const encodedTimestamp = encodeURIComponent(lastSyncTimestamp);
          syncEndpoint = `/v1/sync?since=${encodedTimestamp}`;
          console.log(`📅 Using incremental sync (fetching changes since ${new Date(lastSyncTimestamp).toLocaleString()})`);
        } else {
          console.log('📦 Using full sync (first-time sync)');
        }

        syncResponse = await apiService.api.post(syncEndpoint, {
          clientData: pendingRecords,
          lastSyncTimestamp,
          deviceId
        });
      } catch (apiError) {
        console.error('❌ Sync API call failed:', apiError.message);
        throw new Error(`Sync API failed: ${apiError.message}`);
      }

      // CRASH-003 FIX: Validate response structure
      if (!syncResponse || !syncResponse.data) {
        throw new Error('Invalid sync response: missing data');
      }

      const { uploadResults, serverData, newSyncTimestamp } = syncResponse.data;

      // CRASH-003 FIX: Validate critical response fields
      if (!newSyncTimestamp) {
        console.warn('⚠️ Sync response missing newSyncTimestamp, using current time');
      }

      console.log(`✅ Batch sync completed: ${newSyncTimestamp}`);

      // P0-3 FIX: Wrap local database operations in atomic transaction
      // This ensures all-or-nothing execution - if anything fails, everything rolls back
      console.log('🔒 Starting atomic transaction for local database updates...');

      try {
        await fastDatabase.withTransaction(async () => {
          // P0-2 FIX: Mark local records as synced BEFORE processing server data
          // This enforces PUSH-BEFORE-PULL to prevent data loss
          console.log('✅ Step 5: Marking local records as synced (PUSH complete)...');
          await this.markRecordsAsSynced(uploadResults);
          console.log('✅ Local records marked as synced successfully');

          // Step 6: Process server data (downloads) - happens AFTER push is complete
          console.log('📥 Step 6: Processing server data (PULL)...');
          await this.processServerData(serverData);
          console.log('✅ Server data processed successfully');
        });

        console.log('✅ Transaction committed - all local database updates successful');

      } catch (transactionError) {
        console.error('❌ Transaction failed and rolled back:', transactionError);
        // CRITICAL: Transaction rolled back - local database remains in consistent state
        // Records with needs_sync=1 will be retried on next sync
        console.warn('⚠️ Local database updates rolled back - will retry on next sync');
        throw transactionError; // Re-throw to trigger outer catch
      }

      // Step 7: Update sync timestamp
      // CRASH-003 FIX: Add error handling for timestamp updates
      const timestampToSave = newSyncTimestamp || new Date().toISOString();
      try {
        await AsyncStorage.setItem('lastSyncTimestamp', timestampToSave);
        await AsyncStorage.setItem('lastSyncTime', timestampToSave);
        await AsyncStorage.setItem('initialSyncCompleted', 'true');
      } catch (storageError) {
        console.error('❌ Error saving sync timestamp:', storageError);
        // Non-critical - sync succeeded even if timestamp save failed
      }

      console.log('✅ Unified batch sync completed successfully');
      this.notifySyncCallbacks({
        type: 'sync_completed',
        timestamp: newSyncTimestamp
      });

      // Emit DATA_SYNCED event to trigger UI refresh across all screens
      dataEventBus.emit(EventTypes.DATA_SYNCED, {
        timestamp: newSyncTimestamp,
        uploaded: totalPending,
        downloaded: Object.values(serverData).reduce((sum, records) => sum + records.length, 0),
        tables: Object.keys(serverData)
      });
      console.log('[SyncService] DATA_SYNCED event emitted');

      return {
        success: true,
        message: 'Sync completed successfully',
        timestamp: newSyncTimestamp,
        uploaded: totalPending,
        downloaded: Object.values(serverData).reduce((sum, records) => sum + records.length, 0)
      };

    } catch (error) {
      console.error('❌ Unified batch sync failed:', error);
      this.notifySyncCallbacks({
        type: 'sync_failed',
        error: error.message
      });

      return {
        success: false,
        message: `Sync failed: ${error.message}`,
        error: error.message
      };

    } finally {
      // CRASH FIX: Use guaranteed cleanup to prevent sync lock leaks
      guaranteedCleanup();
    }
  }

  // Get unique device identifier
  async getDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return `fallback-${Date.now()}`;
    }
  }

  // Collect all pending records from local database (BATCH COLLECTION)
  async getPendingRecords() {
    const tables = ['farms', 'poultry_batches', 'feed_records', 'production_records', 'mortality_records', 'health_records', 'water_records', 'weight_records'];
    const pendingData = {};

    for (const table of tables) {
      try {
        const records = await offlineDataService.getWhere(table, 'needs_sync = ?', [1]);

        if (records && records.length > 0) {
          pendingData[table] = records.map(record => {
            // Determine operation type
            let operation = 'CREATE';
            if (record.is_deleted) {
              operation = 'DELETE';
            } else if (record.server_id) {
              operation = 'UPDATE';
            }

            return {
              localId: record.id?.toString(),
              serverId: record.server_id,
              data: this.cleanRecordForSync(record),
              operation,
              updated_at: record.updated_at || new Date().toISOString()
            };
          });

          console.log(`  📄 ${table}: ${pendingData[table].length} records`);
        }
      } catch (error) {
        console.error(`Error collecting pending records from ${table}:`, error);
        // Continue with other tables
      }
    }

    return pendingData;
  }

  // Clean record data for sync (remove local-only fields)
  cleanRecordForSync(record) {
    const cleaned = { ...record };
    delete cleaned.id; // Remove local ID
    delete cleaned.needs_sync;
    delete cleaned.last_sync;
    return cleaned;
  }

  // Process server data and merge with local database (CONFLICT RESOLUTION)
  async processServerData(serverData) {
    if (!serverData || typeof serverData !== 'object') {
      console.log('No server data to process');
      return;
    }

    for (const [tableName, records] of Object.entries(serverData)) {
      if (!Array.isArray(records) || records.length === 0) continue;

      console.log(`  📥 Processing ${records.length} ${tableName} from server`);

      for (const serverRecord of records) {
        try {
          // Check if record exists locally
          const localRecord = await offlineDataService.getByServerId(tableName, serverRecord.id?.toString());

          if (localRecord) {
            // P0-4 FIX: Enhanced CONFLICT DETECTION & RESOLUTION
            const serverTime = new Date(serverRecord.updated_at || serverRecord.updatedAt || 0);
            const localTime = new Date(localRecord.updated_at || 0);
            const localNeedsSync = localRecord.needs_sync === 1;

            // CONFLICT: Both local and server have changes (local needs_sync=1 AND server has newer timestamp)
            if (localNeedsSync && serverTime > localTime) {
              console.warn(`  ⚠️  CONFLICT DETECTED: ${tableName} local_id=${localRecord.id} server_id=${serverRecord.id}`);

              // Store conflict for potential user resolution
              fastDatabase.storeConflict({
                tableName,
                localId: localRecord.id,
                serverId: serverRecord.id?.toString(),
                localData: localRecord,
                serverData: serverRecord,
                conflictType: 'concurrent_edit'
              });

              // AUTO-RESOLVE: Server wins (can be changed to local_wins or user_resolve)
              console.log(`  🔄 Auto-resolving conflict: SERVER WINS (updating local with server data)`);
              const mappedRecord = this.mapServerToLocalRecord(tableName, serverRecord);
              await offlineDataService.update(tableName, localRecord.id, mappedRecord, true); // skipSync = true

              // Emit conflict event for UI notification
              dataEventBus.emit(EventTypes.SYNC_CONFLICT_RESOLVED, {
                tableName,
                localId: localRecord.id,
                serverId: serverRecord.id,
                resolution: 'server_wins'
              });

            } else if (serverTime > localTime) {
              // Normal update - server newer, local not modified
              console.log(`  🔄 Updating local ${tableName} (server newer)`);
              const mappedRecord = this.mapServerToLocalRecord(tableName, serverRecord);
              await offlineDataService.update(tableName, localRecord.id, mappedRecord, true); // skipSync = true
            } else {
              // Local is newer - keep local
              console.log(`  ⏭️  Skipping ${tableName} (local newer)`);
            }
          } else {
            // New record from server - insert
            console.log(`  ➕ Inserting new ${tableName} from server`);
            const mappedRecord = this.mapServerToLocalRecord(tableName, serverRecord);
            mappedRecord.server_id = serverRecord.id?.toString();
            await offlineDataService.create(tableName, mappedRecord, true); // skipSync = true
          }
        } catch (error) {
          console.error(`Error processing server record for ${tableName}:`, error);
          // Continue with other records
        }
      }

      // Emit table-specific events after processing all records for this table
      this._emitTableUpdateEvent(tableName, records.length);
    }
  }

  // Emit appropriate event based on table name
  _emitTableUpdateEvent(tableName, recordCount) {
    const eventMap = {
      'farms': EventTypes.FARM_UPDATED,
      'poultry_batches': EventTypes.BATCH_UPDATED,
      'feed_records': EventTypes.FEED_RECORD_UPDATED,
      'production_records': EventTypes.PRODUCTION_RECORD_UPDATED,
      'mortality_records': EventTypes.MORTALITY_RECORD_UPDATED,
      'health_records': EventTypes.HEALTH_RECORD_UPDATED,
      'water_records': EventTypes.WATER_RECORD_UPDATED,
      'weight_records': EventTypes.WEIGHT_RECORD_UPDATED
    };

    const eventType = eventMap[tableName];
    if (eventType) {
      dataEventBus.emit(eventType, {
        source: 'sync',
        recordCount,
        tableName
      });
      console.log(`[SyncService] Emitted ${eventType} event for ${recordCount} ${tableName}`);
    }
  }

  // Mark local records as synced based on upload results
  async markRecordsAsSynced(uploadResults) {
    if (!uploadResults || typeof uploadResults !== 'object') return;

    for (const [tableName, results] of Object.entries(uploadResults)) {
      if (!Array.isArray(results)) continue;

      for (const result of results) {
        try {
          if (result.success && result.localId) {
            // Update local record with server ID and mark as synced
            await offlineDataService.markAsSynced(
              tableName,
              result.localId,
              result.serverId?.toString()
            );
            console.log(`  ✅ Marked ${tableName} ${result.localId} as synced`);
          } else if (!result.success && result.localId) {
            console.warn(`  ⚠️  Failed to sync ${tableName} ${result.localId}: ${result.error}`);
            // Record remains with needs_sync = 1 for retry
          }
        } catch (error) {
          console.error(`Error marking ${tableName} as synced:`, error);
        }
      }
    }
  }

  // Validate conditions before starting sync
  async validatePreSyncConditions() {
    try {
      // Check if offline data service is initialized
      if (!offlineDataService) {
        throw new Error('Offline data service not available');
      }

      // Check database health
      const dbHealthy = await offlineDataService.validateData();
      if (!dbHealthy.isValid && dbHealthy.warnings.length > 0) {
        console.warn('⚠️  Database validation warnings before sync:', dbHealthy.warnings);
      }

      console.log('✅ Pre-sync validation passed');
    } catch (error) {
      console.error('❌ Pre-sync validation failed:', error);
      throw new Error(`Pre-sync validation failed: ${error.message}`);
    }
  }

  // Update sync state after successful sync
  async updateSyncState() {
    try {
      const now = new Date().toISOString();

      // Update last sync time
      await AsyncStorage.setItem('lastSyncTime', now);
      await AsyncStorage.setItem('lastFullSyncTime', now);

      // Get sync statistics
      const syncStats = await this.getSyncStatistics();
      await AsyncStorage.setItem('lastSyncStats', JSON.stringify({
        ...syncStats,
        timestamp: now
      }));

      console.log('✅ Sync state updated successfully');
    } catch (error) {
      console.error('❌ Error updating sync state:', error);
      throw error;
    }
  }

  // Validate state after sync completion
  async validatePostSyncState() {
    try {
      // CRASH FIX: Check database initialization
      const databaseService = require('./database').default;
      if (!databaseService || !databaseService.isInitialized) {
        console.log('⏳ Database not initialized, skipping post-sync validation');
        return;
      }

      // Check if there are any failed sync items
      let failedCount = 0;
      try {
        failedCount = await offlineDataService.count('sync_queue', 'sync_status = ?', ['failed']) || 0;
        if (failedCount > 0) {
          console.warn(`⚠️  ${failedCount} sync items failed during sync`);
        }
      } catch (error) {
        console.warn('⚠️  Error checking failed sync items:', error.message);
      }

      // Validate data integrity
      try {
        const validation = await offlineDataService.validateData();
        if (!validation.isValid) {
          console.warn('⚠️  Data integrity issues found after sync:', validation.warnings);
        }
      } catch (error) {
        console.warn('⚠️  Error validating data integrity:', error.message);
      }

      console.log('✅ Post-sync validation completed');
    } catch (error) {
      console.warn('⚠️  Post-sync validation failed:', error);
      // Don't throw - this shouldn't fail the sync
    }
  }

  // Get sync statistics
  async getSyncStatistics() {
    try {
      // CRASH FIX: Import and check database service
      const databaseService = require('./database').default;

      // Check if database is initialized before getting statistics
      if (!databaseService || !databaseService.isInitialized) {
        console.log('⏳ Database not initialized, returning default sync statistics');
        return { pending: 0, failed: 0, synced: 0, total: 0 };
      }

      // Safely get counts with fallbacks
      let pendingCount = 0;
      let failedCount = 0;
      let syncedCount = 0;

      try {
        pendingCount = await offlineDataService.count('sync_queue', 'sync_status = ?', ['pending']) || 0;
      } catch (error) {
        console.warn('Error getting pending count:', error.message);
      }

      try {
        failedCount = await offlineDataService.count('sync_queue', 'sync_status = ?', ['failed']) || 0;
      } catch (error) {
        console.warn('Error getting failed count:', error.message);
      }

      try {
        syncedCount = await offlineDataService.count('sync_queue', 'sync_status = ?', ['synced']) || 0;
      } catch (error) {
        console.warn('Error getting synced count:', error.message);
      }

      return {
        pending: pendingCount,
        failed: failedCount,
        synced: syncedCount,
        total: pendingCount + failedCount + syncedCount
      };
    } catch (error) {
      console.error('Error getting sync statistics:', error);
      return { pending: 0, failed: 0, synced: 0, total: 0 };
    }
  }

  // Enhanced download with retry and progress tracking
  async downloadServerData() {
    try {
      this.notifySyncCallbacks({ type: 'downloading' });

      const lastSyncTime = await AsyncStorage.getItem('lastSyncTime');
      let totalDownloaded = 0;
      let totalErrors = 0;
      const downloadResults = {};

      console.log('📥 Starting server data download...');
      if (lastSyncTime) {
        console.log(`🕚 Last sync: ${new Date(lastSyncTime).toLocaleString()}`);
      }

      for (const tableName of this.syncOrder) {
        try {
          console.log(`📥 Downloading ${tableName}...`);

          const downloadStart = Date.now();
          let serverData = [];
          let downloadAttempts = 0;
          const maxDownloadAttempts = 3;

          // Retry download with exponential backoff
          while (downloadAttempts < maxDownloadAttempts) {
            try {
              downloadAttempts++;

              // Get data from appropriate API endpoint
              switch (tableName) {
                case 'farms':
                  serverData = await apiService.getFarms();
                  break;
                case 'poultry_batches':
                  serverData = await apiService.getFlocks();
                  break;
                case 'feed_records':
                  serverData = await apiService.getFeedRecords();
                  break;
                case 'production_records':
                  serverData = await apiService.getProductionRecords();
                  break;
                case 'mortality_records':
                  serverData = await apiService.getMortalityRecords();
                  break;
                case 'health_records':
                  serverData = await apiService.getHealthRecords();
                  break;
                case 'water_records':
                  serverData = await apiService.getWaterRecords();
                  break;
                case 'weight_records':
                  serverData = await apiService.getWeightRecords();
                  break;
                default:
                  console.log(`ℹ️  Skipping ${tableName} - no API endpoint`);
                  downloadResults[tableName] = { skipped: true };
                  continue;
              }

              break; // Success, exit retry loop

            } catch (downloadError) {
              if (downloadAttempts >= maxDownloadAttempts) {
                throw downloadError;
              }

              const delay = Math.min(1000 * Math.pow(2, downloadAttempts - 1), 5000);
              console.warn(`⚠️  Download attempt ${downloadAttempts} failed for ${tableName}, retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          // CRASH FIX: Handle all possible data formats
          if (Array.isArray(serverData) && serverData.length > 0) {
            await this.mergeServerData(tableName, serverData);
            totalDownloaded += serverData.length;

            const downloadTime = Date.now() - downloadStart;
            downloadResults[tableName] = {
              count: serverData.length,
              downloadTime,
              attempts: downloadAttempts
            };

            console.log(`✅ Downloaded ${serverData.length} records for ${tableName} in ${downloadTime}ms`);
          } else if (Array.isArray(serverData) && serverData.length === 0) {
            // Empty array is valid - no data yet
            downloadResults[tableName] = {
              count: 0,
              downloadTime: Date.now() - downloadStart,
              attempts: downloadAttempts
            };
            console.log(`ℹ️  No ${tableName} data available (empty array)`);
          } else if (serverData === null || serverData === undefined) {
            // Null/undefined is valid - no data
            downloadResults[tableName] = {
              count: 0,
              downloadTime: Date.now() - downloadStart,
              attempts: downloadAttempts
            };
            console.log(`ℹ️  No ${tableName} data available (null)`);
          } else {
            // SYNC FIX: Invalid data format is an error, but don't let it fail entire sync
            console.warn(`⚠️  Invalid data format for ${tableName}:`, typeof serverData);
            downloadResults[tableName] = {
              count: 0,
              error: 'Invalid data format',
              dataType: typeof serverData,
              canContinue: true // Not a critical error
            };
            // Don't increment totalErrors for non-critical issues
          }

        } catch (error) {
          console.error(`❌ Error downloading ${tableName}:`, error);
          downloadResults[tableName] = { error: error.message };
          totalErrors++;

          // Continue with other tables even if one fails
          if (error.message.includes('network') || error.message.includes('timeout')) {
            // For network errors, we might want to stop entirely
            console.error('❌ Network error detected, stopping download');
            throw error;
          }
        }
      }

      console.log(`✅ Download completed: ${totalDownloaded} records, ${totalErrors} errors`);

      // Store download results for debugging
      await AsyncStorage.setItem('lastDownloadResults', JSON.stringify({
        timestamp: new Date().toISOString(),
        totalDownloaded,
        totalErrors,
        results: downloadResults
      }));

      // SYNC FIX: Only fail if we have actual errors (not just empty data)
      // Check if errors are real failures (not just empty/null responses)
      const realErrors = Object.values(downloadResults).filter(result =>
        result.error && !['Invalid data format', 'No data available'].includes(result.error)
      ).length;

      if (realErrors > 0 && totalDownloaded === 0) {
        console.warn(`⚠️  ${realErrors} real errors during download, but sync can continue`);
        // Don't throw - allow sync to continue with whatever data we got
      }

      console.log(`📊 Sync Summary: ${totalDownloaded} records downloaded, ${realErrors} real errors`);

    } catch (error) {
      console.error('❌ Error downloading server data:', error);
      throw new Error(`Server data download failed: ${error.message}`);
    }
  }

  // Merge server data with local data
  async mergeServerData(tableName, serverData) {
    try {
      // CRASH FIX: Validate inputs
      if (!tableName) {
        throw new Error('Table name is required');
      }

      // CRASH FIX: Ensure serverData is an array before iteration
      if (!Array.isArray(serverData)) {
        console.warn(`Invalid server data for ${tableName}:`, typeof serverData);
        return; // Safe early return - prevents "is not iterable" crash
      }

      if (serverData.length === 0) {
        console.log(`No data to merge for ${tableName} (empty array)`);
        return;
      }

      // CRASH FIX: Additional safety check before iteration
      if (!serverData || serverData.length === 0) {
        console.log(`No data to merge for ${tableName}`);
        return;
      }

      for (const serverRecord of serverData) {
        // CRASH FIX: Skip invalid records
        if (!serverRecord || typeof serverRecord !== 'object') {
          console.warn(`Skipping invalid record in ${tableName}:`, serverRecord);
          continue;
        }

        try {
          // Check if record exists locally
          let localRecord = null;

          if (serverRecord.id) {
            localRecord = await offlineDataService.getByServerId(tableName, serverRecord.id.toString());
          }

          const mappedRecord = this.mapServerToLocalRecord(tableName, serverRecord);

          if (localRecord) {
            // Update existing record if server version is newer
            const serverTime = new Date(serverRecord.updated_at || serverRecord.updatedAt || 0);
            const localTime = new Date(localRecord.updated_at || 0);

            if (serverTime > localTime) {
              await offlineDataService.update(tableName, localRecord.id, mappedRecord, true);
              await offlineDataService.markAsSynced(tableName, localRecord.id, serverRecord.id?.toString());
            }
          } else {
            // Create new record
            const newRecord = await offlineDataService.create(tableName, mappedRecord, true);
            if (newRecord && newRecord.id) {
              await offlineDataService.markAsSynced(tableName, newRecord.id, serverRecord.id?.toString());
            }
          }
        } catch (recordError) {
          console.error(`Error merging record in ${tableName}:`, recordError);
          // Continue with next record instead of failing entire merge
          continue;
        }
      }

      console.log(`Merged ${serverData.length} records for ${tableName}`);
    } catch (error) {
      console.error(`Error merging server data for ${tableName}:`, error);
      // Don't throw - log error and continue
      console.warn(`Skipping merge for ${tableName} due to error`);
    }
  }

  // Map server record format to local record format
  mapServerToLocalRecord(tableName, serverRecord) {
    // CRASH FIX: Validate input
    if (!serverRecord || typeof serverRecord !== 'object') {
      console.warn(`Invalid server record for mapping:`, serverRecord);
      return {};
    }

    const mapped = { ...serverRecord };

    // Common mappings
    if (serverRecord.id) {
      mapped.server_id = serverRecord.id.toString();
      delete mapped.id; // Remove server id to avoid conflicts
    }

    // Table-specific mappings
    switch (tableName) {
      case 'farms':
        // Backend uses 'name', not 'farmName'
        if (serverRecord.name) mapped.farm_name = serverRecord.name;
        if (serverRecord.farmName) mapped.farm_name = serverRecord.farmName; // Fallback
        if (serverRecord.organizationId) mapped.organization_id = serverRecord.organizationId;
        if (serverRecord.ownerId) mapped.owner_id = serverRecord.ownerId;
        if (serverRecord.farmSize) mapped.farm_size = serverRecord.farmSize;
        if (serverRecord.farmType) mapped.farm_type = serverRecord.farmType;
        if (serverRecord.contactPerson) mapped.contact_person = serverRecord.contactPerson;
        if (serverRecord.phoneNumber) mapped.phone_number = serverRecord.phoneNumber;

        // Clean up ALL unmapped fields - mobile SQLite only has: farm_name, location, farm_type, organization_id, description
        // Backend sends these fields that don't exist in mobile schema:
        delete mapped.name; // CRITICAL: Delete 'name' after mapping to 'farm_name'
        delete mapped.farmName;
        delete mapped.organizationId;
        delete mapped.ownerId;
        delete mapped.farmSize;
        delete mapped.farmType;
        delete mapped.contactPerson;
        delete mapped.phoneNumber;
        delete mapped.capacity; // Backend field not in mobile schema
        delete mapped.currentStock; // Backend sends 'currentStock', mobile doesn't have this
        delete mapped.current_stock; // In case it's already snake_case
        delete mapped.owner_id; // Mobile doesn't have owner_id column
        delete mapped.user; // Backend sends 'user' field that doesn't exist in mobile schema
        delete mapped.organization; // Backend sends 'organization' object that doesn't exist in mobile schema
        delete mapped.poultryBatches; // Backend sends 'poultryBatches' array
        delete mapped.batchCount; // Backend sends computed 'batchCount' field
        delete mapped.totalBirds; // Backend sends computed 'totalBirds' field
        break;

      case 'poultry_batches':
        // Backend uses 'batchName' which maps to 'batch_name' in DB
        if (serverRecord.batchName) mapped.batch_name = serverRecord.batchName;
        
        if (serverRecord.initialCount) mapped.initial_count = serverRecord.initialCount;
        if (serverRecord.currentCount) mapped.current_count = serverRecord.currentCount;
        if (serverRecord.hatchDate) mapped.hatch_date = serverRecord.hatchDate;
        if (serverRecord.acquisitionDate) mapped.acquisition_date = serverRecord.acquisitionDate;
        if (serverRecord.expectedEndDate) mapped.expected_end_date = serverRecord.expectedEndDate;
        if (serverRecord.farmId) mapped.farm_id = serverRecord.farmId;
        // CRITICAL FIX: Map birdType to breed (backend sends birdType, mobile has breed column)
        if (serverRecord.birdType) mapped.breed = serverRecord.birdType;
        // CRITICAL FIX: Map arrivalDate to arrival_date (backend sends arrivalDate, mobile uses arrival_date)
        if (serverRecord.arrivalDate) mapped.arrival_date = serverRecord.arrivalDate;
        // CRITICAL FIX: Map ageWeeks to age_weeks
        if (serverRecord.ageWeeks) mapped.age_weeks = serverRecord.ageWeeks;

        // Clean up ALL unmapped camelCase fields for poultry_batches
        delete mapped.batchName;
        delete mapped.batchNumber;
        delete mapped.name; // CRITICAL FIX: Backend sends 'name' field that doesn't exist in mobile schema
        delete mapped.initialCount;
        delete mapped.currentCount;
        delete mapped.hatchDate;
        delete mapped.acquisitionDate;
        delete mapped.expectedEndDate;
        delete mapped.farmId; // Will be cleaned by universal cleanup
        delete mapped.birdType; // CRITICAL FIX: Delete after mapping to breed
        delete mapped.arrivalDate; // CRITICAL FIX: Delete after mapping to arrival_date
        delete mapped.ageWeeks; // CRITICAL FIX: Delete after mapping to age_weeks
        // NOTE: Keep mapped.notes - mobile schema HAS this column
                delete mapped.farm; // CRITICAL FIX: Backend sends farm object but mobile only has farm_id
        delete mapped.organization; // Backend sends organization object
        delete mapped.numberOfBirds; // Backend sends numberOfBirds field
        delete mapped.number_of_birds; // In case it's snake_case
        delete mapped.feedRecords; // Backend sends feedRecords array
        delete mapped.productionRecords; // Backend sends productionRecords array
        delete mapped.mortalityRecords; // Backend sends mortalityRecords array
        delete mapped.healthRecords; // Backend sends healthRecords array
        delete mapped.vaccinationRecords; // Backend sends vaccinationRecords array
        delete mapped.financialRecords; // Backend sends financialRecords array
        delete mapped.waterRecords; // Backend sends waterRecords array
        delete mapped.weightRecords; // Backend sends weightRecords array
        break;

      case 'feed_records':
        // Map recordDate to date field (backend sends recordDate, mobile uses date)
        if (serverRecord.recordDate && !mapped.date) {
          mapped.date = serverRecord.recordDate;
        }

        if (serverRecord.feedType) mapped.feed_type = serverRecord.feedType;
        if (serverRecord.quantityKg) mapped.quantity_kg = serverRecord.quantityKg;
        if (serverRecord.costPerKg) mapped.cost_per_kg = serverRecord.costPerKg;
        if (serverRecord.totalCost) mapped.total_cost = serverRecord.totalCost;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;

        // Clean up ALL unmapped camelCase fields for feed_records
        delete mapped.feedType;
        delete mapped.quantityKg;
        delete mapped.costPerKg;
        delete mapped.totalCost;
        delete mapped.batchId;
        delete mapped.farmId; // Will be cleaned by universal cleanup
        delete mapped.recordDate; // Backend uses recordDate, mobile uses date
        delete mapped.batch; // Backend sends 'batch' object that doesn't exist in mobile schema
        delete mapped.user; // Backend sends 'user' object that doesn't exist in mobile schema
        break;

      case 'production_records':
        // Map recordDate to date field (backend sends recordDate, mobile uses date)
        if (serverRecord.recordDate && !mapped.date) {
          mapped.date = serverRecord.recordDate;
        }

        if (serverRecord.eggsCollected) mapped.eggs_collected = serverRecord.eggsCollected;
        if (serverRecord.eggsBroken) mapped.eggs_broken = serverRecord.eggsBroken;
        // Handle both brokenEggs and eggsBroken (backend might send either)
        if (serverRecord.brokenEggs && !mapped.eggs_broken) {
          mapped.eggs_broken = serverRecord.brokenEggs;
        }
        // Handle abnormalEggs mapping
        if (serverRecord.abnormalEggs) mapped.abnormal_eggs = serverRecord.abnormalEggs;
        if (serverRecord.eggsSold) mapped.eggs_sold = serverRecord.eggsSold;
        if (serverRecord.eggWeightKg) mapped.egg_weight_kg = serverRecord.eggWeightKg;
        // Map egg_weight_avg if backend sends eggWeightAvg
        if (serverRecord.eggWeightAvg) mapped.egg_weight_avg = serverRecord.eggWeightAvg;
        if (serverRecord.pricePerDozen) mapped.price_per_dozen = serverRecord.pricePerDozen;
        if (serverRecord.totalRevenue) mapped.total_revenue = serverRecord.totalRevenue;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;

        // Clean up ALL unmapped camelCase fields for production_records
        delete mapped.eggsCollected;
        delete mapped.eggsBroken;
        delete mapped.brokenEggs; // Delete camelCase variant
        delete mapped.abnormalEggs; // Delete camelCase variant after mapping
        delete mapped.eggsSold;
        delete mapped.eggWeightKg;
        delete mapped.eggWeightAvg;
        delete mapped.pricePerDozen;
        delete mapped.totalRevenue;
        delete mapped.batchId;
        delete mapped.farmId; // Will be cleaned by universal cleanup
        delete mapped.recordDate; // Backend uses recordDate, mobile uses date
        // DO NOT map 'weight' field - it doesn't exist in production_records schema
        delete mapped.weight;
        // CRITICAL FIX: Backend sends 'batch' object that doesn't exist in mobile schema
        delete mapped.batch;
        // CRITICAL FIX: Backend sends 'user' object that doesn't exist in mobile schema
        delete mapped.user;
        break;

      case 'mortality_records':
        // Map recordDate to date field (backend sends recordDate, mobile uses date)
        if (serverRecord.recordDate && !mapped.date) {
          mapped.date = serverRecord.recordDate;
        }
        if (serverRecord.ageWeeks) mapped.age_weeks = serverRecord.ageWeeks;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;
        // CRITICAL FIX: Map deaths to count (backend sends deaths, mobile has count column)
        if (serverRecord.deaths) mapped.count = serverRecord.deaths;

        // Clean up ALL unmapped camelCase fields for mortality_records
        delete mapped.ageWeeks;
        delete mapped.batchId;
        delete mapped.farmId; // Will be cleaned by universal cleanup
        delete mapped.deaths; // CRITICAL FIX: Delete after mapping to count
        delete mapped.recordDate; // CRITICAL FIX: Delete after mapping to date
        // CRITICAL FIX: Backend sends 'batch' object that doesn't exist in mobile schema
        delete mapped.batch;
        // CRITICAL FIX: Backend sends 'user' object that doesn't exist in mobile schema
        delete mapped.user;
        break;

      case 'health_records':
        // Map recordDate to date field (backend sends recordDate, mobile uses date)
        if (serverRecord.recordDate && !mapped.date) {
          mapped.date = serverRecord.recordDate;
        }
        if (serverRecord.healthIssue) mapped.health_issue = serverRecord.healthIssue;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;

        // Clean up ALL unmapped camelCase fields for health_records
        delete mapped.healthIssue;
        delete mapped.batchId;
        delete mapped.farmId; // Will be cleaned by universal cleanup
        delete mapped.vetId; // CRITICAL FIX: Backend sends vetId but mobile doesn't have this column
        delete mapped.recordDate; // CRITICAL FIX: Delete after mapping to date
        // CRITICAL FIX: Backend sends 'healthStatus' that doesn't exist in mobile schema
        delete mapped.healthStatus;
        // CRITICAL FIX: Backend sends 'treatmentDate' that doesn't exist in mobile schema
        delete mapped.treatmentDate;
        // CRITICAL FIX: Backend sends 'vaccinationDate' that doesn't exist in mobile schema
        delete mapped.vaccinationDate;
        break;

      case 'water_records':
        if (serverRecord.quantityLiters) mapped.quantity_liters = serverRecord.quantityLiters;
        if (serverRecord.sourceType) mapped.source_type = serverRecord.sourceType;
        // CRITICAL FIX: Map waterSource to source_type if sourceType doesn't exist
        if (serverRecord.waterSource && !mapped.source_type) mapped.source_type = serverRecord.waterSource;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;
        // CRITICAL FIX: Map dateRecorded to date (backend sends dateRecorded, mobile uses date)
        if (serverRecord.dateRecorded && !mapped.date) mapped.date = serverRecord.dateRecorded;

        // Clean up ALL unmapped camelCase fields for water_records
        delete mapped.quantityLiters;
        delete mapped.sourceType;
        delete mapped.waterSource; // CRITICAL FIX: Delete after mapping to source_type
        delete mapped.batchId;
        delete mapped.farmId; // Will be cleaned by universal cleanup
        delete mapped.dateRecorded; // CRITICAL FIX: Delete after mapping to date
        // CRITICAL FIX: Backend sends 'temperature' that doesn't exist in mobile schema
        delete mapped.temperature;
        // CRITICAL FIX: Backend sends 'batch' object that doesn't exist in mobile schema
        delete mapped.batch;
        // CRITICAL FIX: Backend sends 'user' object that doesn't exist in mobile schema
        delete mapped.user;
        break;

      case 'weight_records':
        if (serverRecord.averageWeight) mapped.average_weight = serverRecord.averageWeight;
        // CRITICAL FIX: Map averageWeightGrams to average_weight if averageWeight doesn't exist
        if (serverRecord.averageWeightGrams && !mapped.average_weight) mapped.average_weight = serverRecord.averageWeightGrams;
        if (serverRecord.sampleSize) mapped.sample_size = serverRecord.sampleSize;
        if (serverRecord.weightUnit) mapped.weight_unit = serverRecord.weightUnit;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;
        // CRITICAL FIX: Map dateRecorded to date (backend sends dateRecorded, mobile uses date)
        if (serverRecord.dateRecorded && !mapped.date) mapped.date = serverRecord.dateRecorded;

        // Clean up ALL unmapped camelCase fields for weight_records
        delete mapped.averageWeight;
        delete mapped.averageWeightGrams; // CRITICAL FIX: Delete after mapping to average_weight
        delete mapped.sampleSize;
        delete mapped.weightUnit;
        delete mapped.batchId;
        delete mapped.farmId; // Will be cleaned by universal cleanup
        delete mapped.dateRecorded; // CRITICAL FIX: Delete after mapping to date
        // CRITICAL FIX: Backend sends fields that don't exist in mobile schema
        delete mapped.minWeightGrams;
        delete mapped.maxWeightGrams;
        delete mapped.ageWeeks; // CRITICAL FIX: Backend sends ageWeeks but mobile doesn't have this column
        delete mapped.batch; // CRITICAL FIX: Backend sends batch object but mobile only has batch_id
        break;
    }

    // UNIVERSAL CLEANUP: Map timestamp fields from camelCase to snake_case
    if (serverRecord.createdAt && !mapped.created_at) {
      mapped.created_at = serverRecord.createdAt;
    }
    if (serverRecord.updatedAt && !mapped.updated_at) {
      mapped.updated_at = serverRecord.updatedAt;
    }

    // CRITICAL FIX: Map deletedAt to deleted_at
    if (serverRecord.deletedAt && !mapped.deleted_at) {
      mapped.deleted_at = serverRecord.deletedAt;
    }

    // Delete ALL camelCase timestamp fields that backend might send
    delete mapped.createdAt;
    delete mapped.updatedAt;
    delete mapped.deletedAt; // CRITICAL FIX: Remove deletedAt after mapping
    delete mapped.organizationId; // Universal cleanup for all tables

    // UNIVERSAL CLEANUP: Remove ALL unmapped camelCase foreign key fields that might cause SQLite errors
    // These fields exist in backend but not in mobile schema
    const camelCaseForeignKeys = [
      'ownerId', 'farmId', 'batchId', 'userId', 'customerId', 'organizationId',
      'createdBy', 'updatedBy', 'deletedBy', 'parentId', 'recordId'
    ];

    camelCaseForeignKeys.forEach(key => {
      if (mapped.hasOwnProperty(key)) {
        delete mapped[key];
      }
    });

    // Clean up undefined values
    Object.keys(mapped).forEach(key => {
      if (mapped[key] === undefined) {
        delete mapped[key];
      }
    });

    return mapped;
  }

  // Enhanced upload with better error handling and progress tracking
  async uploadLocalChanges() {
    try {
      this.notifySyncCallbacks({ type: 'uploading' });

      const syncQueue = await offlineDataService.getSyncQueue('pending');

      if (syncQueue.length === 0) {
        console.log('ℹ️  No pending changes to upload');
        return;
      }

      console.log(`📤 Starting upload of ${syncQueue.length} changes...`);

      let successCount = 0;
      let errorCount = 0;
      const uploadResults = {};

      // Process in batches with progress tracking
      for (let i = 0; i < syncQueue.length; i += this.batchSize) {
        const batch = syncQueue.slice(i, i + this.batchSize);
        const batchNumber = Math.floor(i / this.batchSize) + 1;
        const totalBatches = Math.ceil(syncQueue.length / this.batchSize);

        console.log(`📤 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);

        this.notifySyncCallbacks({
          type: 'upload_progress',
          progress: {
            current: i,
            total: syncQueue.length,
            batch: batchNumber,
            totalBatches
          }
        });

        // Process batch items
        const batchResults = await Promise.allSettled(
          batch.map(item => this.processSyncQueueItem(item))
        );

        // Count results
        batchResults.forEach((result, index) => {
          const item = batch[index];
          if (result.status === 'fulfilled') {
            successCount++;
            uploadResults[item.id] = { success: true };
          } else {
            errorCount++;
            uploadResults[item.id] = {
              success: false,
              error: result.reason?.message || 'Unknown error'
            };
          }
        });

        // CRASH FIX: Delay between batches to avoid overwhelming the server and prevent CPU spike
        // Changed from 100ms to 500ms to prevent overheating
        if (i + this.batchSize < syncQueue.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`✅ Upload completed: ${successCount} successful, ${errorCount} errors`);

      // Store upload results
      await AsyncStorage.setItem('lastUploadResults', JSON.stringify({
        timestamp: new Date().toISOString(),
        totalProcessed: syncQueue.length,
        successCount,
        errorCount,
        results: uploadResults
      }));

      // If there were errors, log them but don't fail the sync
      if (errorCount > 0) {
        console.warn(`⚠️  ${errorCount} upload errors occurred - items will be retried later`);
      }

    } catch (error) {
      console.error('❌ Error uploading local changes:', error);
      throw new Error(`Local changes upload failed: ${error.message}`);
    }
  }

  // Enhanced sync queue item processing with detailed error handling
  async processSyncQueueItem(queueItem) {
    const startTime = Date.now();
    let operationResult = null;

    try {
      // Update status to syncing
      await offlineDataService.updateSyncQueueStatus(queueItem.id, 'syncing');

      const { table_name, operation, local_id, server_id, data } = queueItem;
      let recordData;

      try {
        recordData = JSON.parse(data || '{}');
      } catch (parseError) {
        throw new Error(`Invalid JSON data in sync queue item: ${parseError.message}`);
      }

      console.log(`🔄 Processing ${operation} for ${table_name} (queue item ${queueItem.id})`);

      // Validate required data
      if (!table_name || !operation) {
        throw new Error('Missing required fields: table_name or operation');
      }

      // Process based on operation type
      switch (operation) {
        case 'CREATE':
          if (!recordData || Object.keys(recordData).length === 0) {
            throw new Error('No data provided for CREATE operation');
          }

          operationResult = await this.createOnServer(table_name, recordData);

          if (operationResult && operationResult.id) {
            // P0-1 FIX: Store ID mapping in centralized table
            fastDatabase.storeIdMapping(table_name, local_id, operationResult.id.toString());

            // Update local record with server ID
            await offlineDataService.markAsSynced(table_name, local_id, operationResult.id.toString());
            console.log(`✅ Created ${table_name} with server ID: ${operationResult.id}`);
          } else {
            throw new Error('Server did not return a valid ID for created record');
          }
          break;

        case 'UPDATE':
          if (!server_id) {
            throw new Error('UPDATE operation requires server_id');
          }

          if (!recordData || Object.keys(recordData).length === 0) {
            throw new Error('No data provided for UPDATE operation');
          }

          operationResult = await this.updateOnServer(table_name, server_id, recordData);

          if (operationResult !== null) {
            await offlineDataService.markAsSynced(table_name, local_id, server_id);
            console.log(`✅ Updated ${table_name} with server ID: ${server_id}`);
          } else {
            throw new Error('Server update operation failed');
          }
          break;

        case 'DELETE':
          if (!server_id) {
            throw new Error('DELETE operation requires server_id');
          }

          operationResult = await this.deleteOnServer(table_name, server_id);

          if (operationResult !== null) {
            // Hard delete local record after successful server delete
            await offlineDataService.hardDelete(table_name, local_id);
            console.log(`✅ Deleted ${table_name} with server ID: ${server_id}`);
          } else {
            throw new Error('Server delete operation failed');
          }
          break;

        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      // Mark as successfully synced
      await offlineDataService.updateSyncQueueStatus(queueItem.id, 'synced');

      const processingTime = Date.now() - startTime;
      console.log(`✅ Sync queue item ${queueItem.id} processed successfully in ${processingTime}ms`);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Error processing sync queue item ${queueItem.id} after ${processingTime}ms:`, error);

      // Determine if we should retry or mark as failed
      const currentRetryCount = queueItem.retry_count || 0;
      const shouldRetry = currentRetryCount < this.maxRetries;

      // Categorize errors
      const isNetworkError = error.message.includes('network') ||
                            error.message.includes('timeout') ||
                            error.message.includes('fetch');

      const isServerError = error.message.includes('500') ||
                           error.message.includes('502') ||
                           error.message.includes('503');

      const isClientError = error.message.includes('400') ||
                           error.message.includes('401') ||
                           error.message.includes('403') ||
                           error.message.includes('404');

      if (shouldRetry && (isNetworkError || isServerError)) {
        // Retry for network and server errors
        await offlineDataService.updateSyncQueueStatus(queueItem.id, 'pending', error.message);
        console.log(`♿️  Sync queue item ${queueItem.id} will be retried (attempt ${currentRetryCount + 1}/${this.maxRetries})`);
      } else if (isClientError) {
        // Don't retry client errors - mark as failed immediately
        await offlineDataService.updateSyncQueueStatus(queueItem.id, 'failed', `Client error (won't retry): ${error.message}`);
        console.error(`❌ Sync queue item ${queueItem.id} failed with client error (will not retry)`);
      } else {
        // Max retries reached or other error
        await offlineDataService.updateSyncQueueStatus(queueItem.id, 'failed', error.message);
        console.error(`❌ Sync queue item ${queueItem.id} failed permanently after ${currentRetryCount} retries`);
      }

      throw error;
    }
  }

  // Server operations
  async createOnServer(tableName, data) {
    // P0-1 FIX: Remap foreign keys from local IDs to server IDs before upload
    const remappedData = fastDatabase.remapForeignKeysToServer(tableName, data);

    // Then map to server format (camelCase field names)
    const mappedData = this.mapLocalToServerRecord(tableName, remappedData);

    switch (tableName) {
      case 'farms':
        return await apiService.createFarm(mappedData);
      case 'poultry_batches':
        return await apiService.createFlock(mappedData);
      case 'feed_records':
        return await apiService.createFeedRecord(mappedData);
      case 'production_records':
        return await apiService.createProductionRecord(mappedData);
      case 'mortality_records':
        return await apiService.createMortalityRecord(mappedData);
      case 'health_records':
        return await apiService.createHealthRecord(mappedData);
      case 'water_records':
        return await apiService.createWaterRecord(mappedData);
      case 'weight_records':
        return await apiService.createWeightRecord(mappedData);
      default:
        throw new Error(`No create endpoint for table: ${tableName}`);
    }
  }

  async updateOnServer(tableName, serverId, data) {
    const mappedData = this.mapLocalToServerRecord(tableName, data);

    switch (tableName) {
      case 'farms':
        return await apiService.updateFarm(serverId, mappedData);
      case 'poultry_batches':
        return await apiService.updateFlock(serverId, mappedData);
      case 'feed_records':
        // Feed records typically don't have update endpoints
        throw new Error('Feed records cannot be updated');
      case 'production_records':
        // Production records typically don't have update endpoints
        throw new Error('Production records cannot be updated');
      case 'mortality_records':
        // Mortality records typically don't have update endpoints
        throw new Error('Mortality records cannot be updated');
      case 'health_records':
        return await apiService.updateHealthRecord(serverId, mappedData);
      case 'water_records':
        // Water records typically don't have update endpoints
        throw new Error('Water records cannot be updated');
      case 'weight_records':
        // Weight records typically don't have update endpoints
        throw new Error('Weight records cannot be updated');
      default:
        throw new Error(`No update endpoint for table: ${tableName}`);
    }
  }

  async deleteOnServer(tableName, serverId) {
    switch (tableName) {
      case 'farms':
        return await apiService.deleteFarm(serverId);
      case 'poultry_batches':
        return await apiService.deleteFlock(serverId);
      case 'feed_records':
        return await apiService.deleteFeedRecord(serverId);
      case 'production_records':
        return await apiService.deleteProductionRecord(serverId);
      case 'mortality_records':
        return await apiService.deleteMortalityRecord(serverId);
      case 'health_records':
        return await apiService.deleteHealthRecord(serverId);
      case 'water_records':
        return await apiService.deleteWaterRecord(serverId);
      case 'weight_records':
        return await apiService.deleteWeightRecord(serverId);
      default:
        throw new Error(`No delete endpoint for table: ${tableName}`);
    }
  }

  // Map local record format to server record format
  mapLocalToServerRecord(tableName, localRecord) {
    const mapped = { ...localRecord };

    // Remove local-only fields
    delete mapped.id;
    delete mapped.server_id;
    delete mapped.needs_sync;
    delete mapped.last_sync;
    delete mapped.is_deleted;

    // Table-specific mappings
    switch (tableName) {
      case 'farms':
        if (localRecord.farm_name) mapped.farmName = localRecord.farm_name;
        if (localRecord.farm_size) mapped.farmSize = localRecord.farm_size;
        if (localRecord.contact_person) mapped.contactPerson = localRecord.contact_person;
        if (localRecord.phone_number) mapped.phoneNumber = localRecord.phone_number;
        delete mapped.farm_name;
        delete mapped.farm_size;
        delete mapped.contact_person;
        delete mapped.phone_number;
        break;

      case 'poultry_batches':
        if (localRecord.batch_name) mapped.batchName = localRecord.batch_name;
        if (localRecord.batch_number) mapped.batchNumber = localRecord.batch_number;
        if (localRecord.initial_count) mapped.initialCount = localRecord.initial_count;
        if (localRecord.current_count) mapped.currentCount = localRecord.current_count;
        if (localRecord.hatch_date) mapped.hatchDate = localRecord.hatch_date;
        if (localRecord.acquisition_date) mapped.acquisitionDate = localRecord.acquisition_date;
        if (localRecord.expected_end_date) mapped.expectedEndDate = localRecord.expected_end_date;
        if (localRecord.farm_id) mapped.farmId = localRecord.farm_id;

        // Clean up local field names
        delete mapped.batch_name;
        delete mapped.batch_number;
        delete mapped.initial_count;
        delete mapped.current_count;
        delete mapped.hatch_date;
        delete mapped.acquisition_date;
        delete mapped.expected_end_date;
        delete mapped.farm_id;
        break;

      case 'feed_records':
        if (localRecord.feed_type) mapped.feedType = localRecord.feed_type;
        if (localRecord.quantity_kg) mapped.quantityKg = localRecord.quantity_kg;
        if (localRecord.cost_per_kg) mapped.costPerKg = localRecord.cost_per_kg;
        if (localRecord.total_cost) mapped.totalCost = localRecord.total_cost;
        if (localRecord.batch_id) mapped.batchId = localRecord.batch_id;

        delete mapped.feed_type;
        delete mapped.quantity_kg;
        delete mapped.cost_per_kg;
        delete mapped.total_cost;
        delete mapped.batch_id;
        break;

      case 'production_records':
        if (localRecord.eggs_collected) mapped.eggsCollected = localRecord.eggs_collected;
        if (localRecord.eggs_broken) mapped.eggsBroken = localRecord.eggs_broken;
        if (localRecord.eggs_sold) mapped.eggsSold = localRecord.eggs_sold;
        if (localRecord.egg_weight_kg) mapped.eggWeightKg = localRecord.egg_weight_kg;
        if (localRecord.price_per_dozen) mapped.pricePerDozen = localRecord.price_per_dozen;
        if (localRecord.total_revenue) mapped.totalRevenue = localRecord.total_revenue;
        if (localRecord.batch_id) mapped.batchId = localRecord.batch_id;

        delete mapped.eggs_collected;
        delete mapped.eggs_broken;
        delete mapped.eggs_sold;
        delete mapped.egg_weight_kg;
        delete mapped.price_per_dozen;
        delete mapped.total_revenue;
        delete mapped.batch_id;
        break;

      case 'mortality_records':
        if (localRecord.age_weeks) mapped.ageWeeks = localRecord.age_weeks;
        if (localRecord.batch_id) mapped.batchId = localRecord.batch_id;

        delete mapped.age_weeks;
        delete mapped.batch_id;
        break;

      case 'health_records':
        if (localRecord.health_issue) mapped.healthIssue = localRecord.health_issue;
        if (localRecord.batch_id) mapped.batchId = localRecord.batch_id;

        delete mapped.health_issue;
        delete mapped.batch_id;
        break;

      case 'water_records':
        if (localRecord.quantity_liters) mapped.quantityLiters = localRecord.quantity_liters;
        if (localRecord.source_type) mapped.sourceType = localRecord.source_type;
        if (localRecord.batch_id) mapped.batchId = localRecord.batch_id;

        delete mapped.quantity_liters;
        delete mapped.source_type;
        delete mapped.batch_id;
        break;

      case 'weight_records':
        if (localRecord.average_weight) mapped.averageWeight = localRecord.average_weight;
        if (localRecord.sample_size) mapped.sampleSize = localRecord.sample_size;
        if (localRecord.weight_unit) mapped.weightUnit = localRecord.weight_unit;
        if (localRecord.batch_id) mapped.batchId = localRecord.batch_id;

        delete mapped.average_weight;
        delete mapped.sample_size;
        delete mapped.weight_unit;
        delete mapped.batch_id;
        break;
    }

    return mapped;
  }

  // Enhanced sync status with detailed information
  async getSyncStatus() {
    try {
      // Import databaseService to check initialization
      const databaseService = require('./database').default;

      // Check if database is initialized before querying
      if (!databaseService || !databaseService.isInitialized) {
        console.log('⏳ Database not initialized, returning default sync status');
        return this.getDefaultSyncStatus('Database not initialized yet');
      }

      // Ensure offlineDataService is available and initialized
      if (!offlineDataService) {
        console.warn('OfflineDataService not available for sync status');
        return this.getDefaultSyncStatus('OfflineDataService not available');
      }

      let pendingCount = 0;
      let syncingCount = 0;
      let failedCount = 0;
      let syncedCount = 0;

      // Safely get counts with fallbacks
      try {
        pendingCount = await offlineDataService.count('sync_queue', 'sync_status = ?', ['pending']) || 0;
      } catch (error) {
        console.warn('Error getting pending count:', error.message);
      }

      try {
        syncingCount = await offlineDataService.count('sync_queue', 'sync_status = ?', ['syncing']) || 0;
      } catch (error) {
        console.warn('Error getting syncing count:', error.message);
      }

      try {
        failedCount = await offlineDataService.count('sync_queue', 'sync_status = ?', ['failed']) || 0;
      } catch (error) {
        console.warn('Error getting failed count:', error.message);
      }

      try {
        syncedCount = await offlineDataService.count('sync_queue', 'sync_status = ?', ['synced']) || 0;
      } catch (error) {
        console.warn('Error getting synced count:', error.message);
      }

      // Safely get storage values
      let lastSyncTime = null;
      let lastFullSyncTime = null;
      let initialSyncCompleted = false;
      let lastSyncStats = null;

      try {
        lastSyncTime = await AsyncStorage.getItem('lastSyncTime');
      } catch (error) {
        console.warn('Error getting lastSyncTime:', error.message);
      }

      try {
        lastFullSyncTime = await AsyncStorage.getItem('lastFullSyncTime');
      } catch (error) {
        console.warn('Error getting lastFullSyncTime:', error.message);
      }

      try {
        const syncCompleted = await AsyncStorage.getItem('initialSyncCompleted');
        initialSyncCompleted = syncCompleted === 'true';
      } catch (error) {
        console.warn('Error getting initialSyncCompleted:', error.message);
      }

      // Get last sync statistics
      try {
        const statsStr = await AsyncStorage.getItem('lastSyncStats');
        lastSyncStats = statsStr ? JSON.parse(statsStr) : null;
      } catch (error) {
        console.warn('Error parsing last sync stats:', error.message);
      }

      // Calculate sync health score
      const totalItems = pendingCount + syncingCount + failedCount + syncedCount;
      let healthScore = 100;

      if (totalItems > 0) {
        const errorRate = failedCount / totalItems;
        healthScore = Math.max(0, Math.round(100 * (1 - errorRate * 2))); // Failed items reduce score more
      }

      // Determine sync status
      let status = 'idle';
      if (this.isSyncing) {
        status = 'syncing';
      } else if (failedCount > 0) {
        status = 'errors';
      } else if (pendingCount > 0) {
        status = 'pending';
      } else {
        status = 'up_to_date';
      }

      return {
        // Current state
        isSyncing: this.isSyncing || false,
        status,
        healthScore,

        // Queue statistics
        queue: {
          pending: pendingCount,
          syncing: syncingCount,
          failed: failedCount,
          synced: syncedCount,
          total: totalItems
        },

        // Timing information
        timestamps: {
          lastSync: lastSyncTime ? new Date(lastSyncTime) : null,
          lastFullSync: lastFullSyncTime ? new Date(lastFullSyncTime) : null,
          initialSyncCompleted
        },

        // Statistics
        stats: lastSyncStats,

        // Recommendations
        recommendations: this.getSyncRecommendations(pendingCount, failedCount, lastSyncTime)
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return this.getDefaultSyncStatus(error.message);
    }
  }

  // Get sync recommendations based on current state
  getSyncRecommendations(pendingCount, failedCount, lastSyncTime) {
    const recommendations = [];

    if (failedCount > 0) {
      recommendations.push(`Review ${failedCount} failed sync items`);
      recommendations.push('Check network connectivity');
    }

    if (pendingCount > 50) {
      recommendations.push('Large number of pending changes - consider manual sync');
    }

    if (lastSyncTime) {
      const lastSync = new Date(lastSyncTime);
      const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

      if (hoursSinceSync > 24) {
        recommendations.push('Last sync was over 24 hours ago - sync recommended');
      } else if (hoursSinceSync > 6) {
        recommendations.push('Consider syncing to get latest data');
      }
    } else {
      recommendations.push('Initial sync required');
    }

    if (recommendations.length === 0) {
      recommendations.push('All systems healthy');
    }

    return recommendations;
  }

  async clearFailedSyncs() {
    try {
      await offlineDataService.delete('sync_queue', 'sync_status = ?', ['failed']);
      console.log('Failed syncs cleared');
    } catch (error) {
      console.error('Error clearing failed syncs:', error);
      throw error;
    }
  }

  async retryFailedSyncs() {
    try {
      const failedItems = await offlineDataService.getSyncQueue('failed');

      for (const item of failedItems) {
        await offlineDataService.updateSyncQueueStatus(item.id, 'pending');
      }

      console.log(`Retrying ${failedItems.length} failed syncs`);

      // Trigger sync
      return await this.syncData();
    } catch (error) {
      console.error('Error retrying failed syncs:', error);
      throw error;
    }
  }

  // Initial data download
  async performInitialSync() {
    try {
      console.log('🔄 Initial Sync: Starting...');
      this.notifySyncCallbacks({ type: 'initial_sync_started' });

      // FAST LOGIN: Quick check if already synced recently (within last 5 minutes)
      try {
        const lastSyncTime = await AsyncStorage.getItem('lastSyncTime');
        if (lastSyncTime) {
          const lastSync = new Date(lastSyncTime);
          const now = new Date();
          const minutesSinceSync = (now - lastSync) / (1000 * 60);

          if (minutesSinceSync < 5) {
            console.log(`⚡ Initial Sync: Skipped - recent sync ${Math.round(minutesSinceSync)} minutes ago`);
            this.notifySyncCallbacks({
              type: 'initial_sync_skipped',
              reason: 'recent_sync',
              message: 'Using recent cached data'
            });
            return {
              success: true,
              skipped: true,
              reason: 'recent_sync',
              message: 'Using recent cached data'
            };
          }
        }
      } catch (checkError) {
        console.warn('Could not check last sync time:', checkError);
      }

      // Check network before syncing
      const networkService = require('./networkService').default;
      const networkState = await networkService.checkConnection();

      if (!networkState.isConnected) {
        console.log('⚠️ Initial Sync: No network, using cached data');
        this.notifySyncCallbacks({
          type: 'initial_sync_skipped',
          reason: 'offline',
          message: 'Using cached data - sync will occur when online'
        });
        return {
          success: true,
          skipped: true,
          reason: 'offline',
          message: 'Using cached data'
        };
      }

      console.log('📡 Initial Sync: Network available, downloading data...');

      // Download all data from server
      await this.downloadServerData();

      // Mark as initial sync completed
      await AsyncStorage.setItem('initialSyncCompleted', 'true');
      await AsyncStorage.setItem('lastSyncTime', new Date().toISOString());

      console.log('✅ Initial Sync: Completed successfully');
      this.notifySyncCallbacks({ type: 'initial_sync_completed' });

      return { success: true, message: 'Initial sync completed' };
    } catch (error) {
      console.error('❌ Initial Sync: Failed -', error.message);
      console.error('📋 Initial Sync: Full error:', error);

      this.notifySyncCallbacks({
        type: 'initial_sync_failed',
        error: error.message,
        canRetry: true
      });

      // Store the error for UI to display
      await AsyncStorage.setItem('lastSyncError', JSON.stringify({
        message: error.message,
        timestamp: new Date().toISOString(),
        type: 'initial_sync'
      }));

      // Return error info instead of throwing (allows app to continue with cached data)
      return {
        success: false,
        error: error.message,
        canRetry: true,
        message: 'Sync failed - using cached data'
      };
    }
  }

  async isInitialSyncCompleted() {
    try {
      const completed = await AsyncStorage.getItem('initialSyncCompleted');
      return completed === 'true';
    } catch (error) {
      console.warn('Error checking initial sync completion:', error.message);
      return false;
    }
  }

  // Get default sync status when errors occur
  getDefaultSyncStatus(errorMessage = 'Unknown error') {
    // Don't show error status if database is just initializing
    const status = errorMessage.includes('not initialized') ? 'initializing' : 'idle';

    return {
      isSyncing: this.isSyncing || false,
      status: status,
      healthScore: 0,
      queue: { pending: 0, syncing: 0, failed: 0, synced: 0, total: 0 },
      timestamps: { lastSync: null, lastFullSync: null, initialSyncCompleted: false },
      stats: null,
      recommendations: errorMessage.includes('not initialized') ? ['Database initializing...'] : ['Check database connection'],
      error: null // Don't expose error to UI
    };
  }
}

// Export singleton instance
const syncService = new SyncService();

export default syncService;