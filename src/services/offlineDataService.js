import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fastDatabaseImport from './fastDatabase';

// FIX: Handle both default and named exports from fastDatabase
const databaseService = fastDatabaseImport.default || fastDatabaseImport;

// Debug log to verify correct import
console.log('[OfflineDataService] Database import check:', {
  hasDefault: !!fastDatabaseImport.default,
  hasSelect: typeof databaseService.select,
  hasCount: typeof databaseService.count,
  isReady: databaseService.isReady
});

class OfflineDataService {
  constructor() {
    this.tableConfig = {
      organizations: { serverIdField: 'server_id' },
      users: { serverIdField: 'server_id' },
      farms: { serverIdField: 'server_id' },
      poultry_batches: { serverIdField: 'server_id' },
      feed_records: { serverIdField: 'server_id' },
      production_records: { serverIdField: 'server_id' },
      mortality_records: { serverIdField: 'server_id' },
      health_records: { serverIdField: 'server_id' },
      water_records: { serverIdField: 'server_id' },
      weight_records: { serverIdField: 'server_id' },
      expenses: { serverIdField: 'server_id' },
      customers: { serverIdField: 'server_id' },
      sales: { serverIdField: 'server_id' }
    };
  }

  // Get current organization ID from storage
  async getCurrentOrganizationId() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        return user.organizationId;
      }
    } catch (error) {
      console.error('Error getting current organization ID:', error);
    }
    return null;
  }

  // Initialize the database with enhanced error handling
  async init() {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        retryCount++;
        console.log(`🔄 Initializing OfflineDataService (attempt ${retryCount}/${maxRetries})...`);

        // Initialize the database service with robust error handling
        const dbInitialized = await databaseService.init();
        if (!dbInitialized) {
          throw new Error('Database initialization returned false');
        }

        // Verify database connection
        const isConnected = await databaseService.isConnected();
        if (!isConnected) {
          throw new Error('Database connection verification failed');
        }

        // Perform comprehensive database test
        const testResult = await databaseService.testDatabaseOperations();
        if (!testResult.success) {
          throw new Error(`Database operations test failed: ${testResult.error}`);
        }

        console.log('✅ OfflineDataService initialized successfully');
        console.log(`📊 Database ready with ${testResult.tablesCount} tables and ${testResult.indexesCount} indexes`);

        // Log database health status
        const healthCheck = await databaseService.healthCheck();
        if (healthCheck.isHealthy) {
          console.log('🟢 Database health check: HEALTHY');
        } else {
          console.warn('🟡 Database health check: WARNING -', healthCheck.error);
        }

        return true;

      } catch (error) {
        console.error(`❌ OfflineDataService initialization attempt ${retryCount} failed:`, error);

        if (retryCount >= maxRetries) {
          // CRITICAL FIX: Return false instead of throwing
          // This prevents error notifications and allows app to continue
          console.error('❌ OfflineDataService initialization failed after all retries');
          console.error('❌ App will continue in online-only mode');
          return false;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 3000);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // CRITICAL FIX: If loop exhausts, return false (not throw)
    console.error('❌ OfflineDataService exhausted all retries');
    return false;
  }

  // Generic CRUD Operations with sync queue management

  async create(tableName, data, skipSync = false) {
    try {
      // EMERGENCY FIX: Don't retry database init
      if (!databaseService.isReady) {
        return null; // Return null instead of retrying
      }

      // MULTI-TENANT FIX: Add organization ID to all records
      const orgId = await this.getCurrentOrganizationId();
      if (!orgId && tableName !== 'organizations' && tableName !== 'sync_queue') {
        throw new Error('Cannot create records without organization context. Please login again.');
      }

      const localId = uuidv4();
      const recordData = {
        ...data,
        organization_id: orgId || data.organization_id, // Use provided org_id or current user's org
        needs_sync: skipSync ? 0 : 1,
        is_synced: skipSync ? 1 : 0, // Add is_synced flag for offline-first sync
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const insertId = await databaseService.insert(tableName, recordData);

      // Add to sync queue if not skipping sync
      if (!skipSync) {
        try {
          await this.addToSyncQueue(tableName, 'CREATE', localId, null, recordData);
        } catch (syncError) {
          console.warn(`Failed to add to sync queue for ${tableName}:`, syncError);
          // Continue execution - sync queue is not critical for local storage
        }
      }

      return { id: insertId, localId, ...recordData };
    } catch (error) {
      console.error(`Error creating ${tableName}:`, error);

      // Attempt recovery on database errors
      if (error.message.includes('no such table') || error.message.includes('database')) {
        console.log('Attempting database recovery...');
        try {
          await databaseService.emergencyRecovery();
          // Retry the operation
          const insertId = await databaseService.insert(tableName, recordData);
          return { id: insertId, localId: uuidv4(), ...recordData };
        } catch (recoveryError) {
          console.error('Recovery failed:', recoveryError);
        }
      }

      throw error;
    }
  }

  async update(tableName, id, data, skipSync = false) {
    try {
      const updateData = {
        ...data,
        needs_sync: skipSync ? 0 : 1,
        updated_at: new Date().toISOString()
      };

      const changes = await databaseService.update(
        tableName,
        updateData,
        'id = ?',
        [id]
      );

      if (changes > 0 && !skipSync) {
        // Get the record to add to sync queue
        const record = await this.getById(tableName, id);
        if (record) {
          await this.addToSyncQueue(tableName, 'UPDATE', id, record.server_id, record);
        }
      }

      return changes;
    } catch (error) {
      console.error(`Error updating ${tableName}:`, error);
      throw error;
    }
  }

  async delete(tableName, id, skipSync = false) {
    try {
      // Get the record first for sync queue
      const record = await this.getById(tableName, id);

      if (!record) {
        throw new Error('Record not found');
      }

      // Soft delete
      const changes = await databaseService.softDelete(tableName, id);

      if (changes > 0 && !skipSync) {
        await this.addToSyncQueue(tableName, 'DELETE', id, record.server_id, record);
      }

      return changes;
    } catch (error) {
      console.error(`Error deleting ${tableName}:`, error);
      throw error;
    }
  }

  async hardDelete(tableName, id) {
    try {
      return await databaseService.delete(tableName, 'id = ?', [id]);
    } catch (error) {
      console.error(`Error hard deleting ${tableName}:`, error);
      throw error;
    }
  }

  // Read operations

  async getAll(tableName, includeDeleted = false) {
    try {
      // EMERGENCY FIX: Don't retry database init - just return empty
      if (!databaseService || !databaseService.db || !databaseService.isReady) {
        return []; // SAFE FALLBACK - return empty array without retry
      }

      // MULTI-TENANT FIX: Add organization filter
      const orgId = await this.getCurrentOrganizationId();

      let whereClause = includeDeleted ? '' : 'is_deleted = 0';
      let whereValues = includeDeleted ? [] : [0];

      // Add organization filter if we have an orgId and table has organization_id column
      if (orgId && tableName !== 'organizations' && tableName !== 'sync_queue') {
        if (whereClause) {
          whereClause += ' AND organization_id = ?';
          whereValues.push(orgId);
        } else {
          whereClause = 'organization_id = ?';
          whereValues = [orgId];
        }
      }

      return await databaseService.select(
        tableName,
        '*',
        whereClause,
        whereValues,
        'created_at DESC'
      );
    } catch (error) {
      console.error(`Error getting all ${tableName}:`, error);
      // CRASH FIX: Return empty array instead of throwing
      return [];
    }
  }

  async getById(tableName, id) {
    try {
      // EMERGENCY FIX: Don't retry database init - just return null
      if (!databaseService || !databaseService.db || !databaseService.isReady) {
        return null; // SAFE FALLBACK - return null without retry
      }

      return await databaseService.selectOne(
        tableName,
        '*',
        'id = ? AND is_deleted = 0',
        [id]
      );
    } catch (error) {
      console.error(`Error getting ${tableName} by id:`, error);
      // CRASH FIX: Return null instead of throwing
      return null;
    }
  }

  async getByServerId(tableName, serverId) {
    try {
      // EMERGENCY FIX: Don't retry database init - just return null
      if (!databaseService || !databaseService.db || !databaseService.isReady) {
        return null; // SAFE FALLBACK - return null without retry
      }

      return await databaseService.selectOne(
        tableName,
        '*',
        'server_id = ? AND is_deleted = 0',
        [serverId]
      );
    } catch (error) {
      console.error(`Error getting ${tableName} by server id:`, error);
      // CRASH FIX: Return null instead of throwing
      return null;
    }
  }

  async getWhere(tableName, whereClause, whereValues = [], includeDeleted = false) {
    try {
      // EMERGENCY FIX: Don't retry database init - just return empty
      if (!databaseService || !databaseService.db || !databaseService.isReady) {
        return []; // SAFE FALLBACK - return empty array without retry
      }

      // MULTI-TENANT FIX: Add organization filter
      const orgId = await this.getCurrentOrganizationId();

      let fullWhereClause = includeDeleted
        ? whereClause
        : whereClause ? `${whereClause} AND is_deleted = 0` : 'is_deleted = 0';

      let fullWhereValues = includeDeleted ? whereValues : [...whereValues, 0];

      // Add organization filter if we have an orgId
      if (orgId && tableName !== 'organizations' && tableName !== 'sync_queue') {
        if (fullWhereClause) {
          fullWhereClause += ' AND organization_id = ?';
          fullWhereValues.push(orgId);
        } else {
          fullWhereClause = 'organization_id = ?';
          fullWhereValues = [orgId];
        }
      }

      return await databaseService.select(
        tableName,
        '*',
        fullWhereClause,
        fullWhereValues,
        'created_at DESC'
      );
    } catch (error) {
      console.error(`Error getting ${tableName} where:`, error);
      // CRASH FIX: Return empty array instead of throwing
      return [];
    }
  }

  async count(tableName, whereClause = '', whereValues = []) {
    try {
      // CRITICAL FIX: Check database initialization WITHOUT triggering re-init
      // This prevents infinite retry loops that cause 600+ counter issues
      if (!databaseService || !databaseService.db || !databaseService.isReady) {
        console.warn(`Database not initialized for count operation on ${tableName} - returning 0`);
        return 0; // SAFE FALLBACK - DON'T attempt re-initialization
      }

      // MULTI-TENANT FIX: Add organization filter
      const orgId = await this.getCurrentOrganizationId();

      let fullWhereClause = whereClause
        ? `${whereClause} AND is_deleted = 0`
        : 'is_deleted = 0';
      let fullWhereValues = [...whereValues, 0];

      // Add organization filter if we have an orgId
      if (orgId && tableName !== 'organizations' && tableName !== 'sync_queue') {
        fullWhereClause += ' AND organization_id = ?';
        fullWhereValues.push(orgId);
      }

      return await databaseService.count(tableName, fullWhereClause, fullWhereValues);
    } catch (error) {
      console.error(`Error counting ${tableName}:`, error);
      // CRASH FIX: Return 0 instead of throwing to prevent app crashes
      return 0;
    }
  }

  // Sync queue management

  async addToSyncQueue(tableName, operation, localId, serverId = null, data = null) {
    try {
      const queueData = {
        local_id: localId,
        server_id: serverId,
        table_name: tableName,
        operation,
        data: JSON.stringify(data),
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return await databaseService.insert('sync_queue', queueData);
    } catch (error) {
      console.error('Error adding to sync queue:', error);
      throw error;
    }
  }

  async getSyncQueue(status = null, limit = null) {
    try {
      let whereClause = '';
      let whereValues = [];

      if (status) {
        whereClause = 'sync_status = ?';
        whereValues = [status];
      }

      let orderBy = 'created_at ASC';
      if (limit) {
        orderBy += ` LIMIT ${limit}`;
      }

      return await databaseService.select('sync_queue', '*', whereClause, whereValues, orderBy);
    } catch (error) {
      console.error('Error getting sync queue:', error);
      throw error;
    }
  }

  async updateSyncQueueStatus(id, status, errorMessage = null) {
    try {
      const updateData = {
        sync_status: status,
        updated_at: new Date().toISOString()
      };

      if (errorMessage) {
        updateData.error_message = errorMessage;
        updateData.retry_count = await this.incrementRetryCount(id);
      }

      return await databaseService.update('sync_queue', updateData, 'id = ?', [id]);
    } catch (error) {
      console.error('Error updating sync queue status:', error);
      throw error;
    }
  }

  async incrementRetryCount(queueId) {
    try {
      const current = await databaseService.selectOne('sync_queue', 'retry_count', 'id = ?', [queueId]);
      const newCount = (current?.retry_count || 0) + 1;
      return newCount;
    } catch (error) {
      console.error('Error incrementing retry count:', error);
      return 1;
    }
  }

  async removeSyncQueueItem(id) {
    try {
      return await databaseService.delete('sync_queue', 'id = ?', [id]);
    } catch (error) {
      console.error('Error removing sync queue item:', error);
      throw error;
    }
  }

  // Records that need syncing

  async getRecordsNeedingSync(tableName) {
    try {
      return await databaseService.select(
        tableName,
        '*',
        'needs_sync = 1',
        [1],
        'updated_at ASC'
      );
    } catch (error) {
      console.error(`Error getting records needing sync from ${tableName}:`, error);
      throw error;
    }
  }

  async getUnsyncedRecords(tableName) {
    try {
      // EMERGENCY FIX: Check if database is initialized
      if (!databaseService || !databaseService.db || !databaseService.isReady) {
        console.warn(`Database not initialized for getUnsyncedRecords on ${tableName}`);
        return [];
      }

      return await databaseService.select(
        tableName,
        '*',
        'is_synced = 0 AND is_deleted = 0',
        [0, 0],
        'created_at ASC'
      );
    } catch (error) {
      console.error(`Error getting unsynced records from ${tableName}:`, error);
      // Return empty array instead of throwing
      return [];
    }
  }

  async markAsSynced(tableName, localId, serverId = null) {
    try {
      const updateData = {
        needs_sync: 0,
        updated_at: new Date().toISOString() // Use updated_at which exists in all tables
      };

      if (serverId) {
        updateData.server_id = serverId;
      }

      return await databaseService.update(tableName, updateData, 'id = ?', [localId]);
    } catch (error) {
      console.error(`Error marking ${tableName} as synced:`, error);
      // Don't throw - just log the error to prevent sync from failing completely
      console.warn(`⚠️ Non-critical: Failed to mark ${tableName} ${localId} as synced`);
      return 0;
    }
  }

  // Specific entity operations

  // Organizations
  async createOrganization(data) {
    return await this.create('organizations', data);
  }

  async getOrganizations() {
    return await this.getAll('organizations');
  }

  async updateOrganization(id, data) {
    return await this.update('organizations', id, data);
  }

  // Users
  async createUser(data, skipSync = false) {
    return await this.create('users', data, skipSync);
  }

  async getUsers() {
    return await this.getAll('users');
  }

  async getUserByEmail(email) {
    try {
      // EMERGENCY FIX: Don't retry database init
      if (!databaseService.isReady) {
        return null; // Return null instead of retrying
      }

      return await databaseService.selectOne(
        'users',
        '*',
        'email = ? AND is_deleted = 0',
        [email]
      );
    } catch (error) {
      console.error(`Error getting user by email ${email}:`, error);

      // For critical user lookup, attempt recovery
      if (error.message.includes('no such table') || error.message.includes('database')) {
        try {
          console.log('Attempting database recovery for user lookup...');
          await databaseService.emergencyRecovery();
          return await databaseService.selectOne(
            'users',
            '*',
            'email = ? AND is_deleted = 0',
            [email]
          );
        } catch (recoveryError) {
          console.error('User lookup recovery failed:', recoveryError);
        }
      }

      // Return null instead of throwing for user lookups
      return null;
    }
  }

  async updateUser(id, data, skipSync = false) {
    return await this.update('users', id, data, skipSync);
  }

  // Farms
  async createFarm(data, skipSync = false) {
    return await this.create('farms', data, skipSync);
  }

  async getFarms() {
    return await this.getAll('farms');
  }

  async getFarmsByOrganization(organizationId) {
    return await this.getWhere('farms', 'organization_id = ?', [organizationId]);
  }

  async updateFarm(id, data) {
    return await this.update('farms', id, data);
  }

  async deleteFarm(id) {
    return await this.delete('farms', id);
  }

  // Poultry Batches
  async createBatch(data, skipSync = false) {
    return await this.create('poultry_batches', data, skipSync);
  }

  async getBatches() {
    return await this.getAll('poultry_batches');
  }

  async getBatchesByFarm(farmId) {
    return await this.getWhere('poultry_batches', 'farm_id = ?', [farmId]);
  }

  async updateBatch(id, data) {
    return await this.update('poultry_batches', id, data);
  }

  async deleteBatch(id) {
    return await this.delete('poultry_batches', id);
  }

  // Feed Records
  async createFeedRecord(data, skipSync = false) {
    return await this.create('feed_records', data, skipSync);
  }

  async getFeedRecords() {
    return await this.getAll('feed_records');
  }

  async getFeedRecordsByBatch(batchId) {
    return await this.getWhere('feed_records', 'batch_id = ?', [batchId]);
  }

  async updateFeedRecord(id, data) {
    return await this.update('feed_records', id, data);
  }

  async deleteFeedRecord(id) {
    return await this.delete('feed_records', id);
  }

  // Production Records
  async createProductionRecord(data, skipSync = false) {
    return await this.create('production_records', data, skipSync);
  }

  async getProductionRecords() {
    return await this.getAll('production_records');
  }

  async getProductionRecordsByBatch(batchId) {
    return await this.getWhere('production_records', 'batch_id = ?', [batchId]);
  }

  async updateProductionRecord(id, data) {
    return await this.update('production_records', id, data);
  }

  async deleteProductionRecord(id) {
    return await this.delete('production_records', id);
  }

  // Mortality Records
  async createMortalityRecord(data, skipSync = false) {
    return await this.create('mortality_records', data, skipSync);
  }

  async getMortalityRecords() {
    return await this.getAll('mortality_records');
  }

  async getMortalityRecordsByBatch(batchId) {
    return await this.getWhere('mortality_records', 'batch_id = ?', [batchId]);
  }

  async updateMortalityRecord(id, data) {
    return await this.update('mortality_records', id, data);
  }

  async deleteMortalityRecord(id) {
    return await this.delete('mortality_records', id);
  }

  // Health Records
  async createHealthRecord(data, skipSync = false) {
    return await this.create('health_records', data, skipSync);
  }

  async getHealthRecords() {
    return await this.getAll('health_records');
  }

  async getHealthRecordsByBatch(batchId) {
    return await this.getWhere('health_records', 'batch_id = ?', [batchId]);
  }

  async updateHealthRecord(id, data) {
    return await this.update('health_records', id, data);
  }

  async deleteHealthRecord(id) {
    return await this.delete('health_records', id);
  }

  // Water Records CRUD
  async createWaterRecord(data, skipSync = false) {
    return await this.create('water_records', data, skipSync);
  }

  async getWaterRecords() {
    return await this.getAll('water_records');
  }

  async getWaterRecordsByBatch(batchId) {
    return await this.getWhere('water_records', 'batch_id = ?', [batchId]);
  }

  async updateWaterRecord(id, data) {
    return await this.update('water_records', id, data);
  }

  async deleteWaterRecord(id) {
    return await this.delete('water_records', id);
  }

  // Weight Records CRUD
  async createWeightRecord(data, skipSync = false) {
    return await this.create('weight_records', data, skipSync);
  }

  async getWeightRecords() {
    return await this.getAll('weight_records');
  }

  async getWeightRecordsByBatch(batchId) {
    return await this.getWhere('weight_records', 'batch_id = ?', [batchId]);
  }

  async updateWeightRecord(id, data) {
    return await this.update('weight_records', id, data);
  }

  async deleteWeightRecord(id) {
    return await this.delete('weight_records', id);
  }

  // Dashboard data
  async getDashboardData() {
    try {
      // EMERGENCY FIX: Don't retry database init
      if (!databaseService.isReady) {
        return null; // Return null instead of retrying
      }

      const farmsCount = await this.count('farms');
      const batchesCount = await this.count('poultry_batches', 'status = ?', ['active']);
      const totalBirds = await this.getTotalBirds();
      const recentMortality = await this.getRecentMortality();
      const todayProduction = await this.getTodayProduction();

      return {
        farms: farmsCount || 0,
        activeBatches: batchesCount || 0,
        totalBirds: totalBirds || 0,
        recentMortality: recentMortality || 0,
        todayProduction: todayProduction || 0
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);

      // Return safe defaults instead of throwing
      return {
        farms: 0,
        activeBatches: 0,
        totalBirds: 0,
        recentMortality: 0,
        todayProduction: 0,
        error: error.message
      };
    }
  }

  async getTotalBirds() {
    try {
      if (!databaseService?.db || !databaseService?.isReady) {
        console.warn('Database not initialized for getTotalBirds');
        try {
          await databaseService.init();
        } catch (initError) {
          console.error('Failed to initialize database for getTotalBirds:', initError);
          return 0;
        }
      }

      if (!databaseService.db || !databaseService.db.getFirstSync) {
        console.warn('Database connection not available for getTotalBirds');
        return 0;
      }

      const result = databaseService.db.getFirstSync(`
        SELECT SUM(current_count) as total
        FROM poultry_batches
        WHERE status = 'active' AND is_deleted = 0
      `);
      return result?.total || 0;
    } catch (error) {
      console.error('Error getting total birds:', error);

      // EMERGENCY FIX: Removed recovery retry to stop spam
      /* DISABLED - was causing 120+ errors */
      /*
      try {
        await databaseService.emergencyRecovery();
        if (databaseService.db && databaseService.db.getFirstSync) {
          const result = databaseService.db.getFirstSync(`
            SELECT SUM(current_count) as total
            FROM poultry_batches
            WHERE status = 'active' AND is_deleted = 0
          `);
          return result?.total || 0;
        }
      } catch (recoveryError) {
        console.error('Recovery failed for getTotalBirds:', recoveryError);
      }
      */
      return 0;
    }
  }

  async getRecentMortality() {
    try {
      if (!databaseService?.db || !databaseService?.isReady) {
        console.warn('Database not initialized for getRecentMortality');
        try {
          await databaseService.init();
        } catch (initError) {
          console.error('Failed to initialize database for getRecentMortality:', initError);
          return 0;
        }
      }

      if (!databaseService.db || !databaseService.db.getFirstSync) {
        console.warn('Database connection not available for getRecentMortality');
        return 0;
      }

      const result = databaseService.db.getFirstSync(`
        SELECT SUM(count) as total
        FROM mortality_records
        WHERE date >= date('now', '-7 days') AND is_deleted = 0
      `);
      return result?.total || 0;
    } catch (error) {
      console.error('Error getting recent mortality:', error);

      // EMERGENCY FIX: Removed recovery retry to stop spam
      /* DISABLED - was causing 120+ errors */
      /*
      try {
        await databaseService.emergencyRecovery();
        if (databaseService.db && databaseService.db.getFirstSync) {
          const result = databaseService.db.getFirstSync(`
            SELECT SUM(count) as total
            FROM mortality_records
            WHERE date >= date('now', '-7 days') AND is_deleted = 0
          `);
          return result?.total || 0;
        }
      } catch (recoveryError) {
        console.error('Recovery failed for getRecentMortality:', recoveryError);
      }
      */
      return 0;
    }
  }

  async getTodayProduction() {
    try {
      if (!databaseService?.db || !databaseService?.isReady) {
        console.warn('Database not initialized for getTodayProduction');
        try {
          await databaseService.init();
        } catch (initError) {
          console.error('Failed to initialize database for getTodayProduction:', initError);
          return 0;
        }
      }

      if (!databaseService.db || !databaseService.db.getFirstSync) {
        console.warn('Database connection not available for getTodayProduction');
        return 0;
      }

      const result = databaseService.db.getFirstSync(`
        SELECT SUM(eggs_collected) as total
        FROM production_records
        WHERE date = date('now') AND is_deleted = 0
      `);
      return result?.total || 0;
    } catch (error) {
      console.error('Error getting today production:', error);

      // EMERGENCY FIX: Removed recovery retry to stop spam
      /* DISABLED - was causing 120+ errors */
      /*
      try {
        await databaseService.emergencyRecovery();
        if (databaseService.db && databaseService.db.getFirstSync) {
          const result = databaseService.db.getFirstSync(`
            SELECT SUM(eggs_collected) as total
            FROM production_records
            WHERE date = date('now') AND is_deleted = 0
          `);
          return result?.total || 0;
        }
      } catch (recoveryError) {
        console.error('Recovery failed for getTodayProduction:', recoveryError);
      }
      */
      return 0;
    }
  }

  // Data integrity and cleanup

  async cleanupSyncQueue() {
    try {
      // Remove successfully synced items older than 7 days
      await databaseService.delete(
        'sync_queue',
        "sync_status = 'synced' AND created_at < datetime('now', '-7 days')"
      );

      // Remove failed items with high retry count and older than 24 hours
      await databaseService.delete(
        'sync_queue',
        "sync_status = 'failed' AND retry_count > 5 AND created_at < datetime('now', '-24 hours')"
      );

      console.log('Sync queue cleanup completed');
    } catch (error) {
      console.error('Error cleaning up sync queue:', error);
      throw error;
    }
  }

  async validateData() {
    try {
      if (!databaseService?.db || !databaseService?.isReady) {
        console.log('Database not initialized for validation, initializing...');
        try {
          await databaseService.init();
        } catch (initError) {
          console.error('Failed to initialize database for validation:', initError);
          return this.getValidationError('Database initialization failed');
        }
      }

      if (!databaseService.db || !databaseService.db.getAllSync) {
        console.warn('Database connection not available for validation');
        return this.getValidationError('Database connection unavailable');
      }

      let orphanedBatches = [];
      let duplicateUsers = [];
      let missingDemoUsers = [];

      // Check for orphaned records with error handling
      try {
        orphanedBatches = databaseService.db.getAllSync(`
          SELECT pb.id, pb.batch_name
          FROM poultry_batches pb
          LEFT JOIN farms f ON pb.farm_id = f.id
          WHERE f.id IS NULL AND pb.is_deleted = 0
        `) || [];

        if (orphanedBatches.length > 0) {
          console.warn('Found orphaned batches:', orphanedBatches);
        }
      } catch (error) {
        console.warn('Error checking orphaned batches:', error.message);
      }

      // Check for duplicate users with error handling
      try {
        duplicateUsers = databaseService.db.getAllSync(`
          SELECT email, COUNT(*) as count
          FROM users
          WHERE is_deleted = 0
          GROUP BY email
          HAVING count > 1
        `) || [];

        if (duplicateUsers.length > 0) {
          console.warn('Found duplicate users:', duplicateUsers);
        }
      } catch (error) {
        console.warn('Error checking duplicate users:', error.message);
      }

      // Check for missing demo users with error handling
      try {
        const demoUsers = ['demo@poultry360.com', 'owner@poultry360.com', 'admin@poultry360.com'];

        for (const email of demoUsers) {
          try {
            const user = await this.getUserByEmail(email);
            if (!user) {
              missingDemoUsers.push(email);
            }
          } catch (userError) {
            console.warn(`Error checking demo user ${email}:`, userError.message);
            missingDemoUsers.push(email);
          }
        }
      } catch (error) {
        console.warn('Error checking demo users:', error.message);
      }

      return {
        orphanedBatches: orphanedBatches.length,
        duplicateUsers: duplicateUsers.length,
        missingDemoUsers: missingDemoUsers.length,
        isValid: orphanedBatches.length === 0 && duplicateUsers.length === 0 && missingDemoUsers.length === 0,
        warnings: [
          ...(orphanedBatches.length > 0 ? [`${orphanedBatches.length} orphaned batches found`] : []),
          ...(duplicateUsers.length > 0 ? [`${duplicateUsers.length} duplicate user emails found`] : []),
          ...(missingDemoUsers.length > 0 ? [`Missing demo users: ${missingDemoUsers.join(', ')}`] : [])
        ],
        details: {
          orphanedBatches,
          duplicateUsers,
          missingDemoUsers
        }
      };
    } catch (error) {
      console.error('Error validating data:', error);
      return this.getValidationError(error.message);
    }
  }

  // Helper method for validation errors
  getValidationError(errorMessage) {
    return {
      orphanedBatches: 0,
      duplicateUsers: 0,
      missingDemoUsers: 0,
      isValid: false,
      warnings: [`Validation failed: ${errorMessage}`],
      error: errorMessage
    };
  }

  // ==================== ANALYTICS CACHING ====================

  /**
   * Generate cache key from analytics type and parameters
   */
  _generateAnalyticsCacheKey(type, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return `${type}_${sortedParams}`;
  }

  /**
   * Cache dashboard data (for offline access)
   */
  async cacheDashboard(dashboardData) {
    try {
      await AsyncStorage.setItem(
        '@dashboard_cache',
        JSON.stringify({
          data: dashboardData,
          timestamp: Date.now(),
        })
      );
      console.log('[OfflineDataService] Dashboard data cached');
    } catch (error) {
      console.error('[OfflineDataService] Failed to cache dashboard:', error);
    }
  }

  /**
   * Get cached dashboard data
   */
  async getCachedDashboard() {
    try {
      const cached = await AsyncStorage.getItem('@dashboard_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache is valid for 1 hour
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          console.log('[OfflineDataService] Using cached dashboard data');
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('[OfflineDataService] Failed to get cached dashboard:', error);
      return null;
    }
  }

  /**
   * Cache analytics data (production trends, flock performance, financial, etc.)
   */
  async cacheAnalytics(type, params, analyticsData) {
    try {
      const cacheKey = this._generateAnalyticsCacheKey(type, params);
      await AsyncStorage.setItem(
        `@analytics_${cacheKey}`,
        JSON.stringify({
          data: analyticsData,
          timestamp: Date.now(),
          type,
          params,
        })
      );
      console.log(`[OfflineDataService] Analytics data cached: ${type}`);
    } catch (error) {
      console.error(`[OfflineDataService] Failed to cache analytics ${type}:`, error);
    }
  }

  /**
   * Get cached analytics data
   */
  async getCachedAnalytics(type, params = {}) {
    try {
      const cacheKey = this._generateAnalyticsCacheKey(type, params);
      const cached = await AsyncStorage.getItem(`@analytics_${cacheKey}`);

      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache is valid for 30 minutes
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          console.log(`[OfflineDataService] Using cached analytics data: ${type}`);
          return data;
        } else {
          console.log(`[OfflineDataService] Analytics cache expired: ${type}`);
        }
      }

      // If no valid cache, return computed analytics from local data
      return await this._computeAnalyticsFromLocalData(type, params);
    } catch (error) {
      console.error(`[OfflineDataService] Failed to get cached analytics ${type}:`, error);
      return null;
    }
  }

  /**
   * Compute analytics from local SQLite data when no cache is available
   * This ensures analytics work even without internet connection
   */
  async _computeAnalyticsFromLocalData(type, params = {}) {
    try {
      console.log(`[OfflineDataService] Computing analytics from local data: ${type}`);

      switch (type) {
        case 'analytics':
        case 'dashboard':
          return await this._computeDashboardAnalytics(params);

        case 'trends':
          return await this._computeTrends(params);

        case 'flockPerformance':
          return await this._computeFlockPerformance(params);

        case 'financial':
          return await this._computeFinancialAnalytics(params);

        default:
          console.warn(`[OfflineDataService] Unknown analytics type: ${type}`);
          return null;
      }
    } catch (error) {
      console.error(`[OfflineDataService] Failed to compute analytics from local data:`, error);
      return null;
    }
  }

  /**
   * Compute dashboard analytics from local production and batch data
   */
  async _computeDashboardAnalytics(params = {}) {
    try {
      const batches = await this.getBatches();
      const productionRecords = await this.getProductionRecords();

      // Calculate production rate by batch
      const productionRateByBatch = batches.map(batch => {
        const batchProduction = productionRecords
          .filter(r => r.batch_id === batch.id)
          .reduce((sum, r) => sum + (r.eggs_collected || 0), 0);

        const productionRate = batch.current_count > 0
          ? (batchProduction / batch.current_count) * 100
          : 0;

        return {
          batchId: batch.id,
          batchName: batch.batch_name,
          currentCount: batch.current_count || 0,
          totalEggs: batchProduction,
          productionRate: Math.round(productionRate * 10) / 10,
        };
      });

      // Calculate daily production for last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyProduction = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        const totalEggs = productionRecords
          .filter(r => r.date && r.date.startsWith(dateStr))
          .reduce((sum, r) => sum + (r.eggs_collected || 0), 0);

        dailyProduction.push({
          date: dateStr,
          totalEggs,
        });
      }

      // Calculate weekly comparison
      const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const thisWeekEggs = productionRecords
        .filter(r => new Date(r.date) >= thisWeekStart)
        .reduce((sum, r) => sum + (r.eggs_collected || 0), 0);

      const lastWeekEggs = productionRecords
        .filter(r => {
          const recordDate = new Date(r.date);
          return recordDate >= lastWeekStart && recordDate < thisWeekStart;
        })
        .reduce((sum, r) => sum + (r.eggs_collected || 0), 0);

      const percentageChange = lastWeekEggs > 0
        ? ((thisWeekEggs - lastWeekEggs) / lastWeekEggs) * 100
        : 0;

      return {
        productionRateByBatch,
        dailyProduction,
        weeklyComparison: {
          currentWeek: { totalEggs: thisWeekEggs },
          previousWeek: { totalEggs: lastWeekEggs },
          percentageChange: Math.round(percentageChange * 10) / 10,
        },
      };
    } catch (error) {
      console.error('[OfflineDataService] Error computing dashboard analytics:', error);
      return null;
    }
  }

  /**
   * Compute trends from local data
   */
  async _computeTrends(params = {}) {
    try {
      // Return empty trends for now (can be enhanced later)
      return {
        labels: [],
        values: [],
        trend: 'stable',
        percentageChange: 0,
      };
    } catch (error) {
      console.error('[OfflineDataService] Error computing trends:', error);
      return null;
    }
  }

  /**
   * Compute flock performance from local data
   */
  async _computeFlockPerformance(params = {}) {
    try {
      const batches = await this.getBatches();
      const mortalityRecords = await this.getMortalityRecords();
      const feedRecords = await this.getFeedRecords();

      const flocks = batches.map(batch => {
        const mortality = mortalityRecords
          .filter(r => r.batch_id === batch.id)
          .reduce((sum, r) => sum + (r.count || 0), 0);

        const mortalityRate = batch.initial_count > 0
          ? (mortality / batch.initial_count) * 100
          : 0;

        const totalFeed = feedRecords
          .filter(r => r.batch_id === batch.id)
          .reduce((sum, r) => sum + (r.quantity || 0), 0);

        const fcr = batch.current_count > 0
          ? totalFeed / batch.current_count
          : 0;

        return {
          name: batch.batch_name,
          performance: batch.current_count > 0 ? 100 : 0,
          fcr: Math.round(fcr * 100) / 100,
          mortality: Math.round(mortalityRate * 10) / 10,
          growth: 0, // Can be calculated from weight records
        };
      });

      const avgFCR = flocks.length > 0
        ? flocks.reduce((sum, f) => sum + f.fcr, 0) / flocks.length
        : 0;

      const avgMortality = flocks.length > 0
        ? flocks.reduce((sum, f) => sum + f.mortality, 0) / flocks.length
        : 0;

      return {
        flocks,
        averageFCR: Math.round(avgFCR * 100) / 100,
        averageMortality: Math.round(avgMortality * 10) / 10,
      };
    } catch (error) {
      console.error('[OfflineDataService] Error computing flock performance:', error);
      return null;
    }
  }

  /**
   * Compute financial analytics from local data
   */
  async _computeFinancialAnalytics(params = {}) {
    try {
      // Return empty financial data for now (requires expenses and sales tables)
      return {
        revenue: 0,
        expenses: 0,
        profit: 0,
        profitMargin: 0,
        roi: 0,
        breakdown: {
          feed: 0,
          labor: 0,
          utilities: 0,
          other: 0,
        },
      };
    } catch (error) {
      console.error('[OfflineDataService] Error computing financial analytics:', error);
      return null;
    }
  }

  /**
   * Clear all analytics cache
   */
  async clearAnalyticsCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const analyticsKeys = keys.filter(key => key.startsWith('@analytics_') || key === '@dashboard_cache');
      await AsyncStorage.multiRemove(analyticsKeys);
      console.log('[OfflineDataService] Analytics cache cleared');
    } catch (error) {
      console.error('[OfflineDataService] Failed to clear analytics cache:', error);
    }
  }

  // Export/Import for backup
  async exportData() {
    try {
      const data = {};
      const tables = Object.keys(this.tableConfig);

      for (const table of tables) {
        data[table] = await this.getAll(table, true); // Include deleted for backup
      }

      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(data, clearExisting = false) {
    try {
      console.log('📥 Starting data import...');

      if (clearExisting) {
        console.log('🔄 Clearing existing data and resetting database...');
        await databaseService.resetDatabase();
        await this.init();
      }

      let imported = 0;
      let errors = 0;

      for (const [tableName, records] of Object.entries(data)) {
        if (this.tableConfig[tableName] && Array.isArray(records)) {
          console.log(`📊 Importing ${records.length} records to ${tableName}...`);

          for (const record of records) {
            try {
              await this.create(tableName, record, true); // Skip sync for imported data
              imported++;
            } catch (recordError) {
              console.error(`Error importing record to ${tableName}:`, recordError);
              errors++;
            }
          }
        }
      }

      console.log(`✅ Data import completed: ${imported} records imported, ${errors} errors`);

      return {
        success: true,
        imported,
        errors,
        message: `Import completed: ${imported} records imported${errors > 0 ? `, ${errors} errors` : ''}`
      };
    } catch (error) {
      console.error('Error importing data:', error);
      return {
        success: false,
        error: error.message,
        imported: 0,
        errors: 0
      };
    }
  }
}

// Export singleton instance
const offlineDataService = new OfflineDataService();

export default offlineDataService;