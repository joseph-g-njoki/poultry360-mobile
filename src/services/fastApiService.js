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

      // SECURITY FIX: Validate that user has an organization_id
      // CRITICAL: Never allow login without organization association in multi-tenant system
      if (!user.organization_id) {
        console.error(`❌ FastApiService: Login failed - user ${email} has no organization_id`);
        return {
          success: false,
          error: 'User not associated with an organization. Please contact support.'
        };
      }

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
            organizationId: user.organization_id,
            organizationName: user.organization_name,
            organizationSlug: user.organization_slug
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
      const batches = fastDatabase.getBatches(); // Get all batches to calculate counts

      console.log('🔍 getFarms DEBUG:');
      console.log(`  Total farms: ${farms?.length || 0}`);
      console.log(`  Total batches: ${batches?.length || 0}`);
      if (batches?.length > 0) {
        console.log('  Batch details:', batches.map(b => ({
          id: b?.id,
          farm_id: b?.farm_id,
          current_count: b?.current_count,
          status: b?.status,
          is_deleted: b?.is_deleted
        })));
      }

      return {
        success: true,
        data: Array.isArray(farms) ? farms.map(farm => {
          // Calculate batch count and total birds for this farm
          const farmBatches = batches.filter(batch =>
            batch?.farm_id === farm?.id &&
            batch?.status !== 'completed' &&
            !batch?.is_deleted
          );

          console.log(`  Farm ${farm?.id} (${farm?.farm_name}):`);
          console.log(`    Matching batches: ${farmBatches.length}`);
          console.log(`    Total birds: ${farmBatches.reduce((sum, b) => sum + (b?.current_count || 0), 0)}`);

          const batchCount = farmBatches.length;
          const totalBirds = farmBatches.reduce((sum, batch) =>
            sum + (batch?.current_count || 0), 0
          );

          return {
            id: farm?.id || Date.now(),
            farmName: farm?.farm_name || 'Unknown Farm',
            name: farm?.farm_name || 'Unknown Farm',
            location: farm?.location || 'Unknown Location',
            farmType: farm?.farm_type || 'broiler',
            description: farm?.description || '',
            batchCount: batchCount,
            totalBirds: totalBirds,
            createdAt: farm?.created_at || new Date().toISOString()
          };
        }) : [],
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
          breed: batch?.bird_type || batch?.breed || '',
          birdType: batch?.bird_type || batch?.breed || '',
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
          // BUGFIX: Convert local batchId to server_id for ALL record types, not just water/weight
          let backendData = { ...recordData };

          if (recordData.batchId) {
            const batch = fastDatabase.getBatchById(recordData.batchId);

            if (!batch) {
              throw new Error(`Batch with ID ${recordData.batchId} not found in local database`);
            }

            if (!batch.server_id) {
              throw new Error(`Batch with ID ${recordData.batchId} not found or not accessible`);
            }

            console.log(`🔍 FastApiService: Found batch "${batch.batch_name}" with server_id: ${batch.server_id}`);

            // Use server_id instead of local id for ALL record types
            backendData = {
              ...recordData,
              batchId: batch.server_id
            };
          }

          let serverResponse;
          // Call appropriate API endpoint based on record type
          // BUGFIX: Use backendData for all record types to ensure server_id is used
          switch (recordType) {
            case 'feed':
              serverResponse = await apiService.createFeedRecord(backendData);
              break;
            case 'production':
              serverResponse = await apiService.createProductionRecord(backendData);
              break;
            case 'mortality':
              serverResponse = await apiService.createMortalityRecord(backendData);
              break;
            case 'health':
              serverResponse = await apiService.createHealthRecord(backendData);
              break;
            case 'water':
              serverResponse = await apiService.createWaterRecord(backendData);
              break;
            case 'weight':
              serverResponse = await apiService.createWeightRecord(backendData);
              break;
            case 'vaccination':
              serverResponse = await apiService.createVaccinationRecord(backendData);
              break;
            default:
              throw new Error(`Unsupported record type: ${recordType}`);
          }

          console.log(`✅ ${recordType} record saved to PostgreSQL:`, serverResponse);

          // CRITICAL FIX: Update batch current_count if mortality/production record
          if ((recordType === 'mortality' || recordType === 'production') && serverResponse.batch) {
            const updatedBatch = serverResponse.batch;
            console.log(`🔄 Updating batch ${recordData.batchId} current_count to ${updatedBatch.currentCount}`);

            try {
              fastDatabase.db.runSync(
                `UPDATE poultry_batches SET current_count = ?, updated_at = ? WHERE id = ?`,
                [updatedBatch.currentCount, new Date().toISOString(), recordData.batchId]
              );
              console.log(`✅ Batch ${recordData.batchId} updated with new current_count: ${updatedBatch.currentCount}`);
            } catch (updateError) {
              console.error(`❌ Failed to update batch current_count:`, updateError);
            }
          }

          // CRITICAL FIX: Cache in SQLite using server response data (includes organization_id)
          // BUT keep the local batchId reference (not the server's batchId)
          const localData = {
            ...serverResponse,  // ✅ Use server data (includes organization_id)
            batchId: recordData.batchId,  // ✅ CRITICAL: Use LOCAL batchId for SQLite FOREIGN KEY
            farmId: recordData.farmId,    // ✅ Keep local farmId too
            server_id: serverResponse.id,
            needs_sync: 0, // Already synced
            synced_at: new Date().toISOString(),
            // CRITICAL FIX: Map backend field names to SQLite schema
            date: serverResponse.date || serverResponse.recordDate || serverResponse.deathDate || serverResponse.treatmentDate || recordData.date,
            // Mortality fields
            ...(recordType === 'mortality' ? {
              count: serverResponse.deaths || serverResponse.count || recordData.count,
              cause: serverResponse.cause || recordData.cause
            } : {}),
            // Production fields
            ...(recordType === 'production' ? {
              eggs_collected: serverResponse.eggsCollected || serverResponse.eggs_collected || recordData.eggsCollected
            } : {}),
            // Health fields
            ...(recordType === 'health' ? {
              healthStatus: serverResponse.healthStatus || recordData.healthStatus,
              treatment: serverResponse.treatment || recordData.treatment
            } : {}),
            // Feed fields
            ...(recordType === 'feed' ? {
              quantityKg: serverResponse.quantityKg || serverResponse.quantity_kg || recordData.quantityKg || recordData.quantity,
              feedType: serverResponse.feedType || serverResponse.feed_type || recordData.feedType,
              cost: serverResponse.cost || recordData.cost
            } : {}),
            // Weight fields
            ...(recordType === 'weight' ? {
              averageWeight: serverResponse.averageWeightGrams || serverResponse.average_weight_grams || recordData.averageWeight,
              averageWeightKg: serverResponse.averageWeightKg || serverResponse.average_weight_kg || recordData.averageWeightKg,
              sampleSize: serverResponse.sampleSize || serverResponse.sample_size || recordData.sampleSize,
              weightUnit: recordData.weightUnit || 'kg',
              dateRecorded: serverResponse.dateRecorded || serverResponse.date_recorded || recordData.dateRecorded
            } : {}),
            // Water fields
            ...(recordType === 'water' ? {
              quantityLiters: serverResponse.quantityLiters || serverResponse.quantity_liters || recordData.quantityLiters
            } : {}),
            // Vaccination fields
            ...(recordType === 'vaccination' ? {
              vaccinationType: serverResponse.vaccinationType || serverResponse.vaccination_type || recordData.vaccinationType,
              vaccinationDate: serverResponse.vaccinationDate || serverResponse.vaccination_date || recordData.vaccinationDate,
              administeredBy: serverResponse.administeredBy || serverResponse.administered_by || recordData.administeredBy
            } : {})
          };

          console.log(`💾 Caching ${recordType} record in SQLite with organization_id:`, serverResponse.organizationId || serverResponse.organization_id);
          console.log(`🔍 DEBUG: localData for caching (batchId should be LOCAL):`, JSON.stringify(localData, null, 2));
          result = fastDatabase.createRecord(recordType, localData);
          console.log(`✅ ${recordType} record cached in SQLite:`, result);

          source = 'server';
        } catch (onlineError) {
          // If online save fails, fall back to offline mode
          console.warn('⚠️  Online save failed, falling back to offline mode:', onlineError.message);

          // Keep camelCase for local database (no conversion needed)
          const localData = {
            ...recordData,
            needs_sync: 1, // Mark for sync
            created_offline: true
          };

          console.log('🔍 FastApiService: Offline fallback data:', localData);
          result = fastDatabase.createRecord(recordType, localData);
          console.log('✅ FastApiService: Offline record created:', result);
          source = 'local_fallback';
        }
      } else {
        // OFFLINE MODE: Save to SQLite with needs_sync flag
        console.log(`📴 OFFLINE: Saving ${recordType} record to SQLite for later sync...`);

        // Keep camelCase for local database (no conversion needed)
        const localData = {
          ...recordData,
          needs_sync: 1, // Mark for sync when online
          created_offline: true
        };

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
        vaccination: EventTypes.VACCINATION_RECORD_CREATED
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
      console.log('═══════════════════════════════════════════════════');
      console.log(`🗑️  DELETE ${recordType.toUpperCase()} RECORD - HYBRID MODE`);
      console.log('═══════════════════════════════════════════════════');
      console.log('Record Type:', recordType);
      console.log('Record ID:', recordId);

      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let source = 'local';

      if (isOnline) {
        // ONLINE: Delete from PostgreSQL first
        try {
          console.log('🌐 Deleting from PostgreSQL backend...');

          // CRITICAL FIX: Get server_id before deleting from backend
          const record = fastDatabase.getRecordById(recordType, recordId);
          console.log(`🔍 Found ${recordType} record:`, JSON.stringify(record, null, 2));

          if (record && record.server_id) {
            console.log(`🔗 Using server_id ${record.server_id} for backend delete (local ID: ${recordId})`);

            // Map record types to API methods - use server_id
            const deleteMethodMap = {
              feed: () => apiService.deleteFeedRecord(record.server_id),
              production: () => apiService.deleteProductionRecord(record.server_id),
              mortality: () => apiService.deleteMortalityRecord(record.server_id),
              health: () => apiService.deleteHealthRecord(record.server_id),
              water: () => apiService.deleteWaterRecord(record.server_id),
              weight: () => apiService.deleteWeightRecord(record.server_id)
            };

            const deleteMethod = deleteMethodMap[recordType];
            if (deleteMethod) {
              await deleteMethod();
              console.log(`✅ ${recordType} record deleted from PostgreSQL`);
              source = 'server';
            }
          } else {
            console.warn(`⚠️ ${recordType} record has no server_id, skipping backend delete (will only delete locally)`);
          }
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
          // Continue to delete locally
        }
      }

      // CRITICAL FIX: For mortality records, restore bird count before deleting
      if (recordType === 'mortality') {
        const record = fastDatabase.getRecordById(recordType, recordId);
        if (record && record.batchId && record.count) {
          console.log(`🔄 Restoring ${record.count} birds to batch ${record.batchId} (deleting mortality record)`);

          // Get current batch data
          const batch = fastDatabase.getBatchById(record.batchId);
          if (batch) {
            const newCount = (batch.current_count || 0) + record.count;
            console.log(`📊 Batch ${record.batchId} count: ${batch.current_count} + ${record.count} = ${newCount}`);

            // Update batch count
            fastDatabase.updateBatchCount(record.batchId, newCount);
            console.log(`✅ Batch ${record.batchId} count restored to ${newCount}`);

            // Emit BATCH_UPDATED event to refresh farm counts
            dataEventBus.emit(EventTypes.BATCH_UPDATED, {
              batchId: record.batchId,
              source: 'local'
            });
          }
        }
      }

      // Delete from local SQLite (always do this)
      console.log('💾 Deleting from local SQLite...');
      fastDatabase.deleteRecord(recordType, recordId);
      console.log(`✅ ${recordType} record deleted from local SQLite`);

      // CRITICAL FIX: Emit specific record deletion event to trigger real-time updates
      const eventTypeMap = {
        feed: EventTypes.FEED_RECORD_DELETED,
        production: EventTypes.PRODUCTION_RECORD_DELETED,
        mortality: EventTypes.MORTALITY_RECORD_DELETED,
        health: EventTypes.HEALTH_RECORD_DELETED,
        water: EventTypes.WATER_RECORD_DELETED,
        weight: EventTypes.WEIGHT_RECORD_DELETED,
        vaccination: EventTypes.VACCINATION_RECORD_DELETED
      };

      const eventType = eventTypeMap[recordType];
      if (eventType) {
        console.log(`📢 Emitting ${eventType} event`);
        dataEventBus.emit(eventType, {
          recordType,
          recordId,
          source
        });
      }

      console.log('═══════════════════════════════════════════════════');
      return {
        success: true,
        source
      };
    } catch (error) {
      console.error(`❌ ${recordType} record deletion error:`, error);
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

          // CRITICAL FIX: Cache in SQLite using server response data (includes organization_id)
          const localData = {
            name: serverResponse.farmName || serverResponse.name,
            location: serverResponse.location,
            farmType: serverResponse.farmType || serverResponse.farm_type,
            description: serverResponse.description,
            organization_id: serverResponse.organizationId || serverResponse.organization_id,  // ✅ Include organization_id from server
            server_id: serverResponse.id,
            needs_sync: 0, // Already synced
            synced_at: new Date().toISOString()
          };

          console.log('💾 Caching farm in SQLite with organization_id:', localData.organization_id);
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
      console.log('═══════════════════════════════════════════════════');
      console.log('🗑️  DELETE FARM - HYBRID MODE');
      console.log('═══════════════════════════════════════════════════');
      console.log('Farm ID:', farmId);

      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let source = 'local';

      if (isOnline) {
        // ONLINE: Delete from PostgreSQL first, then local SQLite
        try {
          console.log('🌐 Deleting from PostgreSQL backend...');

          // CRITICAL FIX: Get server_id before deleting from backend
          const farm = fastDatabase.getFarmById(farmId);
          console.log('🔍 Found farm:', JSON.stringify(farm, null, 2));

          if (farm && farm.server_id) {
            console.log(`🔗 Using server_id ${farm.server_id} for backend delete (local ID: ${farmId})`);
            await apiService.deleteFarm(farm.server_id);
            console.log('✅ Farm deleted from PostgreSQL');
            source = 'server';
          } else {
            console.warn('⚠️ Farm has no server_id, skipping backend delete (will only delete locally)');
          }
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
          // Continue to delete locally even if server delete fails
          // (will be marked as needs_delete and synced later)
        }
      }

      // Delete from local SQLite (always do this)
      console.log('💾 Deleting from local SQLite...');
      fastDatabase.deleteFarm(farmId);
      console.log('✅ Farm deleted from local SQLite');

      // CRITICAL FIX: Emit FARM_DELETED event to trigger dashboard refresh
      console.log('📢 Emitting FARM_DELETED event');
      dataEventBus.emit(EventTypes.FARM_DELETED, {
        farmId,
        source
      });

      console.log('═══════════════════════════════════════════════════');
      return {
        success: true,
        source
      };
    } catch (error) {
      console.error('❌ Farm deletion error:', error);
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

          // CRITICAL FIX: Cache in SQLite using server response data (includes organization_id)
          const localData = {
            batchName: serverResponse.batchName || serverResponse.name,  // ✅ FIXED: Use 'batchName' not 'name'
            farmId: flockData.farmId,  // Keep local farmId reference
            birdType: serverResponse.birdType || serverResponse.bird_type,
            breed: serverResponse.breed,
            initialCount: serverResponse.initialCount || serverResponse.initial_count,
            currentCount: serverResponse.currentCount || serverResponse.current_count,
            arrivalDate: serverResponse.arrivalDate || serverResponse.arrival_date,
            status: serverResponse.status,
            organization_id: serverResponse.organizationId || serverResponse.organization_id,  // ✅ Include organization_id from server
            server_id: serverResponse.id,
            needs_sync: 0, // Already synced
            synced_at: new Date().toISOString()
          };

          console.log('💾 Caching batch in SQLite with organization_id:', localData.organization_id);
          console.log('🔍 DEBUG: localData being passed to createBatch:', JSON.stringify(localData, null, 2));
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
      console.log('═══════════════════════════════════════════════════');
      console.log('🗑️  DELETE FLOCK/BATCH - HYBRID MODE');
      console.log('═══════════════════════════════════════════════════');
      console.log('Flock/Batch ID:', flockId);

      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let source = 'local';

      if (isOnline) {
        // ONLINE: Delete from PostgreSQL first, then local SQLite
        try {
          console.log('🌐 Deleting from PostgreSQL backend...');

          // CRITICAL FIX: Get server_id before deleting from backend
          const batch = fastDatabase.getBatchById(flockId);
          console.log('🔍 Found batch:', JSON.stringify(batch, null, 2));

          if (batch && batch.server_id) {
            console.log(`🔗 Using server_id ${batch.server_id} for backend delete (local ID: ${flockId})`);
            await apiService.deleteFlock(batch.server_id);
            console.log('✅ Flock/Batch deleted from PostgreSQL');
            source = 'server';
          } else {
            console.warn('⚠️ Batch has no server_id, skipping backend delete (will only delete locally)');
          }
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
          // Continue to delete locally even if server delete fails
        }
      }

      // Delete from local SQLite (always do this)
      console.log('💾 Deleting from local SQLite...');
      fastDatabase.deleteBatch(flockId);
      console.log('✅ Flock/Batch deleted from local SQLite');

      // CRITICAL FIX: Emit BATCH_DELETED event to trigger dashboard refresh
      console.log('📢 Emitting BATCH_DELETED event');
      dataEventBus.emit(EventTypes.BATCH_DELETED, {
        batchId: flockId,
        source
      });

      console.log('═══════════════════════════════════════════════════');
      return {
        success: true,
        source
      };
    } catch (error) {
      console.error('❌ Flock/Batch deletion error:', error);
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
      console.log('═══════════════════════════════════════════════════');
      console.log('🗑️  DELETE WATER RECORD - HYBRID MODE');
      console.log('═══════════════════════════════════════════════════');
      console.log('Record ID:', recordId);

      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let source = 'local';

      if (isOnline) {
        try {
          console.log('🌐 Deleting from PostgreSQL backend...');
          await apiService.deleteWaterRecord(recordId);
          console.log('✅ Water record deleted from PostgreSQL');
          source = 'server';
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
        }
      }

      console.log('💾 Deleting from local SQLite...');
      fastDatabase.deleteWaterRecord(recordId);
      console.log('✅ Water record deleted from local SQLite');

      console.log('📢 Emitting WATER_RECORD_DELETED event');
      dataEventBus.emit(EventTypes.WATER_RECORD_DELETED, {
        recordType: 'water',
        recordId,
        source
      });

      console.log('═══════════════════════════════════════════════════');
      return {
        success: true,
        source
      };
    } catch (error) {
      console.error('❌ Water record deletion error:', error);
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
      console.log('═══════════════════════════════════════════════════');
      console.log('🗑️  DELETE WEIGHT RECORD - HYBRID MODE');
      console.log('═══════════════════════════════════════════════════');
      console.log('Record ID:', recordId);

      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let source = 'local';

      if (isOnline) {
        try {
          console.log('🌐 Deleting from PostgreSQL backend...');
          await apiService.deleteWeightRecord(recordId);
          console.log('✅ Weight record deleted from PostgreSQL');
          source = 'server';
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
        }
      }

      console.log('💾 Deleting from local SQLite...');
      fastDatabase.deleteWeightRecord(recordId);
      console.log('✅ Weight record deleted from local SQLite');

      console.log('📢 Emitting WEIGHT_RECORD_DELETED event');
      dataEventBus.emit(EventTypes.WEIGHT_RECORD_DELETED, {
        recordType: 'weight',
        recordId,
        source
      });

      console.log('═══════════════════════════════════════════════════');
      return {
        success: true,
        source
      };
    } catch (error) {
      console.error('❌ Weight record deletion error:', error);
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