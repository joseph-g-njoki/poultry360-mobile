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
      console.log('═══════════════════════════════════════════════════');
      console.log('🏭 GET FARMS - HYBRID MODE');
      console.log('═══════════════════════════════════════════════════');

      // HYBRID APPROACH: Check network status
      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let farms;
      let source;

      if (isOnline) {
        // ONLINE MODE: Fetch from PostgreSQL and smart-sync to SQLite
        try {
          console.log('🌐 ONLINE: Fetching farms from PostgreSQL backend...');
          const serverFarms = await apiService.getFarms();
          console.log(`✅ Fetched ${serverFarms?.length || 0} farms from PostgreSQL`);

          // SMART SYNC: Update SQLite without clearing
          // Only update farms that changed, don't recreate everything
          console.log('💾 Smart-syncing farms to SQLite...');
          const existingFarms = fastDatabase.getFarms();

          for (const serverFarm of serverFarms) {
            // Check if farm exists in SQLite by server_id
            const existingFarm = existingFarms.find(f => String(f.server_id) === String(serverFarm.id));

            if (!existingFarm) {
              // New farm from server - add to SQLite
              console.log(`➕ Adding new farm to SQLite: ${serverFarm.name} (server_id: ${serverFarm.id})`);
              const localData = {
                name: serverFarm.name || serverFarm.farmName,
                location: serverFarm.location,
                farmType: serverFarm.farmType || serverFarm.farm_type,
                description: serverFarm.description,
                organization_id: serverFarm.organizationId || serverFarm.organization_id,
                server_id: serverFarm.id,
                needs_sync: 0,
                synced_at: new Date().toISOString()
              };
              fastDatabase.createFarm(localData);
            }
            // If farm exists, we don't update it (to preserve local changes)
          }

          farms = serverFarms;
          source = 'server';
        } catch (onlineError) {
          console.warn('⚠️  Failed to fetch from PostgreSQL, falling back to SQLite:', onlineError.message);
          farms = fastDatabase.getFarms();
          source = 'local_fallback';
        }
      } else {
        // OFFLINE MODE: Read from SQLite
        console.log('📴 OFFLINE: Reading farms from SQLite...');
        farms = fastDatabase.getFarms();
        source = 'local';
      }

      // Get batches to calculate counts
      const batches = fastDatabase.getBatches();

      console.log('🔍 getFarms DEBUG:');
      console.log(`  Total farms: ${farms?.length || 0}`);
      console.log(`  Total batches: ${batches?.length || 0}`);
      console.log(`  Source: ${source}`);

      return {
        success: true,
        data: Array.isArray(farms) ? farms.map(farm => {
          // CRITICAL FIX: Match batches by BOTH local farm_id and server_farm_id
          // When online, farm.id is server ID, need to match with batch.server_farm_id
          // When offline, farm.id is local ID, need to match with batch.farm_id
          const isFromServer = source === 'server';
          const farmServerId = isFromServer ? farm?.id : farm?.server_id;
          const farmLocalId = isFromServer ? null : farm?.id;

          console.log(`🔍 Matching batches for farm "${farm?.name || farm?.farm_name}": server_id=${farmServerId}, local_id=${farmLocalId}`);

          const farmBatches = batches.filter(batch => {
            // Match by server_farm_id when we have a server ID
            const matchesServerId = farmServerId && String(batch?.server_farm_id) === String(farmServerId);
            // Match by local farm_id when we have a local ID
            const matchesLocalId = farmLocalId && batch?.farm_id === farmLocalId;

            const matches = (matchesServerId || matchesLocalId) &&
              batch?.status !== 'completed' &&
              !batch?.is_deleted;

            if (matches) {
              console.log(`  ✅ Matched batch: ${batch?.batch_name}, farm_id=${batch?.farm_id}, server_farm_id=${batch?.server_farm_id}, birds=${batch?.current_count}`);
            }

            return matches;
          });

          const batchCount = farmBatches.length;
          const totalBirds = farmBatches.reduce((sum, batch) =>
            sum + (batch?.current_count || 0), 0
          );

          console.log(`📊 Farm "${farm?.name || farm?.farm_name}": ${batchCount} batches, ${totalBirds} birds`);

          return {
            id: isFromServer ? farm?.id : farm?.id,  // PostgreSQL ID when online, SQLite ID when offline
            localId: farm?.id,  // SQLite local ID (if exists)
            serverId: farm?.server_id || farm?.id,  // PostgreSQL server ID
            farmName: farm?.farm_name || farm?.name || 'Unknown Farm',
            name: farm?.farm_name || farm?.name || 'Unknown Farm',
            location: farm?.location || 'Unknown Location',
            farmType: farm?.farm_type || farm?.farmType || 'broiler',
            description: farm?.description || '',
            batchCount: batchCount,
            totalBirds: totalBirds,
            createdAt: farm?.created_at || farm?.createdAt || new Date().toISOString()
          };
        }) : [],
        source
      };
    } catch (error) {
      console.error('❌ getFarms error:', error);
      return {
        success: true,
        data: [],
        source: 'fallback'
      };
    }
  }

  async getFlocks() {
    try {
      console.log('═══════════════════════════════════════════════════');
      console.log('🐔 GET FLOCKS - HYBRID MODE');
      console.log('═══════════════════════════════════════════════════');

      // HYBRID APPROACH: Check network status
      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let batches;
      let source;

      if (isOnline) {
        // ONLINE MODE: Fetch from PostgreSQL and smart-sync to SQLite
        try {
          console.log('🌐 ONLINE: Fetching flocks from PostgreSQL backend...');
          const serverFlocks = await apiService.getFlocks();
          console.log(`✅ Fetched ${serverFlocks?.length || 0} flocks from PostgreSQL`);

          // SMART SYNC: Update SQLite without clearing
          // Only update batches that changed, don't recreate everything
          console.log('💾 Smart-syncing flocks to SQLite...');
          const existingBatches = fastDatabase.getBatches();

          for (const serverFlock of serverFlocks) {
            // Check if batch exists in SQLite by server_id
            const existingBatch = existingBatches.find(b => String(b.server_id) === String(serverFlock.id));

            if (!existingBatch) {
              // New batch from server - add to SQLite
              console.log(`➕ Adding new batch to SQLite: ${serverFlock.batchName} (server_id: ${serverFlock.id})`);
              const localData = {
                batchName: serverFlock.batchName || serverFlock.batch_name,
                farmId: serverFlock.farmId || serverFlock.farm_id,
                birdType: serverFlock.birdType || serverFlock.bird_type,
                breed: serverFlock.breed,
                initialCount: serverFlock.initialCount || serverFlock.initial_count,
                currentCount: serverFlock.currentCount || serverFlock.current_count,
                arrivalDate: serverFlock.arrivalDate || serverFlock.arrival_date,
                status: serverFlock.status,
                organization_id: serverFlock.organizationId || serverFlock.organization_id,
                server_id: serverFlock.id,
                needs_sync: 0,
                is_synced: 1,  // CRITICAL FIX: Mark as synced to prevent AutoSync from re-syncing
                synced_at: new Date().toISOString()
              };
              fastDatabase.createBatch(localData);
            }
            // If batch exists, we don't update it (to preserve local changes)
          }

          batches = serverFlocks;
          source = 'server';
        } catch (onlineError) {
          console.warn('⚠️  Failed to fetch from PostgreSQL, falling back to SQLite:', onlineError.message);
          batches = fastDatabase.getBatches();
          source = 'local_fallback';
        }
      } else {
        // OFFLINE MODE: Read from SQLite
        console.log('📴 OFFLINE: Reading flocks from SQLite...');
        batches = fastDatabase.getBatches();
        source = 'local';
      }

      console.log('🔍 getFlocks DEBUG:');
      console.log(`  Total flocks: ${batches?.length || 0}`);
      console.log(`  Source: ${source}`);

      return {
        success: true,
        data: Array.isArray(batches) ? batches.map(batch => ({
          id: batch?.id || batch?.server_id || Date.now(),
          batchName: batch?.batch_name || batch?.batchName || 'Unknown Batch',
          name: batch?.batch_name || batch?.batchName || 'Unknown Batch',
          breed: batch?.bird_type || batch?.birdType || batch?.breed || '',
          birdType: batch?.bird_type || batch?.birdType || batch?.breed || '',
          initialCount: batch?.initial_count || batch?.initialCount || 0,
          currentCount: batch?.current_count || batch?.currentCount || 0,
          farmId: batch?.farm_id || batch?.farmId || 1,
          arrivalDate: batch?.arrival_date || batch?.arrivalDate || batch?.created_at || new Date().toISOString(),
          startDate: batch?.arrival_date || batch?.arrivalDate || batch?.created_at || new Date().toISOString(),
          status: batch?.status || 'active',
          createdAt: batch?.created_at || batch?.createdAt || new Date().toISOString()
        })) : [],
        source
      };
    } catch (error) {
      console.error('❌ getFlocks error:', error);
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
            is_synced: 1,  // CRITICAL FIX: Mark as synced to prevent AutoSync from re-syncing
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
        }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production
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
      console.log('═══════════════════════════════════════════════════');
      console.log(`📋 GET ${recordType.toUpperCase()} RECORDS - HYBRID MODE`);
      console.log('═══════════════════════════════════════════════════');

      // HYBRID APPROACH: Check network status
      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let records;
      let source;

      if (isOnline) {
        // ONLINE MODE: Fetch from PostgreSQL and sync to SQLite
        try {
          console.log(`🌐 ONLINE: Fetching ${recordType} records from PostgreSQL backend...`);

          // Map record types to API methods
          let serverRecords;
          switch (recordType) {
            case 'feed':
              serverRecords = await apiService.getFeedRecords();
              break;
            case 'production':
              serverRecords = await apiService.getProductionRecords();
              break;
            case 'mortality':
              serverRecords = await apiService.getMortalityRecords();
              break;
            case 'health':
              serverRecords = await apiService.getHealthRecords();
              break;
            case 'water':
              serverRecords = await apiService.getWaterRecords();
              break;
            case 'weight':
              serverRecords = await apiService.getWeightRecords();
              break;
            case 'vaccination':
              serverRecords = await apiService.getVaccinationRecords();
              break;
            default:
              throw new Error(`Unsupported record type: ${recordType}`);
          }

          console.log(`✅ Fetched ${serverRecords?.length || 0} ${recordType} records from PostgreSQL`);

          // Clear old SQLite records and replace with server data
          console.log(`💾 Syncing ${recordType} records to SQLite...`);
          fastDatabase.clearRecords(recordType); // Clear old cached records

          // Cache each record in SQLite with server_id
          if (Array.isArray(serverRecords) && serverRecords.length > 0) {
            for (const serverRecord of serverRecords) {
              const localData = {
                ...serverRecord,
                batchId: serverRecord.batchId || serverRecord.batch_id,
                farmId: serverRecord.farmId || serverRecord.farm_id,
                date: serverRecord.date || serverRecord.recordDate || serverRecord.deathDate || serverRecord.treatmentDate,
                organization_id: serverRecord.organizationId || serverRecord.organization_id,
                server_id: serverRecord.id,
                needs_sync: 0,
                is_synced: 1,  // CRITICAL FIX: Mark as synced to prevent AutoSync from re-syncing
                synced_at: new Date().toISOString()
              };
              fastDatabase.createRecord(recordType, localData);
            }
          }

          records = serverRecords;
          source = 'server';
        } catch (onlineError) {
          console.warn(`⚠️  Failed to fetch ${recordType} records from PostgreSQL, falling back to SQLite:`, onlineError.message);
          records = fastDatabase.getAllRecords(recordType);
          source = 'local_fallback';
        }
      } else {
        // OFFLINE MODE: Read from SQLite
        console.log(`📴 OFFLINE: Reading ${recordType} records from SQLite...`);
        records = fastDatabase.getAllRecords(recordType);
        source = 'local';
      }

      console.log(`🔍 getRecords DEBUG:`);
      console.log(`  Total ${recordType} records: ${records?.length || 0}`);
      console.log(`  Source: ${source}`);

      return {
        success: true,
        data: records || [],
        source
      };
    } catch (error) {
      console.error(`❌ getRecords(${recordType}) error:`, error);
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

          // CRITICAL FIX: Try direct deletion first, fallback to server_id lookup
          try {
            // Map record types to API methods - try with recordId directly
            const directDeleteMap = {
              feed: () => apiService.deleteFeedRecord(recordId),
              production: () => apiService.deleteProductionRecord(recordId),
              mortality: () => apiService.deleteMortalityRecord(recordId),
              health: () => apiService.deleteHealthRecord(recordId),
              water: () => apiService.deleteWaterRecord(recordId),
              weight: () => apiService.deleteWeightRecord(recordId)
            };

            const directDelete = directDeleteMap[recordType];
            if (directDelete) {
              await directDelete();
              console.log(`✅ ${recordType} record deleted from PostgreSQL (ID: ${recordId})`);
              source = 'server';
            }
          } catch (serverError) {
            console.warn('⚠️ Direct delete failed, trying to look up server_id in SQLite...');

            // Fallback: Get all records and find by server_id
            const getRecordsMap = {
              feed: () => fastDatabase.getFeedRecords(),
              production: () => fastDatabase.getProductionRecords(),
              mortality: () => fastDatabase.getMortalityRecords(),
              health: () => fastDatabase.getHealthRecords(),
              water: () => fastDatabase.getWaterRecords(),
              weight: () => fastDatabase.getWeightRecords()
            };

            const getRecords = getRecordsMap[recordType];
            if (getRecords) {
              const records = getRecords();
              const record = records.find(r => String(r.server_id) === String(recordId) || r.id === recordId);

              if (record && record.server_id) {
                console.log(`🔗 Using server_id ${record.server_id} for backend delete`);

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
                console.warn(`⚠️ ${recordType} record has no server_id, skipping backend delete`);
              }
            }
          }
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
          // Continue to delete locally
        }
      }

      // Delete from local SQLite (always do this)
      console.log('💾 Deleting from local SQLite...');

      // CRITICAL FIX: Find record by server_id or local id in SQLite
      const getRecordsMap = {
        feed: () => fastDatabase.getFeedRecords(),
        production: () => fastDatabase.getProductionRecords(),
        mortality: () => fastDatabase.getMortalityRecords(),
        health: () => fastDatabase.getHealthRecords(),
        water: () => fastDatabase.getWaterRecords(),
        weight: () => fastDatabase.getWeightRecords()
      };

      const getRecords = getRecordsMap[recordType];
      if (getRecords) {
        const records = getRecords();
        const recordToDelete = records.find(r => String(r.server_id) === String(recordId) || r.id === recordId);

        if (recordToDelete) {
          console.log(`✅ Found ${recordType} record in SQLite: local ID ${recordToDelete.id}, server ID ${recordToDelete.server_id}`);

          // CRITICAL FIX: For mortality records, restore bird count before deleting
          if (recordType === 'mortality' && recordToDelete.batchId && recordToDelete.count) {
            console.log(`🔄 Restoring ${recordToDelete.count} birds to batch ${recordToDelete.batchId} (deleting mortality record)`);

            // Get current batch data
            const batches = fastDatabase.getBatches();
            const batch = batches.find(b => b.id === recordToDelete.batchId);
            if (batch) {
              const newCount = (batch.current_count || 0) + recordToDelete.count;
              console.log(`📊 Batch ${recordToDelete.batchId} count: ${batch.current_count} + ${recordToDelete.count} = ${newCount}`);

              // Update batch count
              fastDatabase.updateBatchCount(recordToDelete.batchId, newCount);
              console.log(`✅ Batch ${recordToDelete.batchId} count restored to ${newCount}`);

              // Emit BATCH_UPDATED event to refresh farm counts
              dataEventBus.emit(EventTypes.BATCH_UPDATED, {
                batchId: recordToDelete.batchId,
                source: 'local'
              }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production
            }
          }

          fastDatabase.deleteRecord(recordType, recordToDelete.id);  // Use local SQLite ID
          console.log(`✅ ${recordType} record deleted from local SQLite`);
        } else {
          console.warn(`⚠️ ${recordType} record with ID ${recordId} not found in SQLite`);
        }
      } else {
        console.warn(`⚠️ No getter function for record type: ${recordType}`);
      }

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
        }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production
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
            is_synced: 1,  // CRITICAL FIX: Mark as synced to prevent AutoSync from re-syncing
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
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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

          // CRITICAL FIX: farmId might be the server ID (from list), so try to use it directly first
          // If that fails, look it up in SQLite
          console.log(`🔍 Attempting to delete with ID: ${farmId}`);

          // Try deleting with the farmId directly (might be server_id already)
          try {
            await apiService.deleteFarm(farmId);
            console.log(`✅ Farm deleted from PostgreSQL (server ID: ${farmId})`);
            source = 'server';
          } catch (serverError) {
            console.warn('⚠️ Direct delete failed, trying to look up server_id in SQLite...');

            // Fallback: Look up in SQLite to get server_id
            const farm = fastDatabase.getFarmById(farmId);
            console.log('🔍 Found farm in SQLite:', JSON.stringify(farm, null, 2));

            if (farm && farm.server_id) {
              console.log(`🔗 Using server_id ${farm.server_id} for backend delete`);
              await apiService.deleteFarm(farm.server_id);
              console.log('✅ Farm deleted from PostgreSQL');
              source = 'server';
            } else {
              console.warn('⚠️ Farm has no server_id, skipping backend delete (will only delete locally)');
            }
          }
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
          // Continue to delete locally even if server delete fails
          // (will be marked as needs_delete and synced later)
        }
      }

      // Delete from local SQLite (always do this)
      // CRITICAL FIX: Look up the farm by server_id if necessary
      console.log('💾 Deleting from local SQLite...');
      try {
        // Try to find farm by server_id in SQLite
        const farms = fastDatabase.getFarms();
        console.log(`🔍 DEBUG: Searching for farm with ID ${farmId} in ${farms.length} farms`);
        console.log(`🔍 DEBUG: All farms in SQLite:`, farms.map(f => ({
          id: f.id,
          server_id: f.server_id,
          name: f.name || f.farm_name
        })));

        const farmToDelete = farms.find(f => String(f.server_id) === String(farmId) || f.id === farmId);

        if (farmToDelete) {
          console.log(`✅ Found farm in SQLite: local ID ${farmToDelete.id}, server ID ${farmToDelete.server_id}`);
          fastDatabase.deleteFarm(farmToDelete.id);  // Use local SQLite ID
          console.log('✅ Farm deleted from local SQLite');
        } else {
          console.warn(`⚠️ Farm with ID ${farmId} not found in SQLite`);
          console.warn(`⚠️ Tried to match: server_id='${farmId}' OR id='${farmId}'`);
        }
      } catch (sqliteError) {
        console.error('❌ SQLite deletion error:', sqliteError.message);
        throw new Error(`Failed to delete farm: ${sqliteError.message}`);
      }

      // CRITICAL FIX: Emit FARM_DELETED event to trigger dashboard refresh
      console.log('📢 Emitting FARM_DELETED event');
      dataEventBus.emit(EventTypes.FARM_DELETED, {
        farmId,
        source
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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
            is_synced: 1,  // CRITICAL FIX: Mark as synced to prevent AutoSync from re-syncing
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
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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

          // CRITICAL FIX: Try direct deletion first, fallback to server_id lookup
          try {
            await apiService.deleteFlock(flockId);
            console.log(`✅ Flock/Batch deleted from PostgreSQL (ID: ${flockId})`);
            source = 'server';
          } catch (serverError) {
            console.warn('⚠️ Direct delete failed, trying to look up server_id in SQLite...');

            // Fallback: Look up in SQLite to get server_id
            const batches = fastDatabase.getBatches();
            const batch = batches.find(b => String(b.server_id) === String(flockId) || b.id === flockId);

            if (batch && batch.server_id) {
              console.log(`🔗 Using server_id ${batch.server_id} for backend delete`);
              await apiService.deleteFlock(batch.server_id);
              console.log('✅ Flock/Batch deleted from PostgreSQL');
              source = 'server';
            } else {
              console.warn('⚠️ Batch has no server_id, skipping backend delete');
            }
          }
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
          // Continue to delete locally even if server delete fails
        }
      }

      // Delete from local SQLite (always do this)
      console.log('💾 Deleting from local SQLite...');

      // CRITICAL FIX: Find batch by server_id or local id in SQLite
      const batches = fastDatabase.getBatches();
      const batchToDelete = batches.find(b => String(b.server_id) === String(flockId) || b.id === flockId);

      if (batchToDelete) {
        console.log(`✅ Found batch in SQLite: local ID ${batchToDelete.id}, server ID ${batchToDelete.server_id}`);
        fastDatabase.deleteBatch(batchToDelete.id);  // Use local SQLite ID
        console.log('✅ Flock/Batch deleted from local SQLite');
      } else {
        console.warn(`⚠️ Batch with ID ${flockId} not found in SQLite`);
      }

      // CRITICAL FIX: Emit BATCH_DELETED event to trigger dashboard refresh
      console.log('📢 Emitting BATCH_DELETED event');
      dataEventBus.emit(EventTypes.BATCH_DELETED, {
        batchId: flockId,
        source
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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
      console.log('═══════════════════════════════════════════════════');
      console.log('💧 GET WATER RECORDS - HYBRID MODE');
      console.log('═══════════════════════════════════════════════════');

      // HYBRID APPROACH: Check network status
      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let records;
      let source;

      if (isOnline) {
        // ONLINE MODE: Fetch from PostgreSQL and sync to SQLite
        try {
          console.log('🌐 ONLINE: Fetching water records from PostgreSQL backend...');
          const serverRecords = await apiService.getWaterRecords(batchId);
          console.log(`✅ Fetched ${serverRecords?.length || 0} water records from PostgreSQL`);

          // Clear old SQLite water records and replace with server data
          console.log('💾 Syncing water records to SQLite...');
          fastDatabase.clearRecords('water'); // Clear old cached water records

          // Cache each record in SQLite with server_id
          if (Array.isArray(serverRecords) && serverRecords.length > 0) {
            for (const serverRecord of serverRecords) {
              const localData = {
                batchId: serverRecord.batchId || serverRecord.batch_id,
                farmId: serverRecord.farmId || serverRecord.farm_id,
                quantityLiters: serverRecord.quantityLiters || serverRecord.quantity_liters,
                date: serverRecord.date || serverRecord.recordDate,
                notes: serverRecord.notes,
                organization_id: serverRecord.organizationId || serverRecord.organization_id,
                server_id: serverRecord.id,
                needs_sync: 0,
                is_synced: 1,  // CRITICAL FIX: Mark as synced to prevent AutoSync from re-syncing
                synced_at: new Date().toISOString()
              };
              fastDatabase.createWaterRecord(localData);
            }
          }

          records = serverRecords;
          source = 'server';
        } catch (onlineError) {
          console.warn('⚠️  Failed to fetch water records from PostgreSQL, falling back to SQLite:', onlineError.message);
          records = fastDatabase.getWaterRecords();
          source = 'local_fallback';
        }
      } else {
        // OFFLINE MODE: Read from SQLite
        console.log('📴 OFFLINE: Reading water records from SQLite...');
        records = fastDatabase.getWaterRecords();
        source = 'local';
      }

      // Filter by batchId if provided
      const filteredRecords = batchId ? records.filter(r => (r.batch_id || r.batchId) === batchId) : records;

      console.log('🔍 getWaterRecords DEBUG:');
      console.log(`  Total water records: ${records?.length || 0}`);
      console.log(`  Filtered records: ${filteredRecords?.length || 0}`);
      console.log(`  Source: ${source}`);

      return {
        success: true,
        data: filteredRecords,
        waterRecords: filteredRecords,
        source
      };
    } catch (error) {
      console.error('❌ getWaterRecords error:', error);
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

          // CRITICAL FIX: Try direct deletion first, fallback to server_id lookup
          try {
            await apiService.deleteWaterRecord(recordId);
            console.log(`✅ Water record deleted from PostgreSQL (ID: ${recordId})`);
            source = 'server';
          } catch (serverError) {
            console.warn('⚠️ Direct delete failed, trying to look up server_id in SQLite...');

            // Fallback: Look up in SQLite to get server_id
            const records = fastDatabase.getWaterRecords();
            const record = records.find(r => String(r.server_id) === String(recordId) || r.id === recordId);

            if (record && record.server_id) {
              console.log(`🔗 Using server_id ${record.server_id} for backend delete`);
              await apiService.deleteWaterRecord(record.server_id);
              console.log('✅ Water record deleted from PostgreSQL');
              source = 'server';
            } else {
              console.warn('⚠️ Water record has no server_id, skipping backend delete');
            }
          }
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
        }
      }

      console.log('💾 Deleting from local SQLite...');

      // CRITICAL FIX: Find record by server_id or local id in SQLite
      const records = fastDatabase.getWaterRecords();
      const recordToDelete = records.find(r => String(r.server_id) === String(recordId) || r.id === recordId);

      if (recordToDelete) {
        console.log(`✅ Found water record in SQLite: local ID ${recordToDelete.id}, server ID ${recordToDelete.server_id}`);
        fastDatabase.deleteWaterRecord(recordToDelete.id);  // Use local SQLite ID
        console.log('✅ Water record deleted from local SQLite');
      } else {
        console.warn(`⚠️ Water record with ID ${recordId} not found in SQLite`);
      }

      console.log('📢 Emitting WATER_RECORD_DELETED event');
      dataEventBus.emit(EventTypes.WATER_RECORD_DELETED, {
        recordType: 'water',
        recordId,
        source
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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
      console.log('═══════════════════════════════════════════════════');
      console.log('⚖️  GET WEIGHT RECORDS - HYBRID MODE');
      console.log('═══════════════════════════════════════════════════');

      // HYBRID APPROACH: Check network status
      const isOnline = networkService.getIsConnected();
      console.log(`📡 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      let records;
      let source;

      if (isOnline) {
        // ONLINE MODE: Fetch from PostgreSQL and sync to SQLite
        try {
          console.log('🌐 ONLINE: Fetching weight records from PostgreSQL backend...');
          const serverRecords = await apiService.getWeightRecords(batchId);
          console.log(`✅ Fetched ${serverRecords?.length || 0} weight records from PostgreSQL`);

          // Clear old SQLite weight records and replace with server data
          console.log('💾 Syncing weight records to SQLite...');
          fastDatabase.clearRecords('weight'); // Clear old cached weight records

          // Cache each record in SQLite with server_id
          if (Array.isArray(serverRecords) && serverRecords.length > 0) {
            for (const serverRecord of serverRecords) {
              const localData = {
                batchId: serverRecord.batchId || serverRecord.batch_id,
                farmId: serverRecord.farmId || serverRecord.farm_id,
                averageWeight: serverRecord.averageWeightGrams || serverRecord.average_weight_grams,
                averageWeightKg: serverRecord.averageWeightKg || serverRecord.average_weight_kg,
                sampleSize: serverRecord.sampleSize || serverRecord.sample_size,
                weightUnit: serverRecord.weightUnit || serverRecord.weight_unit || 'kg',
                dateRecorded: serverRecord.dateRecorded || serverRecord.date_recorded || serverRecord.date,
                date: serverRecord.date || serverRecord.dateRecorded || serverRecord.date_recorded,
                notes: serverRecord.notes,
                organization_id: serverRecord.organizationId || serverRecord.organization_id,
                server_id: serverRecord.id,
                needs_sync: 0,
                is_synced: 1,  // CRITICAL FIX: Mark as synced to prevent AutoSync from re-syncing
                synced_at: new Date().toISOString()
              };
              fastDatabase.createWeightRecord(localData);
            }
          }

          records = serverRecords;
          source = 'server';
        } catch (onlineError) {
          console.warn('⚠️  Failed to fetch weight records from PostgreSQL, falling back to SQLite:', onlineError.message);
          records = fastDatabase.getWeightRecords();
          source = 'local_fallback';
        }
      } else {
        // OFFLINE MODE: Read from SQLite
        console.log('📴 OFFLINE: Reading weight records from SQLite...');
        records = fastDatabase.getWeightRecords();
        source = 'local';
      }

      // Filter by batchId if provided
      const filteredRecords = batchId ? records.filter(r => (r.batch_id || r.batchId) === batchId) : records;

      console.log('🔍 getWeightRecords DEBUG:');
      console.log(`  Total weight records: ${records?.length || 0}`);
      console.log(`  Filtered records: ${filteredRecords?.length || 0}`);
      console.log(`  Source: ${source}`);

      return {
        success: true,
        data: filteredRecords,
        weightRecords: filteredRecords,
        source
      };
    } catch (error) {
      console.error('❌ getWeightRecords error:', error);
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

          // CRITICAL FIX: Try direct deletion first, fallback to server_id lookup
          try {
            await apiService.deleteWeightRecord(recordId);
            console.log(`✅ Weight record deleted from PostgreSQL (ID: ${recordId})`);
            source = 'server';
          } catch (serverError) {
            console.warn('⚠️ Direct delete failed, trying to look up server_id in SQLite...');

            // Fallback: Look up in SQLite to get server_id
            const records = fastDatabase.getWeightRecords();
            const record = records.find(r => String(r.server_id) === String(recordId) || r.id === recordId);

            if (record && record.server_id) {
              console.log(`🔗 Using server_id ${record.server_id} for backend delete`);
              await apiService.deleteWeightRecord(record.server_id);
              console.log('✅ Weight record deleted from PostgreSQL');
              source = 'server';
            } else {
              console.warn('⚠️ Weight record has no server_id, skipping backend delete');
            }
          }
        } catch (error) {
          console.error('❌ Failed to delete from PostgreSQL:', error.message);
        }
      }

      console.log('💾 Deleting from local SQLite...');

      // CRITICAL FIX: Find record by server_id or local id in SQLite
      const records = fastDatabase.getWeightRecords();
      const recordToDelete = records.find(r => String(r.server_id) === String(recordId) || r.id === recordId);

      if (recordToDelete) {
        console.log(`✅ Found weight record in SQLite: local ID ${recordToDelete.id}, server ID ${recordToDelete.server_id}`);
        fastDatabase.deleteWeightRecord(recordToDelete.id);  // Use local SQLite ID
        console.log('✅ Weight record deleted from local SQLite');
      } else {
        console.warn(`⚠️ Weight record with ID ${recordId} not found in SQLite`);
      }

      console.log('📢 Emitting WEIGHT_RECORD_DELETED event');
      dataEventBus.emit(EventTypes.WEIGHT_RECORD_DELETED, {
        recordType: 'weight',
        recordId,
        source
      }, { debounce: false }); // FIX: Disable debounce for immediate UI updates in production

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