import AsyncStorage from '@react-native-async-storage/async-storage';
import fastDatabaseImport from './fastDatabase';
import dataEventBus, { EventTypes } from './dataEventBus';
import apiService from './api';
import networkService from './networkService';

// FIX: Handle both default and named exports from fastDatabase
const fastDatabase = fastDatabaseImport.default || fastDatabaseImport;

class FastApiService {
  constructor() {
    this.isReady = false;
  }

  /**
   * Convert camelCase API format to snake_case database format
   */
  convertToDbFormat(data) {
    const dbData = { ...data };

    // Convert common camelCase fields to snake_case
    if (dbData.farmId !== undefined) {
      dbData.farm_id = dbData.farmId;
      delete dbData.farmId;
    }
    if (dbData.batchId !== undefined) {
      dbData.batch_id = dbData.batchId;
      delete dbData.batchId;
    }

    return dbData;
  }

  // INSTANT initialization - no complex logic
  init() {
    try {
      console.log('🔄 FastApiService: Starting initialization...');

      // CRITICAL FIX: Initialize database synchronously with error checking
      const dbInitResult = fastDatabase.init();

      if (!dbInitResult) {
        console.error('❌ FastApiService: Database initialization returned false');
        console.warn('⚠️ FastApiService: Continuing without database - operations will fail');
        this.isReady = false;
        // Don't throw - allow app to continue without database
        return Promise.resolve(false);
      }

      if (!fastDatabase.db || !fastDatabase.isReady) {
        console.error('❌ FastApiService: Database connection is null or not ready');
        console.error('   - fastDatabase.db:', fastDatabase.db ? 'EXISTS' : 'NULL');
        console.error('   - fastDatabase.isReady:', fastDatabase.isReady);
        console.warn('⚠️ FastApiService: Continuing without database - operations will fail');
        this.isReady = false;
        // Don't throw - allow app to continue without database
        return Promise.resolve(false);
      }

      console.log('✅ FastApiService: Database initialized successfully');
      console.log('   - fastDatabase.db: VALID');
      console.log('   - fastDatabase.isReady: true');

      this.isReady = true;
      return Promise.resolve(true);
    } catch (error) {
      console.error('❌ FastApiService init failed with exception:', error);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      this.isReady = false;
      // Don't throw - allow app to continue without database
      console.warn('⚠️ FastApiService: Continuing without database - operations will fail');
      return Promise.resolve(false);
    }
  }

