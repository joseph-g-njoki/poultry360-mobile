/**
 * Auto-Sync Service
 *
 * Automatically syncs unsynced local data to the backend when internet returns.
 *
 * FLOW:
 * 1. Listen to network state changes via NetInfo
 * 2. When internet is restored → check for unsynced records
 * 3. Upload each unsynced record to backend
 * 4. Mark as synced after successful upload
 *
 * USAGE:
 * - Initialize in App.js: autoSyncService.init()
 * - Manually trigger: autoSyncService.syncAllData()
 */

import NetInfo from '@react-native-community/netinfo';
import offlineDataService from './offlineDataService';
import offlineFirstService from './offlineFirstService';
import apiService from './api';
import fastDatabase from './fastDatabase';

class AutoSyncService {
  constructor() {
    this.isSyncing = false;
    this.netInfoUnsubscribe = null;
    this.serviceName = 'AutoSyncService';
  }

  /**
   * Initialize auto-sync by listening to network changes
   */
  init() {
    console.log('[AutoSync] 🚀 Initializing auto-sync service...');

    // Listen for network state changes
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      console.log('[AutoSync] Network state changed:', {
        isConnected: state.isConnected,
        type: state.type,
        isInternetReachable: state.isInternetReachable
      });

      // If internet is restored, trigger sync
      if (state.isConnected && state.isInternetReachable) {
        console.log('[AutoSync] ✅ Internet connection restored - triggering sync...');
        this.syncAllData();
      }
    });

    console.log('[AutoSync] ✅ Auto-sync service initialized');
  }

  /**
   * Manually trigger sync of all unsynced data
   */
  async syncAllData() {
    if (this.isSyncing) {
      console.log('[AutoSync] ⏳ Sync already in progress, skipping...');
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    console.log('[AutoSync] 🔄 Starting sync of all unsynced data...');

    try {
      const syncResults = {
        total: 0,
        synced: 0,
        failed: 0,
        details: {}
      };

      // Tables to sync (in dependency order)
      const tables = [
        { name: 'farms', method: 'createFarm' },
        { name: 'poultry_batches', method: 'createFlock' },
        { name: 'feed_records', method: 'createFeedRecord' },
        { name: 'production_records', method: 'createProductionRecord' },
        { name: 'mortality_records', method: 'createMortalityRecord' },
        { name: 'health_records', method: 'createHealthRecord' },
        { name: 'water_records', method: 'createWaterRecord' },
        { name: 'weight_records', method: 'createWeightRecord' }
      ];

      for (const table of tables) {
        const result = await this.syncTable(table.name, table.method);
        syncResults.details[table.name] = result;
        syncResults.total += result.total;
        syncResults.synced += result.synced;
        syncResults.failed += result.failed;
      }

      console.log('[AutoSync] ✅ Sync completed:', syncResults);

      return {
        success: true,
        ...syncResults
      };
    } catch (error) {
      console.error('[AutoSync] ❌ Sync error:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a specific table's unsynced records
   */
  async syncTable(tableName, methodName) {
    const result = {
      table: tableName,
      total: 0,
      synced: 0,
      failed: 0,
      errors: []
    };

    try {
      console.log(`[AutoSync] 📋 Checking ${tableName} for unsynced records...`);

      // Get unsynced records
      const unsyncedRecords = await offlineDataService.getUnsyncedRecords(tableName);
      result.total = unsyncedRecords.length;

      if (unsyncedRecords.length === 0) {
        console.log(`[AutoSync] ✓ No unsynced records for ${tableName}`);
        return result;
      }

      console.log(`[AutoSync] 🔄 Syncing ${unsyncedRecords.length} records from ${tableName}...`);

      // Sync each record
      for (const record of unsyncedRecords) {
        try {
          // DEBUG: Log the raw SQLite record
          console.log(`[AutoSync] 🔍 DEBUG: Raw SQLite record for ${tableName}:`, JSON.stringify(record, null, 2));

          // CRITICAL FIX: Resolve foreign key references to server IDs
          await this.resolveForeignKeys(tableName, record);

          // Convert database record to API format
          const apiData = this.convertToApiFormat(tableName, record);

          console.log(`[AutoSync] 🔍 DEBUG: Converted API data:`, JSON.stringify(apiData, null, 2));
          console.log(`[AutoSync] 📤 Sending ${tableName} record ${record.id} to backend...`);

          // FIXED: Call apiService directly to send to backend (don't use offlineFirstService)
          // offlineFirstService tries to save to SQLite again, causing field name errors
          let serverResponse;
          switch (tableName) {
            case 'farms':
              serverResponse = await apiService.createFarm(apiData);
              break;
            case 'poultry_batches':
              serverResponse = await apiService.createFlock(apiData);
              break;
            case 'feed_records':
              serverResponse = await apiService.createFeedRecord(apiData);
              break;
            case 'production_records':
              serverResponse = await apiService.createProductionRecord(apiData);
              break;
            case 'mortality_records':
              serverResponse = await apiService.createMortalityRecord(apiData);
              break;
            case 'health_records':
              serverResponse = await apiService.createHealthRecord(apiData);
              break;
            case 'water_records':
              serverResponse = await apiService.createWaterRecord(apiData);
              break;
            case 'weight_records':
              serverResponse = await apiService.createWeightRecord(apiData);
              break;
            case 'vaccination_records':
              serverResponse = await apiService.createVaccinationRecord(apiData);
              break;
            default:
              throw new Error(`Unsupported table for sync: ${tableName}`);
          }

          console.log(`[AutoSync] ✅ Backend returned server_id: ${serverResponse.id}`);

          // Update local SQLite record with server_id and mark as synced
          fastDatabase.db.runSync(
            `UPDATE ${tableName}
             SET server_id = ?, needs_sync = 0, is_synced = 1, synced_at = ?
             WHERE id = ?`,
            [String(serverResponse.id), new Date().toISOString(), record.id]
          );

          result.synced++;
          console.log(`[AutoSync] ✅ Synced ${tableName} record ${record.id} → server_id ${serverResponse.id}`);
        } catch (error) {
          result.failed++;
          result.errors.push({
            recordId: record.id,
            error: error.message
          });
          console.error(`[AutoSync] ❌ Failed to sync ${tableName} record ${record.id}:`, error.message);
        }
      }

      console.log(`[AutoSync] ${tableName} sync complete: ${result.synced}/${result.total} successful`);
      return result;
    } catch (error) {
      console.error(`[AutoSync] Error syncing table ${tableName}:`, error);
      result.errors.push({ error: error.message });
      return result;
    }
  }

  /**
   * Resolve foreign key references from local IDs to server IDs
   * Modifies the record in place to replace local IDs with server IDs
   */
  async resolveForeignKeys(tableName, record) {
    try {
      // Resolve farm_id to server_id
      if (record.farm_id) {
        const farm = fastDatabase.db.getFirstSync(
          `SELECT server_id FROM farms WHERE id = ?`,
          [record.farm_id]
        );
        if (farm && farm.server_id) {
          console.log(`[AutoSync] 🔗 Resolved farm_id ${record.farm_id} → server_id ${farm.server_id}`);
          record.farm_id = parseInt(farm.server_id, 10);
        } else {
          console.warn(`[AutoSync] ⚠️ Farm ${record.farm_id} has no server_id - may fail on backend`);
        }
      }

      // Resolve batch_id to server_id
      if (record.batch_id) {
        const batch = fastDatabase.db.getFirstSync(
          `SELECT server_id FROM poultry_batches WHERE id = ?`,
          [record.batch_id]
        );
        if (batch && batch.server_id) {
          console.log(`[AutoSync] 🔗 Resolved batch_id ${record.batch_id} → server_id ${batch.server_id}`);
          record.batch_id = parseInt(batch.server_id, 10);
        } else {
          console.warn(`[AutoSync] ⚠️ Batch ${record.batch_id} has no server_id - may fail on backend`);
        }
      }
    } catch (error) {
      console.error(`[AutoSync] ❌ Error resolving foreign keys:`, error);
      // Don't throw - let the sync attempt proceed
    }
  }

  /**
   * Convert database record to API format
   * Maps snake_case database columns to camelCase API fields
   */
  convertToApiFormat(tableName, record) {
    // Common field mappings
    const apiData = {
      farmId: record.farm_id,
      batchId: record.batch_id,
      date: record.date,
      notes: record.notes
    };

    // Table-specific field mappings
    switch (tableName) {
      case 'farms':
        return {
          farmName: record.farm_name,
          location: record.location,
          farmType: record.farm_type,
          description: record.description
        };

      case 'poultry_batches':
        return {
          ...apiData,
          batchName: record.batch_name || record.name,
          birdType: record.bird_type,  // ✅ REQUIRED by backend
          breed: record.breed,
          initialCount: record.initial_count,
          currentCount: record.current_count,
          arrivalDate: record.arrival_date || record.start_date,
          status: record.status
        };

      case 'feed_records':
        return {
          ...apiData,
          quantityKg: record.quantity_kg || record.quantity,
          feedType: record.feed_type,
          cost: record.cost,
          recordDate: record.date || record.date_fed
        };

      case 'production_records':
        return {
          ...apiData,
          eggsCollected: record.eggs_collected,
          weight: record.weight
        };

      case 'mortality_records':
        // CRITICAL FIX: Backend validation requires 'deaths' to be a positive number
        const deathCount = record.count || record.death_count || record.deaths || 0;
        if (!deathCount || deathCount < 1) {
          throw new Error(`Invalid death count: ${deathCount}. Mortality records must have at least 1 death.`);
        }
        return {
          ...apiData,
          deaths: parseInt(deathCount, 10),  // Backend expects 'deaths' not 'count'
          cause: record.cause || record.mortality_cause || 'Unknown'
        };

      case 'health_records':
        return {
          ...apiData,
          healthStatus: record.health_status,
          treatment: record.treatment
        };

      case 'water_records':
        return {
          ...apiData,
          quantityLiters: record.quantity_liters,
          waterSource: record.water_source,
          quality: record.quality,
          temperature: record.temperature_celsius || record.temperature,  // SYNC FIX: Map temperature_celsius
          dateRecorded: record.date_recorded || record.date
        };

      case 'weight_records':
        return {
          ...apiData,
          // SYNC FIX: Send weight in kg (api.js will convert to grams)
          averageWeight: record.average_weight_kg || (record.average_weight_grams / 1000),
          sampleSize: record.sample_size,
          minWeight: record.min_weight_grams ? record.min_weight_grams / 1000 : undefined,
          maxWeight: record.max_weight_grams ? record.max_weight_grams / 1000 : undefined,
          dateRecorded: record.date_recorded || record.date
        };

      default:
        return apiData;
    }
  }

  /**
   * Get sync status for a specific table
   */
  async getSyncStatus(tableName) {
    try {
      const unsyncedRecords = await offlineDataService.getUnsyncedRecords(tableName);
      return {
        table: tableName,
        unsyncedCount: unsyncedRecords.length,
        needsSync: unsyncedRecords.length > 0
      };
    } catch (error) {
      console.error(`[AutoSync] Error getting sync status for ${tableName}:`, error);
      return {
        table: tableName,
        unsyncedCount: 0,
        needsSync: false,
        error: error.message
      };
    }
  }

  /**
   * Get overall sync status for all tables
   */
  async getAllSyncStatus() {
    const tables = [
      'farms',
      'poultry_batches',
      'feed_records',
      'production_records',
      'mortality_records',
      'health_records',
      'water_records',
      'weight_records'
    ];

    const statusPromises = tables.map(table => this.getSyncStatus(table));
    const statuses = await Promise.all(statusPromises);

    const totalUnsynced = statuses.reduce((sum, status) => sum + status.unsyncedCount, 0);

    return {
      tables: statuses,
      totalUnsynced,
      needsSync: totalUnsynced > 0
    };
  }

  /**
   * Clean up listeners
   */
  cleanup() {
    console.log('[AutoSync] 🧹 Cleaning up auto-sync service...');
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    console.log('[AutoSync] ✅ Auto-sync service cleaned up');
  }
}

export default new AutoSyncService();
