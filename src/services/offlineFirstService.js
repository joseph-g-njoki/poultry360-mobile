/**
 * Offline-First Service
 *
 * This service acts as a smart wrapper around apiService and offlineDataService.
 * It automatically determines whether to save data online or offline based on network status.
 *
 * USAGE:
 * Instead of: await apiService.createFeedRecord(data)
 * Use: await offlineFirstService.createFeedRecord(data)
 *
 * The service will:
 * 1. Check network status
 * 2. If ONLINE: Save directly to server + cache locally
 * 3. If OFFLINE: Save to local DB with needs_sync=1 → will sync when online
 */

import networkService from './networkService';
import apiService from './api';
import offlineDataService from './offlineDataService';
import dataEventBus, { EventTypes } from './dataEventBus';

class OfflineFirstService {
  constructor() {
    this.serviceName = 'OfflineFirstService';
  }

  /**
   * Check if we're online and can reach the server
   * CRITICAL FIX: Use simpler, more reliable network check
   */
  async isOnline() {
    try {
      // Use the networkService's getter method (not async)
      const isConnected = networkService.getIsConnected();
      console.log('[OfflineFirst] Network status check:', isConnected ? 'ONLINE' : 'OFFLINE');
      return isConnected;
    } catch (error) {
      console.warn('[OfflineFirst] Network check failed, assuming offline:', error);
      return false;
    }
  }

  // ==================== FARMS ====================