  // Authentication - simplified and fast with PASSWORD VALIDATION
  async login(email, password) {
    try {
      console.log(`🔄 FastApiService: Login attempt for ${email}`);

      // SECURITY FIX: Validate BOTH email AND password
      // Use validateUserCredentials which checks password_hash
      const user = fastDatabase.validateUserCredentials(email, password);

      if (!user) {
        console.warn(`❌ FastApiService: Login failed - invalid credentials for ${email}`);
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      console.log(`✅ FastApiService: Login successful for ${email} with role ${user.role}`);

      // Store user data
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      await AsyncStorage.setItem('authToken', 'offline_token');

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            organizationId: user.organization_id || 1,
            organizationName: user.organization_name || 'Demo Organization',
            organizationSlug: user.organization_slug || 'demo-org'
          },
          token: 'offline_token'
        },
        source: 'local'
      };
    } catch (error) {
      console.error('❌ FastApiService: Login error:', error);
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  async register(userData) {
    try {
      console.log(`🔄 FastApiService: Registration attempt for ${userData.email}`);

      // SECURITY FIX: Validate required fields
      if (!userData.email || !userData.password) {
        console.error('❌ FastApiService: Registration failed - email and password required');
        return {
          success: false,
          error: 'Email and password are required'
        };
      }

      // SECURITY FIX: Create user with hashed password in database
      const createdUser = fastDatabase.createUser(userData);

      if (!createdUser) {
        console.error('❌ FastApiService: Registration failed - user creation failed');
        return {
          success: false,
          error: 'Registration failed. Email may already be in use.'
        };
      }

      console.log(`✅ FastApiService: User registered successfully: ${userData.email}`);

      // Store user data
      await AsyncStorage.setItem('userData', JSON.stringify(createdUser));
      await AsyncStorage.setItem('authToken', 'offline_token');

      return {
        success: true,
        data: {
          user: {
            id: createdUser.id,
            email: createdUser.email,
            firstName: createdUser.first_name,
            lastName: createdUser.last_name,
            username: userData.username,
            phone: userData.phone,
            role: createdUser.role,
            organizationId: createdUser.organization_id,
            organizationName: createdUser.organization_name,
            organizationSlug: createdUser.organization_slug
          },
          token: 'offline_token'
        },
        source: 'local'
      };
    } catch (error) {
      console.error('❌ FastApiService: Registration error:', error);
      return {
        success: false,
        error: 'Registration failed'
      };
    }
  }

  async getProfile() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        return {
          success: true,
          data: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role
          },
          source: 'local'
        };
      }
      return { success: false, error: 'No user data found' };
    } catch (error) {
      return { success: false, error: 'Failed to get profile' };
    }
  }

  async updateProfile(profileData) {
    try {
      // Get current user data
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) {
        return { success: false, error: 'No user data found' };
      }

      const user = JSON.parse(userData);

      // Update user data
      const updatedUser = {
        ...user,
        first_name: profileData.firstName || user.first_name,
        last_name: profileData.lastName || user.last_name,
        phone: profileData.phone || user.phone
      };

      // Save to AsyncStorage
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));

      return {
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          role: updatedUser.role,
          phone: updatedUser.phone,
          createdAt: updatedUser.created_at,
          organizationId: updatedUser.organization_id
        },
        source: 'local'
      };
    } catch (error) {
      return { success: false, error: 'Failed to update profile' };
    }
  }

  async getDashboard() {
    try {
      console.log('🔄 FastApiService.getDashboard() called');
      const data = fastDatabase.getDashboardData();
      console.log('🔄 Dashboard data retrieved from fastDatabase');
      return {
        success: true,
        data,
        source: 'local'
      };
    } catch (error) {
      console.log('🔄 Dashboard data error in fastApiService:', error.message);
      return {
        success: true,
        data: {
          farms: 0,
          activeBatches: 0,
          totalBirds: 0,
          recentMortality: 0,
          todayProduction: 0,
          totalFarms: 0,
          totalFlocks: 0,
          eggsToday: 0,
          deathsToday: 0,
          myRecordsToday: 0,
          recentActivities: [],
          alerts: []
        },
        source: 'fallback'
      };
    }
  }

  async getFarms() {
    try {
      const farms = fastDatabase.getFarms();
      return {
        success: true,
        data: Array.isArray(farms) ? farms.map(farm => ({
          id: farm?.id || Date.now(),
          farmName: farm?.farm_name || 'Unknown Farm',
          name: farm?.farm_name || 'Unknown Farm',
          location: farm?.location || 'Unknown Location',
          farmType: farm?.farm_type || 'broiler',
          description: farm?.description || '',
          createdAt: farm?.created_at || new Date().toISOString()
        })) : [],
        source: 'local'
      };
    } catch (error) {
      console.warn('getFarms error:', error);
      return {
        success: true,
        data: [],
        source: 'fallback'
      };
    }
  }

  async getFlocks() {
    try {
      const batches = fastDatabase.getBatches();
      return {
        success: true,
        data: Array.isArray(batches) ? batches.map(batch => ({
          id: batch?.id || Date.now(),
          batchName: batch?.batch_name || 'Unknown Batch',
          name: batch?.batch_name || 'Unknown Batch',
          breed: batch?.breed || 'Unknown Breed',
          birdType: batch?.breed || 'Unknown Breed',
          initialCount: batch?.initial_count || 0,
          currentCount: batch?.current_count || 0,
          farmId: batch?.farm_id || 1,
          arrivalDate: batch?.arrival_date || batch?.created_at || new Date().toISOString(),
          startDate: batch?.arrival_date || batch?.created_at || new Date().toISOString(),
          status: batch?.status || 'active',
          createdAt: batch?.created_at || new Date().toISOString()
        })) : [],
        source: 'local'
      };
    } catch (error) {
      console.warn('getFlocks error:', error);
      return {
        success: true,
        data: [],
        source: 'fallback'
      };
    }
  }

  // REAL CRUD OPERATIONS FOR RECORDS - HYBRID (ONLINE → PostgreSQL, OFFLINE → SQLite)
  async createRecord(recordType, recordData) {
    try {
      console.log(`🔄 FastApiService.createRecord(${recordType}) called with data:`, recordData);

      // HYBRID APPROACH: Check network status
      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let result;
      let source;

      if (isOnline) {
        // ONLINE MODE: Save to PostgreSQL first, then cache in SQLite
        try {
          console.log(`🌐 ONLINE: Saving ${recordType} record to PostgreSQL backend...`);

          // CRITICAL FIX: Get the batch's server_id before creating records that reference batches
          let backendData = { ...recordData };

          if (recordData.batchId && (recordType === 'water' || recordType === 'weight')) {
            const batch = fastDatabase.getBatchById(recordData.batchId);

            if (!batch) {
              throw new Error(`Batch with ID ${recordData.batchId} not found in local database`);
            }

            if (!batch.server_id) {
              throw new Error(`Batch with ID ${recordData.batchId} not found or not accessible`);
            }

            console.log(`🔍 FastApiService: Found batch "${batch.batch_name}" with server_id: ${batch.server_id}`);

            // Use server_id instead of local id
            backendData = {
              ...recordData,
              batchId: batch.server_id
            };
          }

          let serverResponse;
          // Call appropriate API endpoint based on record type
          switch (recordType) {
            case 'feed':
              serverResponse = await apiService.createFeedRecord(recordData);
              break;
            case 'production':
              serverResponse = await apiService.createProductionRecord(recordData);
              break;
            case 'mortality':
              serverResponse = await apiService.createMortalityRecord(recordData);
              break;
            case 'health':
              serverResponse = await apiService.createHealthRecord(recordData);
              break;
            case 'water':
              serverResponse = await apiService.createWaterRecord(backendData);
              break;
            case 'weight':
              serverResponse = await apiService.createWeightRecord(backendData);
              break;
            case 'vaccination':
              serverResponse = await apiService.createVaccinationRecord(recordData);
              break;
            default:
              throw new Error(`Unsupported record type: ${recordType}`);
          }

          console.log(`✅ ${recordType} record saved to PostgreSQL:`, serverResponse);

          // Cache in SQLite with server ID
          const localData = this.convertToDbFormat({
            ...recordData,
            server_id: serverResponse.id,
            needs_sync: 0, // Already synced
            synced_at: new Date().toISOString()
          });

          result = fastDatabase.createRecord(recordType, localData);
          console.log(`✅ ${recordType} record cached in SQLite:`, result);

          source = 'server';
        } catch (onlineError) {
          // If online save fails, fall back to offline mode
          console.warn('⚠️  Online save failed, falling back to offline mode:', onlineError.message);

          const localData = this.convertToDbFormat({
            ...recordData,
            needs_sync: 1, // Mark for sync
            created_offline: true
          });

          result = fastDatabase.createRecord(recordType, localData);
          source = 'local_fallback';
        }
      } else {
        // OFFLINE MODE: Save to SQLite with needs_sync flag
        console.log(`📴 OFFLINE: Saving ${recordType} record to SQLite for later sync...`);

        const localData = this.convertToDbFormat({
          ...recordData,
          needs_sync: 1, // Mark for sync when online
          created_offline: true
        });

        result = fastDatabase.createRecord(recordType, localData);
        console.log(`✅ ${recordType} record saved to SQLite (will sync when online):`, result);
        source = 'local';
      }

      // CRITICAL FIX: Emit specific record event to trigger real-time updates
      const eventTypeMap = {
        feed: EventTypes.FEED_RECORD_CREATED,
        production: EventTypes.PRODUCTION_RECORD_CREATED,
        mortality: EventTypes.MORTALITY_RECORD_CREATED,
        health: EventTypes.HEALTH_RECORD_CREATED,
        water: EventTypes.WATER_RECORD_CREATED,
        weight: EventTypes.WEIGHT_RECORD_CREATED,
        vaccination: EventTypes.VACCINATION_CREATED
      };

      const eventType = eventTypeMap[recordType];
      if (eventType) {
        console.log(`✅ ${recordType} record created, emitting ${eventType} event`);
        dataEventBus.emit(eventType, {
          recordType,
          record: result,
          source
        });
      }

      return {
        success: true,
        data: result,
        source
      };
    } catch (error) {
      console.error(`❌ FastApiService.createRecord(${recordType}) failed:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getRecords(recordType) {
    try {
      const records = fastDatabase.getAllRecords(recordType);
      return {
        success: true,
        data: records || [],
        source: 'local'
      };
    } catch (error) {
      return {
        success: true,
        data: [],
        source: 'fallback'
      };
    }
  }

  async deleteRecord(recordType, recordId) {
    try {
      fastDatabase.deleteRecord(recordType, recordId);

      // CRITICAL FIX: Emit specific record deletion event to trigger real-time updates
      const eventTypeMap = {
        feed: EventTypes.FEED_RECORD_DELETED,
        production: EventTypes.PRODUCTION_RECORD_DELETED,
        mortality: EventTypes.MORTALITY_RECORD_DELETED,
        health: EventTypes.HEALTH_RECORD_DELETED,
        water: EventTypes.WATER_RECORD_DELETED,
        weight: EventTypes.WEIGHT_RECORD_DELETED
      };

      const eventType = eventTypeMap[recordType];
      if (eventType) {
        console.log(`✅ ${recordType} record deleted, emitting ${eventType} event`);
        dataEventBus.emit(eventType, {
          recordType,
          recordId,
          source: 'local'
        });
      }

      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // REAL FARM OPERATIONS - HYBRID (ONLINE → PostgreSQL, OFFLINE → SQLite)
  async createFarm(farmData) {
    try {
      console.log('🔄 FastApiService.createFarm() called with data:', farmData);

      // CRITICAL FIX: Check if database is ready before attempting to create farm
      if (!fastDatabase.db || !fastDatabase.isReady) {
        console.error('❌ FastApiService.createFarm(): Database not ready');
        console.error('   - fastDatabase.db:', fastDatabase.db ? 'EXISTS' : 'NULL');
        console.error('   - fastDatabase.isReady:', fastDatabase.isReady);

        // Try to initialize database one more time
        console.log('🔄 FastApiService: Attempting to initialize database...');
        const initResult = fastDatabase.init();

        if (!initResult || !fastDatabase.db || !fastDatabase.isReady) {
          throw new Error('Database is not available. Please restart the app.');
        }

        console.log('✅ FastApiService: Database initialized successfully on retry');
      }

      // HYBRID APPROACH: Check network status
      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let result;
      let source;

      if (isOnline) {
        // ONLINE MODE: Save to PostgreSQL first, then cache in SQLite
        try {
          console.log('🌐 ONLINE: Saving farm to PostgreSQL backend...');

          // Transform data to backend format
          const backendData = {
            farmName: farmData.name || farmData.farmName,
            location: farmData.location,
            farmType: farmData.farmType,
            description: farmData.description || ''
          };

          const serverResponse = await apiService.createFarm(backendData);
          console.log('✅ Farm saved to PostgreSQL:', serverResponse);

          // Cache in SQLite with server ID
          const localData = {
            ...farmData,
            server_id: serverResponse.id,
            needs_sync: 0, // Already synced
            synced_at: new Date().toISOString()
          };

          result = fastDatabase.createFarm(localData);
          console.log('✅ Farm cached in SQLite:', result);

          source = 'server';
        } catch (onlineError) {
          // If online save fails, fall back to offline mode
          console.warn('⚠️  Online save failed, falling back to offline mode:', onlineError.message);

          const localData = {
            ...farmData,
            needs_sync: 1, // Mark for sync
            created_offline: true
          };

          result = fastDatabase.createFarm(localData);
          source = 'local_fallback';
        }
      } else {
        // OFFLINE MODE: Save to SQLite with needs_sync flag
        console.log('📴 OFFLINE: Saving farm to SQLite for later sync...');

        const localData = {
          ...farmData,
          needs_sync: 1, // Mark for sync when online
          created_offline: true
        };

        result = fastDatabase.createFarm(localData);
        console.log('✅ Farm saved to SQLite (will sync when online):', result);
        source = 'local';
      }

      console.log('✅ FastApiService: Farm created successfully:', result);

      // CRITICAL FIX: Emit FARM_CREATED event to trigger dashboard refresh
      console.log('✅ Farm created, emitting FARM_CREATED event');
      dataEventBus.emit(EventTypes.FARM_CREATED, {
        farm: result,
        source
      });

      return {
        success: true,
        data: result,
        source
      };
    } catch (error) {
      console.error('❌ FastApiService.createFarm() failed:', error);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateFarm(farmId, farmData) {
    try {
      const result = fastDatabase.updateFarm(farmId, farmData);

      // CRITICAL FIX: Emit FARM_UPDATED event to trigger dashboard refresh
      console.log('✅ Farm updated, emitting FARM_UPDATED event');
      dataEventBus.emit(EventTypes.FARM_UPDATED, {
        farm: result,
        source: 'fastApiService'
      });

      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteFarm(farmId) {
    try {
      fastDatabase.deleteFarm(farmId);

      // CRITICAL FIX: Emit FARM_DELETED event to trigger dashboard refresh
      console.log('✅ Farm deleted, emitting FARM_DELETED event');
      dataEventBus.emit(EventTypes.FARM_DELETED, {
        farmId,
        source: 'fastApiService'
      });

      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // REAL FLOCK/BATCH OPERATIONS - HYBRID (ONLINE → PostgreSQL, OFFLINE → SQLite)
  async createFlock(flockData) {
    try {
      console.log('🔄 FastApiService.createFlock() called with data:', flockData);

      // HYBRID APPROACH: Check network status
      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let result;
      let source;

      if (isOnline) {
        // ONLINE MODE: Save to PostgreSQL first, then cache in SQLite
        try {
          console.log('🌐 ONLINE: Saving batch to PostgreSQL backend...');

          // CRITICAL FIX: Get the farm's server_id before creating batch
          const farm = fastDatabase.getFarmById(flockData.farmId);

          if (!farm) {
            throw new Error(`Farm with ID ${flockData.farmId} not found in local database`);
          }

          if (!farm.server_id) {
            throw new Error(`Farm with ID ${flockData.farmId} not found or not accessible`);
          }

          console.log(`🔍 FastApiService: Found farm "${farm.farm_name}" with server_id: ${farm.server_id}`);

          // Transform data to backend format with server_id
          const backendData = {
            batchName: flockData.name || flockData.batchName,
            farmId: farm.server_id, // Use server_id instead of local id
            birdType: flockData.birdType || flockData.breed,
            initialCount: flockData.initialCount,
            currentCount: flockData.currentCount || flockData.initialCount,
            arrivalDate: flockData.arrivalDate || flockData.startDate,
            status: flockData.status || 'active'
          };

          const serverResponse = await apiService.createFlock(backendData);
          console.log('✅ Batch saved to PostgreSQL:', serverResponse);

          // Cache in SQLite with server ID
          const localData = {
            ...flockData,
            server_id: serverResponse.id,
            needs_sync: 0, // Already synced
            synced_at: new Date().toISOString()
          };

          result = fastDatabase.createBatch(localData);
          console.log('✅ Batch cached in SQLite:', result);

          source = 'server';
        } catch (onlineError) {
          // If online save fails, fall back to offline mode
          console.warn('⚠️  Online save failed, falling back to offline mode:', onlineError.message);

          const localData = {
            ...flockData,
            needs_sync: 1, // Mark for sync
            created_offline: true
          };

          result = fastDatabase.createBatch(localData);
          source = 'local_fallback';
        }
      } else {
        // OFFLINE MODE: Save to SQLite with needs_sync flag
        console.log('📴 OFFLINE: Saving batch to SQLite for later sync...');

        const localData = {
          ...flockData,
          needs_sync: 1, // Mark for sync when online
          created_offline: true
        };

        result = fastDatabase.createBatch(localData);
        console.log('✅ Batch saved to SQLite (will sync when online):', result);
        source = 'local';
      }

      // CRITICAL FIX: Emit BATCH_CREATED event to trigger dashboard refresh
      console.log('✅ Batch created, emitting BATCH_CREATED event');
      dataEventBus.emit(EventTypes.BATCH_CREATED, {
        batch: result,
        source
      });

      return {
        success: true,
        data: result,
        source
      };
    } catch (error) {
      console.error('❌ FastApiService.createFlock() failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateFlock(flockId, flockData) {
    try {
      const result = fastDatabase.updateBatch(flockId, flockData);

      // CRITICAL FIX: Emit BATCH_UPDATED event to trigger dashboard refresh
      console.log('✅ Batch updated, emitting BATCH_UPDATED event');
      dataEventBus.emit(EventTypes.BATCH_UPDATED, {
        batch: result,
        source: 'fastApiService'
      });

      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteFlock(flockId) {
    try {
      fastDatabase.deleteBatch(flockId);

      // CRITICAL FIX: Emit BATCH_DELETED event to trigger dashboard refresh
      console.log('✅ Batch deleted, emitting BATCH_DELETED event');
      dataEventBus.emit(EventTypes.BATCH_DELETED, {
        batchId: flockId,
        source: 'fastApiService'
      });

      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // WATER RECORDS
  async createWaterRecord(recordData) {
    try {
      const result = fastDatabase.createWaterRecord(recordData);

      // CRITICAL FIX: Emit WATER_RECORD_CREATED event to trigger real-time analytics updates
      console.log('✅ Water record created, emitting WATER_RECORD_CREATED event');
      dataEventBus.emit(EventTypes.WATER_RECORD_CREATED, {
        recordType: 'water',
        record: result,
        source: 'local'
      });

      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWaterRecords(batchId = null) {
    try {
      const records = fastDatabase.getWaterRecords();
      // Filter by batchId if provided
      const filteredRecords = batchId ? records.filter(r => r.batch_id === batchId) : records;
      return {
        success: true,
        data: filteredRecords,
        waterRecords: filteredRecords,
        source: 'local'
      };
    } catch (error) {
      return {
        success: true,
        data: [],
        waterRecords: [],
        source: 'fallback'
      };
    }
  }

  async deleteWaterRecord(recordId) {
    try {
      fastDatabase.deleteWaterRecord(recordId);

      // CRITICAL FIX: Emit WATER_RECORD_DELETED event to trigger real-time analytics updates
      console.log('✅ Water record deleted, emitting WATER_RECORD_DELETED event');
      dataEventBus.emit(EventTypes.WATER_RECORD_DELETED, {
        recordType: 'water',
        recordId,
        source: 'local'
      });

      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // WEIGHT RECORDS
  async createWeightRecord(recordData) {
    try {
      const result = fastDatabase.createWeightRecord(recordData);

      // CRITICAL FIX: Emit WEIGHT_RECORD_CREATED event to trigger real-time analytics updates
      console.log('✅ Weight record created, emitting WEIGHT_RECORD_CREATED event');
      dataEventBus.emit(EventTypes.WEIGHT_RECORD_CREATED, {
        recordType: 'weight',
        record: result,
        source: 'local'
      });

      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWeightRecords(batchId = null) {
    try {
      const records = fastDatabase.getWeightRecords();
      // Filter by batchId if provided
      const filteredRecords = batchId ? records.filter(r => r.batch_id === batchId) : records;
      return {
        success: true,
        data: filteredRecords,
        weightRecords: filteredRecords,
        source: 'local'
      };
    } catch (error) {
      return {
        success: true,
        data: [],
        weightRecords: [],
        source: 'fallback'
      };
    }
  }

  async deleteWeightRecord(recordId) {
    try {
      fastDatabase.deleteWeightRecord(recordId);

      // CRITICAL FIX: Emit WEIGHT_RECORD_DELETED event to trigger real-time analytics updates
      console.log('✅ Weight record deleted, emitting WEIGHT_RECORD_DELETED event');
      dataEventBus.emit(EventTypes.WEIGHT_RECORD_DELETED, {
        recordType: 'weight',
        recordId,
        source: 'local'
      });

      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility methods
  isOnlineMode() {
    return false; // Always offline for simplicity
  }

  isOfflineMode() {
    return true; // Always offline for simplicity
  }

  getConnectionState() {
    return {
      isOnline: false,
      isOffline: true,
      networkState: { isConnected: false }
    };
  }

  async getStorageStats() {
    return {
      farms: 1,
      batches: 1,
      feedRecords: 0,
      productionRecords: 0,
      mortalityRecords: 0,
      healthRecords: 0,
      pendingSync: 0,
      failedSync: 0,
      total: 2
    };
  }

  // ANALYTICS METHODS - Real-time calculations from SQLite
  async getAnalytics(params = {}) {
    try {
      console.log('[FastApiService] getAnalytics() called with params:', params);

      // Use fastDatabase.getAnalyticsData() for comprehensive, real-time analytics
      const analyticsData = fastDatabase.getAnalyticsData(params);

      console.log('[FastApiService] Analytics data retrieved from fastDatabase');

      return {
        success: true,
        data: analyticsData,
        source: 'local'
      };
    } catch (error) {
      console.error('[FastApiService] getAnalytics() error:', error);
      return {
        success: true,
        data: fastDatabase.getEmptyAnalyticsData(),
        source: 'fallback'
      };
    }
  }
}

// Export singleton instance
const fastApiService = new FastApiService();
export default fastApiService;