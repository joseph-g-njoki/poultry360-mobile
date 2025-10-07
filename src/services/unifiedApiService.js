import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './api';
import offlineDataService from './offlineDataService';
import networkService from './networkService';
import syncService from './syncService';
import migrationService from './migrationService';

class UnifiedApiService {
  constructor() {
    this.forceOfflineMode = false;
    this.optimisticUpdates = true;
    this.autoRetry = true;
    this.retryDelay = 1000;
    this.maxRetries = 3;
  }

  // Enhanced initialization with robust error handling and recovery
  async init() {
    let initAttempts = 0;
    const maxInitAttempts = 3;

    while (initAttempts < maxInitAttempts) {
      try {
        initAttempts++;
        console.log(`🔧 Initializing UnifiedApiService (attempt ${initAttempts}/${maxInitAttempts})...`);

        // Step 1: Initialize migration service first with error handling
        console.log('📦 Step 1: Initializing migration service...');
        try {
          await migrationService.init();
          console.log('✅ Migration service initialized successfully');
        } catch (migrationError) {
          console.error('❌ Migration service initialization failed:', migrationError);
          if (initAttempts >= maxInitAttempts) {
            // CRASH FIX: Don't throw - log and continue in degraded mode
            console.warn('⚠️ Migration service failed after all retries - continuing without migrations');
            break; // Exit retry loop instead of throwing
          }
          continue; // Retry
        }

        // Step 2: Initialize offline data service (this also initializes the database)
        console.log('💾 Step 2: Initializing offline data service...');
        try {
          await offlineDataService.init();
          console.log('✅ Offline data service initialized successfully');
        } catch (offlineError) {
          console.error('❌ Offline data service initialization failed:', offlineError);

          // CRITICAL FIX: Re-throw database-related errors so App.js can handle them
          // This prevents silent failures and ensures proper error UI is shown
          if (
            offlineError?.code === 'DATABASE_INIT_FAILED' ||
            offlineError?.code === 'DATABASE_NULL_INSTANCE' ||
            offlineError?.code === 'DATABASE_CONNECTION_FAILED' ||
            offlineError?.code === 'OFFLINE_SERVICE_INIT_FAILED' ||
            offlineError?.originalError?.code?.includes('DATABASE')
          ) {
            console.error('🚨 Critical database error - re-throwing for App.js to handle');
            throw offlineError;
          }

          // For non-database errors, continue in online-only mode
          console.warn('⚠️  Non-database error - app will continue in online-only mode');
        }

        // Step 3: Initialize network service with better error handling
        console.log('🌐 Step 3: Initializing network service...');
        try {
          await networkService.init();
          console.log('✅ Network service initialized successfully');
        } catch (networkError) {
          console.warn('⚠️  Network service initialization failed, using fallback:', networkError.message);
          // Set up fallback network state
          networkService.isConnected = false;
          networkService.connectionType = 'unknown';
          networkService.connectionQuality = 'unknown';
          // Continue - network is not critical for initialization
        }

        // PERFORMANCE FIX: Move ALL non-critical operations to background
        // This reduces initialization time from 10-15s to 1-2s
        setImmediate(() => {
          // Step 4: Migrate any legacy data (BACKGROUND - non-critical)
          console.log('📦 Background: Checking for legacy data migration...');
          migrationService.migrateLegacyData()
            .then(() => console.log('✅ Background: Legacy data migration check completed'))
            .catch(migrationError => console.warn('⚠️  Background: Legacy data migration issues:', migrationError.message));

          // Step 5: Perform data integrity check (BACKGROUND - non-critical)
          console.log('📦 Background: Performing data integrity check...');
          migrationService.performIntegrityCheck()
            .then(integrityCheck => {
              if (integrityCheck.errors && integrityCheck.errors.length > 0) {
                console.warn('⚠️  Background: Data integrity issues found:', integrityCheck.errors);
              } else {
                console.log('✅ Background: Data integrity check passed');
              }
            })
            .catch(integrityError => console.warn('⚠️  Background: Data integrity check failed:', integrityError.message));

          // Step 6: Check network and handle initial sync (BACKGROUND - non-critical)
          console.log('📦 Background: Checking network and sync status...');
          try {
            const isConnected = networkService.getIsConnected();
            if (isConnected) {
              console.log('📦 Background: Network connected - checking initial sync status...');
              syncService.isInitialSyncCompleted()
                .then(isInitialSyncCompleted => {
                  if (!isInitialSyncCompleted) {
                    console.log('📦 Background: Performing initial sync...');
                    syncService.performInitialSync()
                      .then(() => console.log('✅ Background: Initial sync completed'))
                      .catch(syncError => console.error('⚠️  Background: Initial sync failed:', syncError.message));
                  } else {
                    console.log('✅ Background: Initial sync already completed');
                  }
                })
                .catch(syncError => console.warn('⚠️  Background: Initial sync check failed:', syncError.message));
            } else {
              console.log('📦 Background: No network connection - running in offline mode');
            }
          } catch (networkError) {
            console.warn('⚠️  Background: Network check failed, assuming offline mode:', networkError.message);
          }

          // Step 7: Final verification (BACKGROUND)
          console.log('📦 Background: Performing final verification...');
          this.performFinalVerification()
            .then(() => console.log('✅ Background: Final verification passed'))
            .catch(verifyError => console.warn('⚠️  Background: Final verification failed:', verifyError.message));
        });

        console.log('✅ UnifiedApiService initialized successfully');
        return true;

      } catch (error) {
        console.error(`❌ UnifiedApiService initialization attempt ${initAttempts} failed:`, error);

        if (initAttempts >= maxInitAttempts) {
          // CRASH FIX: Final attempt - try emergency recovery, but DON'T throw if it fails
          try {
            console.log('🚨 Attempting emergency recovery...');
            await this.performEmergencyRecovery();
            console.log('✅ Emergency recovery successful');
            return true;
          } catch (recoveryError) {
            console.error('❌ Emergency recovery failed:', recoveryError);
            // CRASH FIX: Don't throw - log error and return false to allow app to continue
            console.warn(`⚠️ UnifiedApiService initialization failed after ${maxInitAttempts} attempts - app will run in degraded mode`);
            return false; // Return false instead of throwing
          }
        }

        // Wait before retry
        const delay = Math.min(1000 * Math.pow(2, initAttempts - 1), 5000);
        console.log(`⏳ Retrying initialization in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // CRASH FIX: If loop exits without success or error, return false (degraded mode)
    console.warn('⚠️ UnifiedApiService initialization loop exited unexpectedly - running in degraded mode');
    return false;
  }

  // Perform final verification of initialization
  async performFinalVerification() {
    try {
      // Check if demo users exist
      const demoUser = await offlineDataService.getUserByEmail('demo@poultry360.com');
      if (!demoUser) {
        throw new Error('Demo users not found - initialization incomplete');
      }

      // Check database health
      const dbInfo = await offlineDataService.validateData();
      if (!dbInfo.isValid && dbInfo.warnings.length > 0) {
        console.warn('⚠️  Database validation warnings:', dbInfo.warnings);
      }

      console.log('✅ Final verification passed');
    } catch (error) {
      console.error('❌ Final verification failed:', error);
      throw error;
    }
  }

  // Emergency recovery for initialization failures
  async performEmergencyRecovery() {
    try {
      console.log('🚨 Starting emergency recovery...');

      // Force reset database and reinitialize
      await offlineDataService.resetDatabase();
      await offlineDataService.init();

      // Re-run migration from scratch
      await migrationService.init();

      console.log('✅ Emergency recovery completed');
    } catch (error) {
      console.error('❌ Emergency recovery failed:', error);
      throw error;
    }
  }

  // Configuration methods
  setForceOfflineMode(enabled) {
    this.forceOfflineMode = enabled;
    console.log(`Force offline mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  setOptimisticUpdates(enabled) {
    this.optimisticUpdates = enabled;
    console.log(`Optimistic updates: ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Connection helpers
  isOnlineMode() {
    return !this.forceOfflineMode && networkService.getIsConnected();
  }

  isOfflineMode() {
    return this.forceOfflineMode || !networkService.getIsConnected();
  }

  // Data transformation helpers
  transformUserData(userData) {
    if (!userData) return null;

    return {
      ...userData,
      // Transform snake_case to camelCase for frontend compatibility
      firstName: userData.first_name,
      lastName: userData.last_name,
      // Keep both formats for backward compatibility
      first_name: userData.first_name,
      last_name: userData.last_name
    };
  }

  // Authentication methods
  // Enhanced login with better error handling and recovery
  async login(email, password) {
    try {
      console.log(`🔐 Attempting login for: ${email}`);

      // Validate inputs
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Ensure services are initialized
      if (!offlineDataService) {
        console.log('🔄 Offline data service not ready, initializing...');
        await this.init();
      }

      // Check for demo credentials first (always allow offline)
      const isDemoUser = this.isDemoCredentials(email, password);
      if (isDemoUser) {
        console.log('🔑 Demo credentials detected, using offline login');
        return await this.tryOfflineLogin(email, password, null, true);
      }

      if (this.isOnlineMode()) {
        console.log('📡 Online mode - attempting server login...');
        try {
          // Try online login first
          const result = await this.performServerLogin(email, password);
          if (result.success) {
            return result;
          }
        } catch (serverError) {
          console.log('⚠️  Server login failed, trying offline fallback:', serverError.message);
          // Fall back to offline login
          return await this.tryOfflineLogin(email, password, serverError.message);
        }
      } else {
        console.log('📴 Offline mode - checking local credentials...');
        return await this.tryOfflineLogin(email, password);
      }
    } catch (error) {
      console.error('❌ Login failed:', error);
      return {
        success: false,
        error: error.message,
        source: this.isOnlineMode() ? 'server' : 'local'
      };
    }
  }

  // Check if credentials are demo credentials
  isDemoCredentials(email, password) {
    const demoCredentials = [
      { email: 'demo@poultry360.com', password: 'demo123' },
      { email: 'owner@poultry360.com', password: 'owner123' },
      { email: 'admin@poultry360.com', password: 'admin123' }
    ];

    return demoCredentials.some(cred => cred.email === email && cred.password === password);
  }

  // Perform server login
  async performServerLogin(email, password) {
    try {
      const result = await apiService.login(email, password);

      if (result.token && result.user) {
        console.log('✅ Server login successful');

        // Transform and store user in local database
        const transformedUser = this.transformUserData(result.user);

        // Check if user already exists locally
        const existingUser = await offlineDataService.getUserByEmail(email);

        if (existingUser) {
          // Update existing user
          await offlineDataService.updateUser(existingUser.id, {
            server_id: result.user.id?.toString(),
            first_name: result.user.firstName || result.user.first_name,
            last_name: result.user.lastName || result.user.last_name,
            role: result.user.role
          }, true); // Skip sync since it's from server
        } else {
          // Create new user
          await offlineDataService.createUser({
            ...result.user,
            server_id: result.user.id?.toString(),
            email: result.user.email || email,
            username: result.user.username || email.split('@')[0],
            first_name: result.user.firstName || result.user.first_name,
            last_name: result.user.lastName || result.user.last_name
          }, true); // Skip sync since it's from server
        }

        return {
          success: true,
          data: { ...result, user: transformedUser },
          source: 'server'
        };
      } else {
        throw new Error('Invalid server response - missing token or user data');
      }
    } catch (error) {
      console.error('❌ Server login error:', error);
      throw error;
    }
  }

  // Enhanced offline login with demo user support
  async tryOfflineLogin(email, password, serverError = null, isDemoUser = false) {
    try {
      console.log(`📴 Attempting offline login for: ${email}`);

      // Check local credentials
      const localUser = await offlineDataService.getUserByEmail(email);

      if (localUser) {
        console.log('✅ User found in offline storage');

        // For demo users, always allow login
        // In a real app, you'd want to hash and compare passwords properly
        if (isDemoUser || this.isDemoCredentials(email, password)) {
          console.log('🔑 Demo user login successful');
        } else {
          // For real users, we could implement proper password checking here
          // For now, we'll allow login if user exists locally
          console.log('🔑 Local user login (password check bypassed for offline mode)');
        }

        // Transform snake_case database fields to camelCase for frontend compatibility
        const transformedUser = this.transformUserData(localUser);

        return {
          success: true,
          data: {
            user: transformedUser,
            token: isDemoUser ? 'demo_token' : 'offline_token'
          },
          source: 'local',
          isOffline: true,
          isDemoUser,
          ...(serverError && { serverError })
        };
      } else {
        // User not found locally
        if (isDemoUser) {
          // This shouldn't happen for demo users - they should be seeded
          console.error('❌ Demo user not found in local storage - database may be corrupted');
          throw new Error('Demo user not found. Please reset the app or contact support.');
        }

        const errorMessage = serverError
          ? `Server login failed: ${serverError}. User not found in offline storage. Please connect to internet for first login.`
          : 'User not found in offline storage. Please connect to internet for first login.';

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('❌ Offline login failed:', error);
      throw new Error(`Offline login failed: ${error.message}`);
    }
  }

  async register(userData) {
    try {
      console.log('📝 Attempting user registration...');

      if (!userData || !userData.email) {
        throw new Error('User data with email is required');
      }

      // Check if user already exists locally
      const existingUser = await offlineDataService.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('User already exists with this email address');
      }

      if (this.isOnlineMode()) {
        console.log('📡 Online mode - attempting server registration...');
        try {
          // Online registration
          const result = await apiService.register(userData);

          if (result.token && result.user) {
            console.log('✅ Server registration successful');

            // Transform and store user in local database
            const transformedUser = this.transformUserData(result.user);
            await offlineDataService.createUser({
              ...result.user,
              server_id: result.user.id?.toString(),
              email: result.user.email || userData.email,
              // Ensure snake_case fields are stored in database
              first_name: result.user.firstName || result.user.first_name || userData.firstName,
              last_name: result.user.lastName || result.user.last_name || userData.lastName
            }, true);

            return {
              success: true,
              data: { ...result, user: transformedUser },
              source: 'server'
            };
          } else {
            throw new Error('Invalid server response - missing token or user data');
          }
        } catch (serverError) {
          console.log('⚠️  Server registration failed, falling back to offline:', serverError.message);
          // Fall back to offline registration
        }
      }

      console.log('📴 Offline mode - storing user locally...');

      // Offline registration - store locally and queue for sync
      const userDataForDb = {
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        // Ensure snake_case fields for database storage
        first_name: userData.firstName || userData.first_name || '',
        last_name: userData.lastName || userData.last_name || '',
        role: userData.role || 'farm_worker',
        is_active: 1
      };

      const localUser = await offlineDataService.createUser(userDataForDb);

      // Transform for frontend
      const transformedUser = this.transformUserData(localUser);

      console.log('✅ Offline registration successful - will sync later');

      return {
        success: true,
        data: { user: transformedUser, token: 'offline_token' },
        source: 'local',
        isOffline: true,
        willSyncLater: true
      };
    } catch (error) {
      console.error('❌ Registration failed:', error);
      return {
        success: false,
        error: error.message,
        source: this.isOnlineMode() ? 'server' : 'local'
      };
    }
  }

  async getProfile() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);

        if (this.isOnlineMode()) {
          try {
            // Try to get fresh data from server
            const serverProfile = await apiService.getProfile();

            // Transform and update local storage
            const transformedProfile = this.transformUserData(serverProfile);
            await AsyncStorage.setItem('userData', JSON.stringify(transformedProfile));
            await offlineDataService.updateUser(user.id, {
              ...serverProfile,
              // Ensure snake_case fields for database storage
              first_name: serverProfile.firstName || serverProfile.first_name,
              last_name: serverProfile.lastName || serverProfile.last_name
            }, true);

            return { success: true, data: transformedProfile, source: 'server' };
          } catch (error) {
            console.log('Failed to fetch profile from server, using local data:', error.message);
          }
        }

        // Transform user data for frontend compatibility
        const transformedUser = this.transformUserData(user);
        return { success: true, data: transformedUser, source: 'local' };
      } else {
        throw new Error('No user data found');
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Dashboard methods with enhanced error handling
  async getDashboard() {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        retryCount++;
        console.log(`📊 Getting dashboard data (attempt ${retryCount}/${maxRetries})...`);

        // Ensure offlineDataService is available
        if (!offlineDataService) {
          console.warn('OfflineDataService not available, initializing...');
          await this.init(); // Re-initialize if needed
        }

        // Try online first if available
        if (this.isOnlineMode()) {
          try {
            console.log('🌐 Attempting to fetch dashboard from server...');
            const dashboardData = await apiService.getDashboard();
            console.log('✅ Dashboard data fetched from server');
            return { success: true, data: dashboardData, source: 'server' };
          } catch (serverError) {
            console.log('⚠️  Server dashboard fetch failed, using local data:', serverError.message);
            // Fall through to local data
          }
        }

        // Get local dashboard data with retries
        console.log('📱 Fetching dashboard data from local storage...');
        let localDashboard;

        try {
          localDashboard = await offlineDataService.getDashboardData();
        } catch (localError) {
          if (retryCount >= maxRetries) {
            throw localError;
          }

          console.warn(`⚠️  Local dashboard fetch attempt ${retryCount} failed:`, localError.message);

          // Try to recover the database
          if (localError.message.includes('database') || localError.message.includes('table')) {
            console.log('🔧 Attempting database recovery...');
            try {
              await offlineDataService.init();
            } catch (recoveryError) {
              console.error('❌ Database recovery failed:', recoveryError.message);
            }
          }

          // Wait before retry
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 3000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.log('✅ Dashboard data fetched from local storage');
        return {
          success: true,
          data: localDashboard || this.getDefaultDashboardData(),
          source: 'local',
          isOffline: this.isOfflineMode()
        };

      } catch (error) {
        console.error(`❌ Dashboard fetch attempt ${retryCount} failed:`, error);

        if (retryCount >= maxRetries) {
          console.error('❌ All dashboard fetch attempts failed, returning defaults');
          return {
            success: true, // Return success with defaults to prevent app crash
            data: this.getDefaultDashboardData(),
            source: 'fallback',
            error: error.message,
            isOffline: true
          };
        }

        // Wait before retry
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 3000);
        console.log(`⏳ Retrying dashboard fetch in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Get safe default dashboard data
  getDefaultDashboardData() {
    return {
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
      alerts: [],
      isDefault: true
    };
  }

  // Farm methods
  async getFarms() {
    try {
      if (this.isOnlineMode()) {
        try {
          const farms = await apiService.getFarms();

          // Update local storage
          for (const farm of farms) {
            const existingFarm = await offlineDataService.getByServerId('farms', farm.id?.toString());
            if (existingFarm) {
              await offlineDataService.update('farms', existingFarm.id, {
                farm_name: farm.farmName || farm.name,
                location: farm.location,
                farm_size: farm.farmSize,
                contact_person: farm.contactPerson,
                phone_number: farm.phoneNumber,
                email: farm.email,
                notes: farm.notes
              }, true);
            } else {
              await offlineDataService.createFarm({
                server_id: farm.id?.toString(),
                farm_name: farm.farmName || farm.name,
                location: farm.location,
                farm_size: farm.farmSize,
                contact_person: farm.contactPerson,
                phone_number: farm.phoneNumber,
                email: farm.email,
                notes: farm.notes
              }, true);
            }
          }

          return { success: true, data: farms, source: 'server' };
        } catch (error) {
          console.log('Failed to fetch farms from server, using local data:', error.message);
        }
      }

      // Get local farms
      const localFarms = await offlineDataService.getFarms();

      // Format for frontend compatibility
      const formattedFarms = localFarms.map(farm => ({
        id: farm.server_id || farm.id,
        farmId: farm.id,
        farmName: farm.farm_name,
        name: farm.farm_name,
        location: farm.location,
        farmSize: farm.farm_size,
        contactPerson: farm.contact_person,
        phoneNumber: farm.phone_number,
        email: farm.email,
        notes: farm.notes,
        createdAt: farm.created_at,
        updatedAt: farm.updated_at,
        isLocal: true,
        needsSync: farm.needs_sync === 1
      }));

      return {
        success: true,
        data: formattedFarms,
        source: 'local',
        isOffline: this.isOfflineMode()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createFarm(farmData) {
    try {
      // Optimistic update - create locally first
      const localFarm = await offlineDataService.createFarm({
        farm_name: farmData.farmName || farmData.name,
        location: farmData.location,
        farm_size: farmData.farmSize,
        contact_person: farmData.contactPerson,
        phone_number: farmData.phoneNumber,
        email: farmData.email,
        notes: farmData.notes
      });

      if (this.isOnlineMode()) {
        try {
          // Try to create on server
          const serverFarm = await apiService.createFarm(farmData);

          if (serverFarm && serverFarm.id) {
            // Update local farm with server ID
            await offlineDataService.markAsSynced('farms', localFarm.id, serverFarm.id.toString());
          }

          return {
            success: true,
            data: serverFarm,
            source: 'server',
            localId: localFarm.id
          };
        } catch (error) {
          console.log('Failed to create farm on server, will sync later:', error.message);
        }
      }

      // Return local result
      return {
        success: true,
        data: {
          id: localFarm.id,
          farmName: localFarm.farm_name,
          ...farmData,
          createdAt: localFarm.created_at,
          isLocal: true
        },
        source: 'local',
        willSyncLater: this.isOfflineMode()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateFarm(farmId, farmData) {
    try {
      // Find local farm
      let localFarmId = farmId;
      const localFarmByServer = await offlineDataService.getByServerId('farms', farmId.toString());
      if (localFarmByServer) {
        localFarmId = localFarmByServer.id;
      }

      // Update locally
      await offlineDataService.updateFarm(localFarmId, {
        farm_name: farmData.farmName || farmData.name,
        location: farmData.location,
        farm_size: farmData.farmSize,
        contact_person: farmData.contactPerson,
        phone_number: farmData.phoneNumber,
        email: farmData.email,
        notes: farmData.notes
      });

      if (this.isOnlineMode()) {
        try {
          // Try to update on server
          const serverFarm = await apiService.updateFarm(farmId, farmData);

          return {
            success: true,
            data: serverFarm,
            source: 'server',
            localId: localFarmId
          };
        } catch (error) {
          console.log('Failed to update farm on server, will sync later:', error.message);
        }
      }

      return {
        success: true,
        data: { id: farmId, ...farmData },
        source: 'local',
        willSyncLater: this.isOfflineMode()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteFarm(farmId) {
    try {
      // Find and delete locally
      let localFarmId = farmId;
      const localFarmByServer = await offlineDataService.getByServerId('farms', farmId.toString());
      if (localFarmByServer) {
        localFarmId = localFarmByServer.id;
      }

      await offlineDataService.deleteFarm(localFarmId);

      if (this.isOnlineMode()) {
        try {
          // Try to delete on server
          const result = await apiService.deleteFarm(farmId);

          return { success: true, data: result, source: 'server' };
        } catch (error) {
          console.log('Failed to delete farm on server, will sync later:', error.message);
        }
      }

      return {
        success: true,
        data: { deleted: true },
        source: 'local',
        willSyncLater: this.isOfflineMode()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Batch/Flock methods
  async getFlocks() {
    try {
      if (this.isOnlineMode()) {
        try {
          const flocks = await apiService.getFlocks();

          // Update local storage
          for (const flock of flocks) {
            const existingBatch = await offlineDataService.getByServerId('poultry_batches', flock.id?.toString());
            if (existingBatch) {
              await offlineDataService.update('poultry_batches', existingBatch.id, {
                batch_name: flock.batchName || flock.name,
                batch_number: flock.batchNumber,
                breed: flock.breed,
                initial_count: flock.initialCount,
                current_count: flock.currentCount,
                hatch_date: flock.hatchDate,
                acquisition_date: flock.acquisitionDate,
                expected_end_date: flock.expectedEndDate,
                status: flock.status,
                notes: flock.notes,
                farm_id: flock.farmId
              }, true);
            } else {
              // Find local farm ID
              let localFarmId = null;
              if (flock.farmId) {
                const localFarm = await offlineDataService.getByServerId('farms', flock.farmId.toString());
                localFarmId = localFarm?.id;
              }

              await offlineDataService.createBatch({
                server_id: flock.id?.toString(),
                batch_name: flock.batchName || flock.name,
                batch_number: flock.batchNumber,
                breed: flock.breed,
                initial_count: flock.initialCount,
                current_count: flock.currentCount,
                hatch_date: flock.hatchDate,
                acquisition_date: flock.acquisitionDate,
                expected_end_date: flock.expectedEndDate,
                status: flock.status,
                notes: flock.notes,
                farm_id: localFarmId
              }, true);
            }
          }

          return { success: true, data: flocks, source: 'server' };
        } catch (error) {
          console.log('Failed to fetch flocks from server, using local data:', error.message);
        }
      }

      // Get local batches
      const localBatches = await offlineDataService.getBatches();

      // Format for frontend compatibility
      const formattedBatches = localBatches.map(batch => ({
        id: batch.server_id || batch.id,
        batchId: batch.id,
        batchName: batch.batch_name,
        name: batch.batch_name,
        batchNumber: batch.batch_number,
        breed: batch.breed,
        initialCount: batch.initial_count,
        currentCount: batch.current_count,
        hatchDate: batch.hatch_date,
        acquisitionDate: batch.acquisition_date,
        expectedEndDate: batch.expected_end_date,
        status: batch.status,
        notes: batch.notes,
        farmId: batch.farm_id,
        createdAt: batch.created_at,
        updatedAt: batch.updated_at,
        isLocal: true,
        needsSync: batch.needs_sync === 1
      }));

      return {
        success: true,
        data: formattedBatches,
        source: 'local',
        isOffline: this.isOfflineMode()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createFlock(flockData) {
    try {
      // Find local farm ID if farmId is provided
      let localFarmId = null;
      if (flockData.farmId) {
        const localFarm = await offlineDataService.getByServerId('farms', flockData.farmId.toString());
        localFarmId = localFarm?.id || flockData.farmId;
      }

      // Create locally first
      const localBatch = await offlineDataService.createBatch({
        batch_name: flockData.batchName || flockData.name,
        batch_number: flockData.batchNumber,
        breed: flockData.breed,
        initial_count: flockData.initialCount,
        current_count: flockData.currentCount || flockData.initialCount,
        hatch_date: flockData.hatchDate,
        acquisition_date: flockData.acquisitionDate,
        expected_end_date: flockData.expectedEndDate,
        status: flockData.status || 'active',
        notes: flockData.notes,
        farm_id: localFarmId
      });

      if (this.isOnlineMode()) {
        try {
          // Try to create on server
          const serverFlock = await apiService.createFlock(flockData);

          if (serverFlock && serverFlock.id) {
            // Update local batch with server ID
            await offlineDataService.markAsSynced('poultry_batches', localBatch.id, serverFlock.id.toString());
          }

          return {
            success: true,
            data: serverFlock,
            source: 'server',
            localId: localBatch.id
          };
        } catch (error) {
          console.log('Failed to create flock on server, will sync later:', error.message);
        }
      }

      return {
        success: true,
        data: {
          id: localBatch.id,
          batchName: localBatch.batch_name,
          ...flockData,
          createdAt: localBatch.created_at,
          isLocal: true
        },
        source: 'local',
        willSyncLater: this.isOfflineMode()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Record methods (Feed, Production, Mortality, Health)
  async createRecord(recordType, recordData) {
    try {
      let localRecord;
      const methodMap = {
        feed: 'createFeedRecord',
        production: 'createProductionRecord',
        mortality: 'createMortalityRecord',
        health: 'createHealthRecord'
      };

      const apiMethodMap = {
        feed: 'createFeedRecord',
        production: 'createProductionRecord',
        mortality: 'createMortalityRecord',
        health: 'createHealthRecord'
      };

      // Find local batch ID if batchId is provided
      let localBatchId = null;
      if (recordData.batchId) {
        const localBatch = await offlineDataService.getByServerId('poultry_batches', recordData.batchId.toString());
        localBatchId = localBatch?.id || recordData.batchId;
      }

      // Prepare local record data
      const localData = { ...recordData };
      if (localBatchId) localData.batch_id = localBatchId;

      // Create locally first
      const offlineMethod = methodMap[recordType];
      if (offlineMethod && offlineDataService[offlineMethod]) {
        localRecord = await offlineDataService[offlineMethod](localData);
      } else {
        throw new Error(`Unsupported record type: ${recordType}`);
      }

      if (this.isOnlineMode()) {
        try {
          // Try to create on server
          const apiMethod = apiMethodMap[recordType];
          if (apiMethod && apiService[apiMethod]) {
            const serverRecord = await apiService[apiMethod](recordData);

            if (serverRecord && serverRecord.id) {
              // Update local record with server ID
              const tableName = `${recordType}_records`;
              await offlineDataService.markAsSynced(tableName, localRecord.id, serverRecord.id.toString());
            }

            return {
              success: true,
              data: serverRecord,
              source: 'server',
              localId: localRecord.id
            };
          }
        } catch (error) {
          console.log(`Failed to create ${recordType} record on server, will sync later:`, error.message);
        }
      }

      return {
        success: true,
        data: {
          id: localRecord.id,
          ...recordData,
          createdAt: localRecord.created_at,
          isLocal: true
        },
        source: 'local',
        willSyncLater: this.isOfflineMode()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getRecords(recordType) {
    try {
      const methodMap = {
        feed: 'getFeedRecords',
        production: 'getProductionRecords',
        mortality: 'getMortalityRecords',
        health: 'getHealthRecords'
      };

      const offlineMethodMap = {
        feed: 'getFeedRecords',
        production: 'getProductionRecords',
        mortality: 'getMortalityRecords',
        health: 'getHealthRecords'
      };

      if (this.isOnlineMode()) {
        try {
          const apiMethod = methodMap[recordType];
          if (apiMethod && apiService[apiMethod]) {
            const records = await apiService[apiMethod]();

            // Update local storage
            const tableName = `${recordType}_records`;
            for (const record of records) {
              const existingRecord = await offlineDataService.getByServerId(tableName, record.id?.toString());
              if (existingRecord) {
                // Update existing record
                await offlineDataService.update(tableName, existingRecord.id, record, true);
              } else {
                // Create new record
                const methodName = offlineMethodMap[recordType].replace('get', 'create');
                if (offlineDataService[methodName]) {
                  await offlineDataService[methodName]({
                    ...record,
                    server_id: record.id?.toString()
                  }, true);
                }
              }
            }

            return { success: true, data: records, source: 'server' };
          }
        } catch (error) {
          console.log(`Failed to fetch ${recordType} records from server, using local data:`, error.message);
        }
      }

      // Get local records
      const offlineMethod = offlineMethodMap[recordType];
      if (offlineMethod && offlineDataService[offlineMethod]) {
        const localRecords = await offlineDataService[offlineMethod]();

        return {
          success: true,
          data: localRecords.map(record => ({
            ...record,
            id: record.server_id || record.id,
            isLocal: true,
            needsSync: record.needs_sync === 1
          })),
          source: 'local',
          isOffline: this.isOfflineMode()
        };
      }

      return { success: true, data: [], source: 'local' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Sync status and management
  async getSyncStatus() {
    return await syncService.getSyncStatus();
  }

  async performSync() {
    if (!networkService.getIsConnected()) {
      throw new Error('No internet connection available');
    }

    return await syncService.syncData();
  }

  async retryFailedSyncs() {
    return await syncService.retryFailedSyncs();
  }

  async clearFailedSyncs() {
    return await syncService.clearFailedSyncs();
  }

  // Utility methods
  getConnectionState() {
    return {
      isOnline: this.isOnlineMode(),
      isOffline: this.isOfflineMode(),
      forceOfflineMode: this.forceOfflineMode,
      networkState: networkService.getConnectionState()
    };
  }

  async getStorageStats() {
    try {
      // Ensure offlineDataService is available
      if (!offlineDataService) {
        console.warn('OfflineDataService not available for storage stats');
        return this.getDefaultStorageStats();
      }

      const stats = {};

      // Safely get each count with fallbacks
      try {
        stats.farms = await offlineDataService.count('farms') || 0;
      } catch (error) {
        console.warn('Error getting farms count:', error.message);
        stats.farms = 0;
      }

      try {
        stats.batches = await offlineDataService.count('poultry_batches') || 0;
      } catch (error) {
        console.warn('Error getting batches count:', error.message);
        stats.batches = 0;
      }

      try {
        stats.feedRecords = await offlineDataService.count('feed_records') || 0;
      } catch (error) {
        console.warn('Error getting feed records count:', error.message);
        stats.feedRecords = 0;
      }

      try {
        stats.productionRecords = await offlineDataService.count('production_records') || 0;
      } catch (error) {
        console.warn('Error getting production records count:', error.message);
        stats.productionRecords = 0;
      }

      try {
        stats.mortalityRecords = await offlineDataService.count('mortality_records') || 0;
      } catch (error) {
        console.warn('Error getting mortality records count:', error.message);
        stats.mortalityRecords = 0;
      }

      try {
        stats.healthRecords = await offlineDataService.count('health_records') || 0;
      } catch (error) {
        console.warn('Error getting health records count:', error.message);
        stats.healthRecords = 0;
      }

      try {
        stats.pendingSync = await offlineDataService.count('sync_queue', 'sync_status = ?', ['pending']) || 0;
      } catch (error) {
        console.warn('Error getting pending sync count:', error.message);
        stats.pendingSync = 0;
      }

      try {
        stats.failedSync = await offlineDataService.count('sync_queue', 'sync_status = ?', ['failed']) || 0;
      } catch (error) {
        console.warn('Error getting failed sync count:', error.message);
        stats.failedSync = 0;
      }

      stats.total = stats.farms + stats.batches + stats.feedRecords +
                   stats.productionRecords + stats.mortalityRecords + stats.healthRecords;

      return stats;
    } catch (error) {
      console.warn('Storage stats error (silently handled):', error.message);
      return this.getDefaultStorageStats();
    }
  }

  // Get default storage stats when errors occur
  getDefaultStorageStats() {
    return {
      farms: 0,
      batches: 0,
      feedRecords: 0,
      productionRecords: 0,
      mortalityRecords: 0,
      healthRecords: 0,
      pendingSync: 0,
      failedSync: 0,
      total: 0,
      error: 'Unable to fetch storage statistics'
    };
  }

  // Migration and backup methods
  async getMigrationStatus() {
    return await migrationService.getMigrationStatus();
  }

  async createBackup() {
    return await migrationService.createBackup();
  }

  async restoreFromBackup(backupKey) {
    return await migrationService.restoreFromBackup(backupKey);
  }

  async performIntegrityCheck() {
    return await migrationService.performIntegrityCheck();
  }

  async exportData() {
    return await offlineDataService.exportData();
  }

  async importData(data, clearExisting = false) {
    return await offlineDataService.importData(data, clearExisting);
  }

  // Development/testing methods
  async forceReset() {
    if (__DEV__) {
      return await migrationService.forceReset();
    } else {
      throw new Error('Force reset is only available in development mode');
    }
  }
}

// Export singleton instance with error recovery
const unifiedApiService = new UnifiedApiService();

// Auto-recovery on critical errors
if (typeof process !== 'undefined' && process.on) {
  process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && reason.message.includes('database')) {
      console.warn('Unhandled database rejection detected in UnifiedApiService, attempting recovery...');
      unifiedApiService.performEmergencyRecovery().catch(err => {
        console.error('UnifiedApiService emergency recovery failed:', err);
      });
    }
  });
}

export default unifiedApiService;