  async getFarms() {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          // Try to fetch from server
          const farms = await apiService.getFarms();

          // Cache the farms locally (background operation)
          this._cacheFarmsLocally(farms).catch(err =>
            console.warn('[OfflineFirst] Failed to cache farms:', err)
          );

          return farms;
        } catch (error) {
          console.warn('[OfflineFirst] Server fetch failed, falling back to local:', error);
          return await offlineDataService.getFarms();
        }
      } else {
        // Offline: Return local data
        console.log('[OfflineFirst] Offline mode - returning local farms');
        return await offlineDataService.getFarms();
      }
    } catch (error) {
      console.error('[OfflineFirst] getFarms error:', error);
      return [];
    }
  }

  async createFarm(farmData) {
    const online = await this.isOnline();

    if (online) {
      try {
        // ONLINE: Create on server
        const farm = await apiService.createFarm(farmData);

        // Cache locally with server_id (skipSync=true)
        await offlineDataService.createFarm({ ...farmData, server_id: farm.id }, true);

        // Emit FARM_CREATED event
        dataEventBus.emit(EventTypes.FARM_CREATED, { farmId: farm.id, farm });
        console.log('[OfflineFirst] Farm created event emitted:', farm.id);

        return farm;
      } catch (error) {
        console.warn('[OfflineFirst] Server create failed, saving locally:', error);
        // Server failed: Fall through to offline mode
      }
    }

    // OFFLINE: Save locally with needs_sync=1
    console.log('[OfflineFirst] OFFLINE mode - saving farm locally');
    const localFarm = await offlineDataService.createFarm(farmData, false);

    // Emit FARM_CREATED event (even in offline mode)
    dataEventBus.emit(EventTypes.FARM_CREATED, { farmId: localFarm.id, farm: localFarm });
    console.log('[OfflineFirst] Farm created event emitted (offline):', localFarm.id);

    return localFarm;
  }

  async updateFarm(farmId, farmData) {
    const online = await this.isOnline();

    if (online) {
      try {
        const updatedFarm = await apiService.updateFarm(farmId, farmData);

        // Update local cache
        const localFarm = await offlineDataService.getByServerId('farms', farmId.toString());
        if (localFarm) {
          await offlineDataService.updateFarm(localFarm.id, farmData, true);
        }

        // Emit FARM_UPDATED event
        dataEventBus.emit(EventTypes.FARM_UPDATED, { farmId, farm: updatedFarm });
        console.log('[OfflineFirst] Farm updated event emitted:', farmId);

        return updatedFarm;
      } catch (error) {
        console.warn('[OfflineFirst] Server update failed, updating locally:', error);
      }
    }

    // OFFLINE: Update locally
    const localFarm = await offlineDataService.getByServerId('farms', farmId.toString());
    if (localFarm) {
      await offlineDataService.updateFarm(localFarm.id, farmData, false);
      const updated = { ...localFarm, ...farmData };

      // Emit FARM_UPDATED event
      dataEventBus.emit(EventTypes.FARM_UPDATED, { farmId, farm: updated });
      console.log('[OfflineFirst] Farm updated event emitted (offline):', farmId);

      return updated;
    }
    throw new Error('Farm not found locally');
  }

  async deleteFarm(farmId) {
    const online = await this.isOnline();

    if (online) {
      try {
        await apiService.deleteFarm(farmId);

        // Delete locally too
        const localFarm = await offlineDataService.getByServerId('farms', farmId.toString());
        if (localFarm) {
          await offlineDataService.deleteFarm(localFarm.id, true);
        }

        // Emit FARM_DELETED event
        dataEventBus.emit(EventTypes.FARM_DELETED, { farmId });
        console.log('[OfflineFirst] Farm deleted event emitted:', farmId);

        return true;
      } catch (error) {
        console.warn('[OfflineFirst] Server delete failed, deleting locally:', error);
      }
    }

    // OFFLINE: Soft delete locally (will be synced later)
    const localFarm = await offlineDataService.getByServerId('farms', farmId.toString());
    if (localFarm) {
      await offlineDataService.deleteFarm(localFarm.id, false);

      // Emit FARM_DELETED event
      dataEventBus.emit(EventTypes.FARM_DELETED, { farmId });
      console.log('[OfflineFirst] Farm deleted event emitted (offline):', farmId);

      return true;
    }
    throw new Error('Farm not found locally');
  }

  // ==================== FLOCKS/BATCHES ====================

  async getFlocks() {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const flocks = await apiService.getFlocks();
          this._cacheFlocksLocally(flocks).catch(err =>
            console.warn('[OfflineFirst] Failed to cache flocks:', err)
          );
          return flocks;
        } catch (error) {
          console.warn('[OfflineFirst] Server fetch failed, falling back to local:', error);
          return await offlineDataService.getBatches();
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning local batches');
        return await offlineDataService.getBatches();
      }
    } catch (error) {
      console.error('[OfflineFirst] getFlocks error:', error);
      return [];
    }
  }

  async createFlock(flockData) {
    const online = await this.isOnline();

    if (online) {
      try {
        const flock = await apiService.createFlock(flockData);
        await offlineDataService.createBatch({ ...flockData, server_id: flock.id }, true);

        // Emit BATCH_CREATED event
        dataEventBus.emit(EventTypes.BATCH_CREATED, { batchId: flock.id, batch: flock });
        console.log('[OfflineFirst] Batch created event emitted:', flock.id);

        return flock;
      } catch (error) {
        console.warn('[OfflineFirst] Server create failed, saving locally:', error);
      }
    }

    console.log('[OfflineFirst] OFFLINE mode - saving batch locally');
    const localBatch = await offlineDataService.createBatch(flockData, false);

    // Emit BATCH_CREATED event
    dataEventBus.emit(EventTypes.BATCH_CREATED, { batchId: localBatch.id, batch: localBatch });
    console.log('[OfflineFirst] Batch created event emitted (offline):', localBatch.id);

    return localBatch;
  }

  async updateFlock(flockId, flockData) {
    const online = await this.isOnline();

    if (online) {
      try {
        const updatedFlock = await apiService.updateFlock(flockId, flockData);
        const localBatch = await offlineDataService.getByServerId('poultry_batches', flockId.toString());
        if (localBatch) {
          await offlineDataService.updateBatch(localBatch.id, flockData, true);
        }

        // Emit BATCH_UPDATED event
        dataEventBus.emit(EventTypes.BATCH_UPDATED, { batchId: flockId, batch: updatedFlock });
        console.log('[OfflineFirst] Batch updated event emitted:', flockId);

        return updatedFlock;
      } catch (error) {
        console.warn('[OfflineFirst] Server update failed, updating locally:', error);
      }
    }

    const localBatch = await offlineDataService.getByServerId('poultry_batches', flockId.toString());
    if (localBatch) {
      await offlineDataService.updateBatch(localBatch.id, flockData, false);
      const updated = { ...localBatch, ...flockData };

      // Emit BATCH_UPDATED event
      dataEventBus.emit(EventTypes.BATCH_UPDATED, { batchId: flockId, batch: updated });
      console.log('[OfflineFirst] Batch updated event emitted (offline):', flockId);

      return updated;
    }
    throw new Error('Batch not found locally');
  }

  async deleteFlock(flockId) {
    const online = await this.isOnline();

    if (online) {
      try {
        await apiService.deleteFlock(flockId);
        const localBatch = await offlineDataService.getByServerId('poultry_batches', flockId.toString());
        if (localBatch) {
          await offlineDataService.deleteBatch(localBatch.id, true);
        }

        // Emit BATCH_DELETED event
        dataEventBus.emit(EventTypes.BATCH_DELETED, { batchId: flockId });
        console.log('[OfflineFirst] Batch deleted event emitted:', flockId);

        return true;
      } catch (error) {
        console.warn('[OfflineFirst] Server delete failed, deleting locally:', error);
      }
    }

    const localBatch = await offlineDataService.getByServerId('poultry_batches', flockId.toString());
    if (localBatch) {
      await offlineDataService.deleteBatch(localBatch.id, false);

      // Emit BATCH_DELETED event
      dataEventBus.emit(EventTypes.BATCH_DELETED, { batchId: flockId });
      console.log('[OfflineFirst] Batch deleted event emitted (offline):', flockId);

      return true;
    }
    throw new Error('Batch not found locally');
  }

  // ==================== FEED RECORDS ====================

  async getFeedRecords() {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const records = await apiService.getFeedRecords();
          this._cacheFeedRecordsLocally(records).catch(err =>
            console.warn('[OfflineFirst] Failed to cache feed records:', err)
          );
          return records;
        } catch (error) {
          console.warn('[OfflineFirst] Server fetch failed, falling back to local:', error);
          return await offlineDataService.getFeedRecords();
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning local feed records');
        return await offlineDataService.getFeedRecords();
      }
    } catch (error) {
      console.error('[OfflineFirst] getFeedRecords error:', error);
      return [];
    }
  }

  async createFeedRecord(recordData) {
    const online = await this.isOnline();

    if (online) {
      try {
        console.log('[OfflineFirst] ONLINE - creating feed record on server');
        const record = await apiService.createFeedRecord(recordData);
        await offlineDataService.createFeedRecord({ ...recordData, server_id: record.id }, true);

        // Emit event
        dataEventBus.emit(EventTypes.FEED_RECORD_CREATED, { recordId: record.id, record, recordType: 'feed' });

        return record;
      } catch (error) {
        console.warn('[OfflineFirst] Server create failed, saving locally:', error);
      }
    }

    console.log('[OfflineFirst] OFFLINE - saving feed record locally with needs_sync=1');
    const localRecord = await offlineDataService.createFeedRecord(recordData, false);

    // Emit event
    dataEventBus.emit(EventTypes.FEED_RECORD_CREATED, { recordId: localRecord.id, record: localRecord, recordType: 'feed' });

    return localRecord;
  }

  async deleteFeedRecord(recordId) {
    const online = await this.isOnline();

    if (online) {
      try {
        await apiService.deleteFeedRecord(recordId);
        const localRecord = await offlineDataService.getByServerId('feed_records', recordId.toString());
        if (localRecord) {
          await offlineDataService.deleteFeedRecord(localRecord.id, true);
        }

        // Emit event
        dataEventBus.emit(EventTypes.FEED_RECORD_DELETED, { recordId, recordType: 'feed' });

        return true;
      } catch (error) {
        console.warn('[OfflineFirst] Server delete failed, deleting locally:', error);
      }
    }

    const localRecord = await offlineDataService.getByServerId('feed_records', recordId.toString());
    if (localRecord) {
      await offlineDataService.deleteFeedRecord(localRecord.id, false);

      // Emit event
      dataEventBus.emit(EventTypes.FEED_RECORD_DELETED, { recordId, recordType: 'feed' });

      return true;
    }
    throw new Error('Feed record not found locally');
  }

  // ==================== PRODUCTION RECORDS ====================

  async getProductionRecords() {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const records = await apiService.getProductionRecords();
          this._cacheProductionRecordsLocally(records).catch(err =>
            console.warn('[OfflineFirst] Failed to cache production records:', err)
          );
          return records;
        } catch (error) {
          console.warn('[OfflineFirst] Server fetch failed, falling back to local:', error);
          return await offlineDataService.getProductionRecords();
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning local production records');
        return await offlineDataService.getProductionRecords();
      }
    } catch (error) {
      console.error('[OfflineFirst] getProductionRecords error:', error);
      return [];
    }
  }

  async createProductionRecord(recordData) {
    const online = await this.isOnline();

    if (online) {
      try {
        console.log('[OfflineFirst] ONLINE - creating production record on server');
        const record = await apiService.createProductionRecord(recordData);
        await offlineDataService.createProductionRecord({ ...recordData, server_id: record.id }, true);

        // Emit event
        dataEventBus.emit(EventTypes.PRODUCTION_RECORD_CREATED, { recordId: record.id, record, recordType: 'production' });

        return record;
      } catch (error) {
        console.warn('[OfflineFirst] Server create failed, saving locally:', error);
      }
    }

    console.log('[OfflineFirst] OFFLINE - saving production record locally with needs_sync=1');
    const localRecord = await offlineDataService.createProductionRecord(recordData, false);

    // Emit event
    dataEventBus.emit(EventTypes.PRODUCTION_RECORD_CREATED, { recordId: localRecord.id, record: localRecord, recordType: 'production' });

    return localRecord;
  }

  async deleteProductionRecord(recordId) {
    const online = await this.isOnline();

    if (online) {
      try {
        await apiService.deleteProductionRecord(recordId);
        const localRecord = await offlineDataService.getByServerId('production_records', recordId.toString());
        if (localRecord) {
          await offlineDataService.deleteProductionRecord(localRecord.id, true);
        }

        // Emit event
        dataEventBus.emit(EventTypes.PRODUCTION_RECORD_DELETED, { recordId, recordType: 'production' });

        return true;
      } catch (error) {
        console.warn('[OfflineFirst] Server delete failed, deleting locally:', error);
      }
    }

    const localRecord = await offlineDataService.getByServerId('production_records', recordId.toString());
    if (localRecord) {
      await offlineDataService.deleteProductionRecord(localRecord.id, false);

      // Emit event
      dataEventBus.emit(EventTypes.PRODUCTION_RECORD_DELETED, { recordId, recordType: 'production' });

      return true;
    }
    throw new Error('Production record not found locally');
  }

  // ==================== MORTALITY RECORDS ====================

  async getMortalityRecords() {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const records = await apiService.getMortalityRecords();
          this._cacheMortalityRecordsLocally(records).catch(err =>
            console.warn('[OfflineFirst] Failed to cache mortality records:', err)
          );
          return records;
        } catch (error) {
          console.warn('[OfflineFirst] Server fetch failed, falling back to local:', error);
          return await offlineDataService.getMortalityRecords();
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning local mortality records');
        return await offlineDataService.getMortalityRecords();
      }
    } catch (error) {
      console.error('[OfflineFirst] getMortalityRecords error:', error);
      return [];
    }
  }

  async createMortalityRecord(recordData) {
    const online = await this.isOnline();

    if (online) {
      try {
        console.log('[OfflineFirst] ONLINE - creating mortality record on server');
        const record = await apiService.createMortalityRecord(recordData);
        await offlineDataService.createMortalityRecord({ ...recordData, server_id: record.id }, true);

        dataEventBus.emit(EventTypes.MORTALITY_RECORD_CREATED, { recordId: record.id, record, recordType: 'mortality' });

        return record;
      } catch (error) {
        console.warn('[OfflineFirst] Server create failed, saving locally:', error);
      }
    }

    console.log('[OfflineFirst] OFFLINE - saving mortality record locally with needs_sync=1');
    const localRecord = await offlineDataService.createMortalityRecord(recordData, false);

    dataEventBus.emit(EventTypes.MORTALITY_RECORD_CREATED, { recordId: localRecord.id, record: localRecord, recordType: 'mortality' });

    return localRecord;
  }

  async deleteMortalityRecord(recordId) {
    const online = await this.isOnline();

    if (online) {
      try {
        await apiService.deleteMortalityRecord(recordId);
        const localRecord = await offlineDataService.getByServerId('mortality_records', recordId.toString());
        if (localRecord) {
          await offlineDataService.deleteMortalityRecord(localRecord.id, true);
        }

        dataEventBus.emit(EventTypes.MORTALITY_RECORD_DELETED, { recordId, recordType: 'mortality' });

        return true;
      } catch (error) {
        console.warn('[OfflineFirst] Server delete failed, deleting locally:', error);
      }
    }

    const localRecord = await offlineDataService.getByServerId('mortality_records', recordId.toString());
    if (localRecord) {
      await offlineDataService.deleteMortalityRecord(localRecord.id, false);

      dataEventBus.emit(EventTypes.MORTALITY_RECORD_DELETED, { recordId, recordType: 'mortality' });

      return true;
    }
    throw new Error('Mortality record not found locally');
  }

  // ==================== HEALTH RECORDS ====================

  async getHealthRecords() {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const records = await apiService.getHealthRecords();
          this._cacheHealthRecordsLocally(records).catch(err =>
            console.warn('[OfflineFirst] Failed to cache health records:', err)
          );
          return records;
        } catch (error) {
          console.warn('[OfflineFirst] Server fetch failed, falling back to local:', error);
          return await offlineDataService.getHealthRecords();
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning local health records');
        return await offlineDataService.getHealthRecords();
      }
    } catch (error) {
      console.error('[OfflineFirst] getHealthRecords error:', error);
      return [];
    }
  }

  async createHealthRecord(recordData) {
    const online = await this.isOnline();

    if (online) {
      try {
        console.log('[OfflineFirst] ONLINE - creating health record on server');
        const record = await apiService.createHealthRecord(recordData);
        await offlineDataService.createHealthRecord({ ...recordData, server_id: record.id }, true);

        dataEventBus.emit(EventTypes.HEALTH_RECORD_CREATED, { recordId: record.id, record, recordType: 'health' });

        return record;
      } catch (error) {
        console.warn('[OfflineFirst] Server create failed, saving locally:', error);
      }
    }

    console.log('[OfflineFirst] OFFLINE - saving health record locally with needs_sync=1');
    const localRecord = await offlineDataService.createHealthRecord(recordData, false);

    dataEventBus.emit(EventTypes.HEALTH_RECORD_CREATED, { recordId: localRecord.id, record: localRecord, recordType: 'health' });

    return localRecord;
  }

  async updateHealthRecord(recordId, recordData) {
    const online = await this.isOnline();

    if (online) {
      try {
        const updatedRecord = await apiService.updateHealthRecord(recordId, recordData);
        const localRecord = await offlineDataService.getByServerId('health_records', recordId.toString());
        if (localRecord) {
          await offlineDataService.updateHealthRecord(localRecord.id, recordData, true);
        }

        dataEventBus.emit(EventTypes.HEALTH_RECORD_UPDATED, { recordId, record: updatedRecord, recordType: 'health' });

        return updatedRecord;
      } catch (error) {
        console.warn('[OfflineFirst] Server update failed, updating locally:', error);
      }
    }

    const localRecord = await offlineDataService.getByServerId('health_records', recordId.toString());
    if (localRecord) {
      await offlineDataService.updateHealthRecord(localRecord.id, recordData, false);
      const updated = { ...localRecord, ...recordData };

      dataEventBus.emit(EventTypes.HEALTH_RECORD_UPDATED, { recordId, record: updated, recordType: 'health' });

      return updated;
    }
    throw new Error('Health record not found locally');
  }

  async deleteHealthRecord(recordId) {
    const online = await this.isOnline();

    if (online) {
      try {
        await apiService.deleteHealthRecord(recordId);
        const localRecord = await offlineDataService.getByServerId('health_records', recordId.toString());
        if (localRecord) {
          await offlineDataService.deleteHealthRecord(localRecord.id, true);
        }

        dataEventBus.emit(EventTypes.HEALTH_RECORD_DELETED, { recordId, recordType: 'health' });

        return true;
      } catch (error) {
        console.warn('[OfflineFirst] Server delete failed, deleting locally:', error);
      }
    }

    const localRecord = await offlineDataService.getByServerId('health_records', recordId.toString());
    if (localRecord) {
      await offlineDataService.deleteHealthRecord(localRecord.id, false);

      dataEventBus.emit(EventTypes.HEALTH_RECORD_DELETED, { recordId, recordType: 'health' });

      return true;
    }
    throw new Error('Health record not found locally');
  }

  // ==================== WATER RECORDS ====================

  async getWaterRecords(batchId = null) {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const records = await apiService.getWaterRecords(batchId);
          this._cacheWaterRecordsLocally(records).catch(err =>
            console.warn('[OfflineFirst] Failed to cache water records:', err)
          );
          return records;
        } catch (error) {
          console.warn('[OfflineFirst] Server fetch failed, falling back to local:', error);
          return batchId
            ? await offlineDataService.getWaterRecordsByBatch(batchId)
            : await offlineDataService.getWaterRecords();
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning local water records');
        return batchId
          ? await offlineDataService.getWaterRecordsByBatch(batchId)
          : await offlineDataService.getWaterRecords();
      }
    } catch (error) {
      console.error('[OfflineFirst] getWaterRecords error:', error);
      return [];
    }
  }

  async createWaterRecord(recordData) {
    const online = await this.isOnline();

    if (online) {
      try {
        console.log('[OfflineFirst] ONLINE - creating water record on server');
        const record = await apiService.createWaterRecord(recordData);
        await offlineDataService.createWaterRecord({ ...recordData, server_id: record.id }, true);

        dataEventBus.emit(EventTypes.WATER_RECORD_CREATED, { recordId: record.id, record, recordType: 'water' });

        return record;
      } catch (error) {
        console.warn('[OfflineFirst] Server create failed, saving locally:', error);
      }
    }

    console.log('[OfflineFirst] OFFLINE - saving water record locally with needs_sync=1');
    const localRecord = await offlineDataService.createWaterRecord(recordData, false);

    dataEventBus.emit(EventTypes.WATER_RECORD_CREATED, { recordId: localRecord.id, record: localRecord, recordType: 'water' });

    return localRecord;
  }

  async deleteWaterRecord(recordId) {
    const online = await this.isOnline();

    if (online) {
      try {
        await apiService.deleteWaterRecord(recordId);
        const localRecord = await offlineDataService.getByServerId('water_records', recordId.toString());
        if (localRecord) {
          await offlineDataService.deleteWaterRecord(localRecord.id, true);
        }

        dataEventBus.emit(EventTypes.WATER_RECORD_DELETED, { recordId, recordType: 'water' });

        return true;
      } catch (error) {
        console.warn('[OfflineFirst] Server delete failed, deleting locally:', error);
      }
    }

    const localRecord = await offlineDataService.getByServerId('water_records', recordId.toString());
    if (localRecord) {
      await offlineDataService.deleteWaterRecord(localRecord.id, false);

      dataEventBus.emit(EventTypes.WATER_RECORD_DELETED, { recordId, recordType: 'water' });

      return true;
    }
    throw new Error('Water record not found locally');
  }

  // ==================== WEIGHT RECORDS ====================

  async getWeightRecords(batchId = null) {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const records = await apiService.getWeightRecords(batchId);
          this._cacheWeightRecordsLocally(records).catch(err =>
            console.warn('[OfflineFirst] Failed to cache weight records:', err)
          );
          return records;
        } catch (error) {
          console.warn('[OfflineFirst] Server fetch failed, falling back to local:', error);
          return batchId
            ? await offlineDataService.getWeightRecordsByBatch(batchId)
            : await offlineDataService.getWeightRecords();
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning local weight records');
        return batchId
          ? await offlineDataService.getWeightRecordsByBatch(batchId)
          : await offlineDataService.getWeightRecords();
      }
    } catch (error) {
      console.error('[OfflineFirst] getWeightRecords error:', error);
      return [];
    }
  }

  async createWeightRecord(recordData) {
    const online = await this.isOnline();

    if (online) {
      try {
        console.log('[OfflineFirst] ONLINE - creating weight record on server');
        const record = await apiService.createWeightRecord(recordData);
        await offlineDataService.createWeightRecord({ ...recordData, server_id: record.id }, true);

        dataEventBus.emit(EventTypes.WEIGHT_RECORD_CREATED, { recordId: record.id, record, recordType: 'weight' });

        return record;
      } catch (error) {
        console.warn('[OfflineFirst] Server create failed, saving locally:', error);
      }
    }

    console.log('[OfflineFirst] OFFLINE - saving weight record locally with needs_sync=1');
    const localRecord = await offlineDataService.createWeightRecord(recordData, false);

    dataEventBus.emit(EventTypes.WEIGHT_RECORD_CREATED, { recordId: localRecord.id, record: localRecord, recordType: 'weight' });

    return localRecord;
  }

  async deleteWeightRecord(recordId) {
    const online = await this.isOnline();

    if (online) {
      try {
        await apiService.deleteWeightRecord(recordId);
        const localRecord = await offlineDataService.getByServerId('weight_records', recordId.toString());
        if (localRecord) {
          await offlineDataService.deleteWeightRecord(localRecord.id, true);
        }

        dataEventBus.emit(EventTypes.WEIGHT_RECORD_DELETED, { recordId, recordType: 'weight' });

        return true;
      } catch (error) {
        console.warn('[OfflineFirst] Server delete failed, deleting locally:', error);
      }
    }

    const localRecord = await offlineDataService.getByServerId('weight_records', recordId.toString());
    if (localRecord) {
      await offlineDataService.deleteWeightRecord(localRecord.id, false);

      dataEventBus.emit(EventTypes.WEIGHT_RECORD_DELETED, { recordId, recordType: 'weight' });

      return true;
    }
    throw new Error('Weight record not found locally');
  }

  // ==================== VACCINATIONS ====================

  async getVaccinations() {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          return await apiService.getVaccinations();
        } catch (error) {
          console.warn('[OfflineFirst] Server fetch failed, falling back to local:', error);
          return await offlineDataService.getHealthRecords();
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning local health records (vaccinations)');
        return await offlineDataService.getHealthRecords();
      }
    } catch (error) {
      console.error('[OfflineFirst] getVaccinations error:', error);
      return [];
    }
  }

  async createVaccination(vaccinationData) {
    const online = await this.isOnline();

    if (online) {
      try {
        console.log('[OfflineFirst] ONLINE - creating vaccination on server');
        const record = await apiService.createVaccination(vaccinationData);
        await offlineDataService.createHealthRecord({ ...vaccinationData, server_id: record.id }, true);

        dataEventBus.emit(EventTypes.HEALTH_RECORD_CREATED, { recordId: record.id, record, recordType: 'health' });

        return record;
      } catch (error) {
        console.warn('[OfflineFirst] Server create failed, saving locally:', error);
      }
    }

    console.log('[OfflineFirst] OFFLINE - saving vaccination locally with needs_sync=1');
    const localRecord = await offlineDataService.createHealthRecord(vaccinationData, false);

    dataEventBus.emit(EventTypes.HEALTH_RECORD_CREATED, { recordId: localRecord.id, record: localRecord, recordType: 'health' });

    return localRecord;
  }

  // ==================== GENERIC RECORD METHODS (for RecordsScreen compatibility) ====================

  async getRecords(recordType) {
    // Map to specific methods and wrap results consistently
    try {
      let records = [];
      switch (recordType) {
        case 'feed':
          records = await this.getFeedRecords();
          break;
        case 'production':
          records = await this.getProductionRecords();
          break;
        case 'mortality':
          records = await this.getMortalityRecords();
          break;
        case 'health':
          records = await this.getHealthRecords();
          break;
        case 'water':
          records = await this.getWaterRecords();
          break;
        case 'weight':
          records = await this.getWeightRecords();
          break;
        default:
          records = [];
      }

      // Ensure we always return a consistent format
      return { success: true, data: Array.isArray(records) ? records : [] };
    } catch (error) {
      console.error(`[OfflineFirst] getRecords(${recordType}) error:`, error);
      return { success: true, data: [] };
    }
  }

  async createRecord(recordType, recordData) {
    // Map to specific methods
    try {
      let result;
      switch (recordType) {
        case 'feed':
          result = await this.createFeedRecord(recordData);
          break;
        case 'production':
          result = await this.createProductionRecord(recordData);
          break;
        case 'mortality':
          result = await this.createMortalityRecord(recordData);
          break;
        case 'health':
          result = await this.createHealthRecord(recordData);
          break;
        case 'water':
          result = await this.createWaterRecord(recordData);
          break;
        case 'weight':
          result = await this.createWeightRecord(recordData);
          break;
        default:
          throw new Error(`Unknown record type: ${recordType}`);
      }
      return { success: true, data: result };
    } catch (error) {
      console.error(`[OfflineFirst] createRecord(${recordType}) error:`, error);
      return { success: false, error: error.message };
    }
  }

  async deleteRecord(recordType, recordId) {
    // Map to specific methods
    try {
      let result;
      switch (recordType) {
        case 'feed':
          result = await this.deleteFeedRecord(recordId);
          break;
        case 'production':
          result = await this.deleteProductionRecord(recordId);
          break;
        case 'mortality':
          result = await this.deleteMortalityRecord(recordId);
          break;
        case 'health':
          result = await this.deleteHealthRecord(recordId);
          break;
        case 'water':
          result = await this.deleteWaterRecord(recordId);
          break;
        case 'weight':
          result = await this.deleteWeightRecord(recordId);
          break;
        default:
          throw new Error(`Unknown record type: ${recordType}`);
      }
      return { success: true };
    } catch (error) {
      console.error(`[OfflineFirst] deleteRecord(${recordType}) error:`, error);
      return { success: false, error: error.message };
    }
  }

  // ==================== DASHBOARD ====================

  async getDashboard() {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const dashboardData = await apiService.getDashboard();

          // Cache dashboard data locally (background operation)
          this._cacheDashboardLocally(dashboardData).catch(err =>
            console.warn('[OfflineFirst] Failed to cache dashboard:', err)
          );

          return dashboardData;
        } catch (error) {
          console.warn('[OfflineFirst] Server dashboard failed, using local data:', error);
          return await offlineDataService.getDashboardData();
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning local dashboard data');
        return await offlineDataService.getDashboardData();
      }
    } catch (error) {
      console.error('[OfflineFirst] getDashboard error:', error);
      return null;
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * Get dashboard analytics (production trends, KPIs, etc.)
   * This is the main analytics endpoint used by AnalyticsScreen
   */
  async getAnalytics(params = {}) {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          // Fetch from server
          const analyticsData = await apiService.getAnalytics(params);

          // Cache analytics data locally (background operation)
          this._cacheAnalyticsLocally('analytics', params, analyticsData).catch(err =>
            console.warn('[OfflineFirst] Failed to cache analytics:', err)
          );

          return analyticsData;
        } catch (error) {
          console.warn('[OfflineFirst] Server analytics fetch failed, falling back to local:', error);
          return await offlineDataService.getCachedAnalytics('analytics', params);
        }
      } else {
        // Offline: Return cached data
        console.log('[OfflineFirst] Offline mode - returning cached analytics');
        return await offlineDataService.getCachedAnalytics('analytics', params);
      }
    } catch (error) {
      console.error('[OfflineFirst] getAnalytics error:', error);
      return null;
    }
  }

  /**
   * Get dashboard analytics (wrapper for backward compatibility)
   */
  async getDashboardAnalytics(params = {}) {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          // Fetch production trends from server (main analytics endpoint)
          const analyticsData = await apiService.getProductionTrends(params);

          // Cache locally
          this._cacheAnalyticsLocally('dashboard', params, analyticsData).catch(err =>
            console.warn('[OfflineFirst] Failed to cache dashboard analytics:', err)
          );

          return analyticsData;
        } catch (error) {
          console.warn('[OfflineFirst] Server analytics fetch failed, falling back to local:', error);
          return await offlineDataService.getCachedAnalytics('dashboard', params);
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning cached dashboard analytics');
        return await offlineDataService.getCachedAnalytics('dashboard', params);
      }
    } catch (error) {
      console.error('[OfflineFirst] getDashboardAnalytics error:', error);
      return null;
    }
  }

  /**
   * Get trend analysis data
   */
  async getTrends(params = {}) {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const trendsData = await apiService.getTrends(params);

          // Cache locally
          this._cacheAnalyticsLocally('trends', params, trendsData).catch(err =>
            console.warn('[OfflineFirst] Failed to cache trends:', err)
          );

          return trendsData;
        } catch (error) {
          console.warn('[OfflineFirst] Server trends fetch failed, falling back to local:', error);
          return await offlineDataService.getCachedAnalytics('trends', params);
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning cached trends');
        return await offlineDataService.getCachedAnalytics('trends', params);
      }
    } catch (error) {
      console.error('[OfflineFirst] getTrends error:', error);
      return null;
    }
  }

  /**
   * Get flock performance analytics
   */
  async getFlockPerformance(params = {}) {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const performanceData = await apiService.getFlockPerformance(params);

          // Cache locally
          this._cacheAnalyticsLocally('flockPerformance', params, performanceData).catch(err =>
            console.warn('[OfflineFirst] Failed to cache flock performance:', err)
          );

          return performanceData;
        } catch (error) {
          console.warn('[OfflineFirst] Server flock performance fetch failed, falling back to local:', error);
          return await offlineDataService.getCachedAnalytics('flockPerformance', params);
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning cached flock performance');
        return await offlineDataService.getCachedAnalytics('flockPerformance', params);
      }
    } catch (error) {
      console.error('[OfflineFirst] getFlockPerformance error:', error);
      return null;
    }
  }

  /**
   * Get financial analytics
   */
  async getFinancialAnalytics(params = {}) {
    try {
      const online = await this.isOnline();

      if (online) {
        try {
          const financialData = await apiService.getFinancialAnalytics(params);

          // Cache locally
          this._cacheAnalyticsLocally('financial', params, financialData).catch(err =>
            console.warn('[OfflineFirst] Failed to cache financial analytics:', err)
          );

          return financialData;
        } catch (error) {
          console.warn('[OfflineFirst] Server financial analytics fetch failed, falling back to local:', error);
          return await offlineDataService.getCachedAnalytics('financial', params);
        }
      } else {
        console.log('[OfflineFirst] Offline mode - returning cached financial analytics');
        return await offlineDataService.getCachedAnalytics('financial', params);
      }
    } catch (error) {
      console.error('[OfflineFirst] getFinancialAnalytics error:', error);
      return null;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(params = {}) {
    try {
      const online = await this.isOnline();

      if (!online) {
        throw new Error('Export is only available online. Please connect to the internet.');
      }

      return await apiService.exportAnalytics(params);
    } catch (error) {
      console.error('[OfflineFirst] exportAnalytics error:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS FOR CACHING ====================

  /**
   * Map server record format (camelCase) to local SQLite format (snake_case)
   * This prevents SQLite errors like "table farms has no column named farmName"
   */
  _mapServerToLocalRecord(tableName, serverRecord) {
    const mapped = { ...serverRecord };

    // Common mappings
    if (serverRecord.id) {
      mapped.server_id = serverRecord.id.toString();
      delete mapped.id;
    }

    // Table-specific mappings
    switch (tableName) {
      case 'farms':
        // Backend uses 'name', not 'farmName'
        if (serverRecord.name) mapped.farm_name = serverRecord.name;
        if (serverRecord.farmName) mapped.farm_name = serverRecord.farmName;
        if (serverRecord.organizationId) mapped.organization_id = serverRecord.organizationId;
        if (serverRecord.ownerId) mapped.owner_id = serverRecord.ownerId;
        if (serverRecord.farmSize) mapped.farm_size = serverRecord.farmSize;
        if (serverRecord.farmType) mapped.farm_type = serverRecord.farmType;
        if (serverRecord.contactPerson) mapped.contact_person = serverRecord.contactPerson;
        if (serverRecord.phoneNumber) mapped.phone_number = serverRecord.phoneNumber;

        // Clean up camelCase fields
        delete mapped.name;
        delete mapped.farmName;
        delete mapped.organizationId;
        delete mapped.ownerId;
        delete mapped.farmSize;
        delete mapped.farmType;
        delete mapped.contactPerson;
        delete mapped.phoneNumber;
        delete mapped.capacity;
        delete mapped.currentStock;
        delete mapped.current_stock;
        delete mapped.owner_id;
        delete mapped.user;
        delete mapped.organization;
        break;

      case 'poultry_batches':
        if (serverRecord.batchName) mapped.batch_name = serverRecord.batchName;
        if (serverRecord.batchNumber) mapped.batch_number = serverRecord.batchNumber;
        if (serverRecord.initialCount) mapped.initial_count = serverRecord.initialCount;
        if (serverRecord.currentCount) mapped.current_count = serverRecord.currentCount;
        if (serverRecord.hatchDate) mapped.hatch_date = serverRecord.hatchDate;
        if (serverRecord.acquisitionDate) mapped.acquisition_date = serverRecord.acquisitionDate;
        if (serverRecord.arrivalDate) mapped.arrival_date = serverRecord.arrivalDate;
        if (serverRecord.expectedEndDate) mapped.expected_end_date = serverRecord.expectedEndDate;
        if (serverRecord.farmId) mapped.farm_id = serverRecord.farmId;

        // Clean up camelCase fields
        delete mapped.batchName;
        delete mapped.batchNumber;
        delete mapped.initialCount;
        delete mapped.currentCount;
        delete mapped.hatchDate;
        delete mapped.acquisitionDate;
        delete mapped.arrivalDate;
        delete mapped.expectedEndDate;
        delete mapped.farmId;
        break;

      case 'feed_records':
        if (serverRecord.recordDate && !mapped.date) mapped.date = serverRecord.recordDate;
        if (serverRecord.feedType) mapped.feed_type = serverRecord.feedType;
        if (serverRecord.quantityKg) mapped.quantity_kg = serverRecord.quantityKg;
        if (serverRecord.costPerKg) mapped.cost_per_kg = serverRecord.costPerKg;
        if (serverRecord.totalCost) mapped.total_cost = serverRecord.totalCost;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;

        // Clean up camelCase fields
        delete mapped.feedType;
        delete mapped.quantityKg;
        delete mapped.costPerKg;
        delete mapped.totalCost;
        delete mapped.batchId;
        delete mapped.farmId;
        delete mapped.recordDate;
        delete mapped.batch;
        delete mapped.user;
        break;

      case 'production_records':
        if (serverRecord.recordDate && !mapped.date) mapped.date = serverRecord.recordDate;
        if (serverRecord.eggsCollected) mapped.eggs_collected = serverRecord.eggsCollected;
        if (serverRecord.eggsBroken) mapped.eggs_broken = serverRecord.eggsBroken;
        if (serverRecord.brokenEggs && !mapped.eggs_broken) mapped.eggs_broken = serverRecord.brokenEggs;
        if (serverRecord.abnormalEggs) mapped.abnormal_eggs = serverRecord.abnormalEggs;
        if (serverRecord.eggsSold) mapped.eggs_sold = serverRecord.eggsSold;
        if (serverRecord.eggWeightKg) mapped.egg_weight_kg = serverRecord.eggWeightKg;
        if (serverRecord.eggWeightAvg) mapped.egg_weight_avg = serverRecord.eggWeightAvg;
        if (serverRecord.pricePerDozen) mapped.price_per_dozen = serverRecord.pricePerDozen;
        if (serverRecord.totalRevenue) mapped.total_revenue = serverRecord.totalRevenue;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;

        // Clean up camelCase fields
        delete mapped.eggsCollected;
        delete mapped.eggsBroken;
        delete mapped.brokenEggs;
        delete mapped.abnormalEggs;
        delete mapped.eggsSold;
        delete mapped.eggWeightKg;
        delete mapped.eggWeightAvg;
        delete mapped.pricePerDozen;
        delete mapped.totalRevenue;
        delete mapped.batchId;
        delete mapped.farmId;
        delete mapped.recordDate;
        delete mapped.weight;
        break;

      case 'mortality_records':
        if (serverRecord.ageWeeks) mapped.age_weeks = serverRecord.ageWeeks;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;

        // Clean up camelCase fields
        delete mapped.ageWeeks;
        delete mapped.batchId;
        delete mapped.farmId;
        break;

      case 'health_records':
        if (serverRecord.healthIssue) mapped.health_issue = serverRecord.healthIssue;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;

        // Clean up camelCase fields
        delete mapped.healthIssue;
        delete mapped.batchId;
        delete mapped.farmId;
        break;

      case 'water_records':
        if (serverRecord.quantityLiters) mapped.quantity_liters = serverRecord.quantityLiters;
        if (serverRecord.sourceType) mapped.source_type = serverRecord.sourceType;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;

        // Clean up camelCase fields
        delete mapped.quantityLiters;
        delete mapped.sourceType;
        delete mapped.batchId;
        delete mapped.farmId;
        break;

      case 'weight_records':
        if (serverRecord.averageWeight) mapped.average_weight = serverRecord.averageWeight;
        if (serverRecord.sampleSize) mapped.sample_size = serverRecord.sampleSize;
        if (serverRecord.weightUnit) mapped.weight_unit = serverRecord.weightUnit;
        if (serverRecord.batchId) mapped.batch_id = serverRecord.batchId;

        // Clean up camelCase fields
        delete mapped.averageWeight;
        delete mapped.sampleSize;
        delete mapped.weightUnit;
        delete mapped.batchId;
        delete mapped.farmId;
        break;
    }

    // Universal cleanup: Map timestamp fields
    if (serverRecord.createdAt && !mapped.created_at) mapped.created_at = serverRecord.createdAt;
    if (serverRecord.updatedAt && !mapped.updated_at) mapped.updated_at = serverRecord.updatedAt;
    if (serverRecord.deletedAt && !mapped.deleted_at) mapped.deleted_at = serverRecord.deletedAt;

    // Delete ALL camelCase timestamp fields
    delete mapped.createdAt;
    delete mapped.updatedAt;
    delete mapped.deletedAt;
    delete mapped.organizationId;

    // Universal cleanup: Remove ALL unmapped camelCase foreign key fields
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

  async _cacheFarmsLocally(farms) {
    for (const farm of farms) {
      try {
        const existing = await offlineDataService.getByServerId('farms', farm.id.toString());
        const mappedFarm = this._mapServerToLocalRecord('farms', farm);

        if (existing) {
          await offlineDataService.updateFarm(existing.id, mappedFarm, true);
        } else {
          await offlineDataService.createFarm(mappedFarm, true);
        }
      } catch (error) {
        console.warn('[OfflineFirst] Failed to cache farm:', error);
      }
    }
  }

  async _cacheFlocksLocally(flocks) {
    for (const flock of flocks) {
      try {
        const existing = await offlineDataService.getByServerId('poultry_batches', flock.id.toString());
        const mappedFlock = this._mapServerToLocalRecord('poultry_batches', flock);

        if (existing) {
          await offlineDataService.updateBatch(existing.id, mappedFlock, true);
        } else {
          await offlineDataService.createBatch(mappedFlock, true);
        }
      } catch (error) {
        console.warn('[OfflineFirst] Failed to cache flock:', error);
      }
    }
  }

  async _cacheFeedRecordsLocally(records) {
    for (const record of records) {
      try {
        const existing = await offlineDataService.getByServerId('feed_records', record.id.toString());
        const mappedRecord = this._mapServerToLocalRecord('feed_records', record);

        if (existing) {
          await offlineDataService.updateFeedRecord(existing.id, mappedRecord, true);
        } else {
          await offlineDataService.createFeedRecord(mappedRecord, true);
        }
      } catch (error) {
        console.warn('[OfflineFirst] Failed to cache feed record:', error);
      }
    }
  }

  async _cacheProductionRecordsLocally(records) {
    for (const record of records) {
      try {
        const existing = await offlineDataService.getByServerId('production_records', record.id.toString());
        const mappedRecord = this._mapServerToLocalRecord('production_records', record);

        if (existing) {
          await offlineDataService.updateProductionRecord(existing.id, mappedRecord, true);
        } else {
          await offlineDataService.createProductionRecord(mappedRecord, true);
        }
      } catch (error) {
        console.warn('[OfflineFirst] Failed to cache production record:', error);
      }
    }
  }

  async _cacheMortalityRecordsLocally(records) {
    for (const record of records) {
      try {
        const existing = await offlineDataService.getByServerId('mortality_records', record.id.toString());
        const mappedRecord = this._mapServerToLocalRecord('mortality_records', record);

        if (existing) {
          await offlineDataService.updateMortalityRecord(existing.id, mappedRecord, true);
        } else {
          await offlineDataService.createMortalityRecord(mappedRecord, true);
        }
      } catch (error) {
        console.warn('[OfflineFirst] Failed to cache mortality record:', error);
      }
    }
  }

  async _cacheHealthRecordsLocally(records) {
    for (const record of records) {
      try {
        const existing = await offlineDataService.getByServerId('health_records', record.id.toString());
        const mappedRecord = this._mapServerToLocalRecord('health_records', record);

        if (existing) {
          await offlineDataService.updateHealthRecord(existing.id, mappedRecord, true);
        } else {
          await offlineDataService.createHealthRecord(mappedRecord, true);
        }
      } catch (error) {
        console.warn('[OfflineFirst] Failed to cache health record:', error);
      }
    }
  }

  async _cacheWaterRecordsLocally(records) {
    for (const record of records) {
      try {
        const existing = await offlineDataService.getByServerId('water_records', record.id.toString());
        const mappedRecord = this._mapServerToLocalRecord('water_records', record);

        if (existing) {
          await offlineDataService.updateWaterRecord(existing.id, mappedRecord, true);
        } else {
          await offlineDataService.createWaterRecord(mappedRecord, true);
        }
      } catch (error) {
        console.warn('[OfflineFirst] Failed to cache water record:', error);
      }
    }
  }

  async _cacheWeightRecordsLocally(records) {
    for (const record of records) {
      try {
        const existing = await offlineDataService.getByServerId('weight_records', record.id.toString());
        const mappedRecord = this._mapServerToLocalRecord('weight_records', record);

        if (existing) {
          await offlineDataService.updateWeightRecord(existing.id, mappedRecord, true);
        } else {
          await offlineDataService.createWeightRecord(mappedRecord, true);
        }
      } catch (error) {
        console.warn('[OfflineFirst] Failed to cache weight record:', error);
      }
    }
  }

  async _cacheDashboardLocally(dashboardData) {
    try {
      await offlineDataService.cacheDashboard(dashboardData);
    } catch (error) {
      console.warn('[OfflineFirst] Failed to cache dashboard data:', error);
    }
  }

  async _cacheAnalyticsLocally(type, params, data) {
    try {
      await offlineDataService.cacheAnalytics(type, params, data);
    } catch (error) {
      console.warn('[OfflineFirst] Failed to cache analytics data:', error);
    }
  }
}

export default new OfflineFirstService();
