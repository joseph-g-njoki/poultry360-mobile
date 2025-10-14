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
          // Convert database record to API format
          const apiData = this.convertToApiFormat(tableName, record);

          // Send to API using offlineFirstService methods
          await offlineFirstService[methodName](apiData);

          // Mark as synced
          await offlineDataService.markAsSynced(tableName, record.id);

          result.synced++;
          console.log(`[AutoSync] ✅ Synced ${tableName} record ${record.id}`);
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
          batchName: record.batch_name,
          breed: record.breed,
          initialCount: record.initial_count,
          currentCount: record.current_count,
          arrivalDate: record.arrival_date,
          status: record.status
        };

      case 'feed_records':
        return {
          ...apiData,
          quantity: record.quantity,
          feedType: record.feed_type,
          cost: record.cost
        };

      case 'production_records':
        return {
          ...apiData,
          eggsCollected: record.eggs_collected,
          weight: record.weight
        };

      case 'mortality_records':
        return {
          ...apiData,
          count: record.count,
          cause: record.cause
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
          temperature: record.temperature,
          dateRecorded: record.date_recorded
        };

      case 'weight_records':
        return {
          ...apiData,
          averageWeight: record.average_weight,
          sampleSize: record.sample_size,
          weightUnit: record.weight_unit || 'kg',
          dateRecorded: record.date_recorded
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
