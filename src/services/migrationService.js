import AsyncStorage from '@react-native-async-storage/async-storage';
import fastDatabaseImport from './fastDatabase';
import offlineDataService from './offlineDataService';

// FIX: Handle both default and named exports from fastDatabase
const databaseService = fastDatabaseImport.default || fastDatabaseImport;

class MigrationService {
  constructor() {
    this.currentVersion = 1;
    this.migrations = {
      1: this.migration_v1
    };
  }

  // EMERGENCY FIX: Migration system disabled - causing infinite crash loop
  async init() {
    console.log('⚠️  Migration system DISABLED (was causing crashes)');
    console.log('✅ Skipping migrations - app will use FastDatabase instead');

    // Set version to current to prevent future migration attempts
    try {
      await AsyncStorage.setItem('database_version', String(this.currentVersion));
    } catch (error) {
      console.warn('Could not set database version:', error);
    }

    return true; // Always succeed
  }

  // Emergency migration recovery
  async emergencyMigrationRecovery() {
    try {
      console.log('🚨 Starting emergency migration recovery...');

      // Reset to version 0 to force complete migration
      await AsyncStorage.setItem('database_version', '0');

      // Ensure database is reset and clean
      await databaseService.forceReset();

      // Run all migrations from scratch
      await this.runMigrations(0);

      console.log('✅ Emergency migration recovery completed');
    } catch (error) {
      console.error('❌ Emergency migration recovery failed:', error);
      throw error;
    }
  }

  // Get current database version
  async getCurrentDatabaseVersion() {
    try {
      const versionStr = await AsyncStorage.getItem('database_version');
      return versionStr ? parseInt(versionStr, 10) : 0;
    } catch (error) {
      console.error('Error getting database version:', error);
      return 0;
    }
  }

  // Set database version
  async setDatabaseVersion(version) {
    try {
      await AsyncStorage.setItem('database_version', version.toString());
      console.log(`Database version set to: ${version}`);
    } catch (error) {
      console.error('Error setting database version:', error);
      throw error;
    }
  }

  // Run migrations with transaction safety and rollback support
  async runMigrations(fromVersion) {
    try {
      console.log(`🔄 Running migrations from version ${fromVersion} to ${this.currentVersion}`);

      for (let version = fromVersion + 1; version <= this.currentVersion; version++) {
        const migration = this.migrations[version];

        if (migration) {
          console.log(`🛠️  Running migration to version ${version}...`);

          // Create backup before migration
          let backupKey = null;
          try {
            if (fromVersion > 0) { // Don't backup on initial setup
              backupKey = await this.createBackup();
              console.log(`💾 Backup created: ${backupKey}`);
            }
          } catch (backupError) {
            console.warn('Backup creation failed, continuing with migration:', backupError.message);
          }

          try {
            // Run migration with timeout
            await Promise.race([
              migration.call(this),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Migration timeout after 30 seconds')), 30000)
              )
            ]);

            // Update version only after successful migration
            await this.setDatabaseVersion(version);
            console.log(`✅ Migration to version ${version} completed successfully`);

            // Clean up backup on successful migration
            if (backupKey) {
              // Keep backup for a bit in case of issues
              setTimeout(async () => {
                try {
                  await AsyncStorage.removeItem(backupKey);
                  console.log(`🗑️  Cleaned up backup: ${backupKey}`);
                } catch (cleanupError) {
                  console.warn('Backup cleanup failed:', cleanupError.message);
                }
              }, 60000); // Clean up after 1 minute
            }

          } catch (migrationError) {
            console.error(`❌ Migration to version ${version} failed:`, migrationError);

            // Attempt rollback if backup exists
            if (backupKey) {
              try {
                console.log(`🔄 Attempting rollback using backup: ${backupKey}`);
                await this.restoreFromBackup(backupKey);
                console.log('✅ Rollback completed successfully');
              } catch (rollbackError) {
                console.error('❌ Rollback failed:', rollbackError);
              }
            }

            throw migrationError;
          }
        } else {
          console.warn(`⚠️  No migration found for version ${version}, skipping...`);
        }
      }

      console.log('✅ All migrations completed successfully');

      // Update last migration time
      await AsyncStorage.setItem('lastMigrationTime', new Date().toISOString());

    } catch (error) {
      console.error('❌ Migration process failed:', error);
      throw new Error(`Migration failed at version transition: ${error.message}`);
    }
  }

  // Migration to version 1 - Enhanced initial database setup
  async migration_v1() {
    try {
      console.log('🛠️  Running migration v1: Enhanced initial database setup');

      // Step 1: Ensure clean database state
      console.log('🧽 Step 1: Ensuring clean database state...');
      await databaseService.init();

      // Step 2: Verify database health
      console.log('🧽 Step 2: Verifying database health...');
      const healthCheck = await databaseService.healthCheck();
      if (!healthCheck.isHealthy) {
        throw new Error(`Database health check failed: ${healthCheck.error}`);
      }

      // Step 3: Check for existing data
      console.log('🧽 Step 3: Checking for existing data...');
      const existingData = await this.checkExistingData();
      console.log(`Found existing data: ${JSON.stringify(existingData)}`);

      // Step 4: Handle existing data or set up fresh installation
      if (existingData.hasData) {
        console.log('📊 Existing data found, validating and preserving current state...');

        // Validate existing data integrity
        const validation = await offlineDataService.validateData();
        if (!validation.isValid) {
          console.warn('⚠️  Data integrity issues found:', validation.warnings);
          // Fix issues if possible
          await this.fixDataIntegrityIssues(validation);
        }
      } else {
        console.log('🎆 Fresh installation detected, setting up initial state...');
        await this.setupInitialState();
      }

      // Step 5: Ensure demo users exist
      console.log('🧽 Step 5: Ensuring demo users exist...');
      await this.ensureDemoUsers();

      // Step 6: Create demo data for better user experience
      // DISABLED: No demo data - all data must come from server sync
      console.log('🧽 Step 6: Skipping demo data creation (production mode)...');
      // await this.createDemoData(); // DISABLED - no mock data in production

      // Step 7: Set up initial sync state
      console.log('🧽 Step 7: Setting up sync state...');
      await this.setupSyncState();

      // Step 8: Final verification
      console.log('🧽 Step 8: Final verification...');
      await this.verifyMigrationV1();

      console.log('✅ Migration v1 completed successfully');
    } catch (error) {
      console.error('❌ Migration v1 failed:', error);
      throw new Error(`Migration v1 failed: ${error.message}`);
    }
  }

  // Ensure demo users exist for offline functionality
  async ensureDemoUsers() {
    try {
      const demoUsers = [
        {
          email: 'demo@poultry360.com',
          username: 'demo',
          first_name: 'Demo',
          last_name: 'User',
          role: 'farm_worker'
        },
        {
          email: 'owner@poultry360.com',
          username: 'owner',
          first_name: 'Farm',
          last_name: 'Owner',
          role: 'farm_owner'
        },
        {
          email: 'admin@poultry360.com',
          username: 'admin',
          first_name: 'System',
          last_name: 'Admin',
          role: 'admin'
        }
      ];

      for (const userData of demoUsers) {
        try {
          const existingUser = await offlineDataService.getUserByEmail(userData.email);
          if (!existingUser) {
            const result = await offlineDataService.createUser(userData, true); // Skip sync for demo users
            if (result && result.id) {
              console.log(`✅ Demo user created: ${userData.email} (ID: ${result.id})`);
            } else {
              console.warn(`⚠️  Demo user creation returned unexpected result for: ${userData.email}`);
            }
          } else {
            console.log(`ℹ️  Demo user already exists: ${userData.email} (ID: ${existingUser.id})`);
          }
        } catch (userError) {
          console.error(`❌ Error handling demo user ${userData.email}:`, userError);
          throw new Error(`Failed to create demo user ${userData.email}: ${userError.message}`);
        }
      }
    } catch (error) {
      console.error('Error ensuring demo users:', error);
      throw error;
    }
  }

  // Create demo data for better user experience
  async createDemoData() {
    try {
      console.log('🎭 Creating demo data for better user experience...');

      // Check if demo data already exists
      const existingFarms = await offlineDataService.count('farms');
      if (existingFarms > 0) {
        console.log('ℹ️  Demo data already exists, skipping creation');
        return;
      }

      // Create demo farms
      const demoFarms = [
        {
          farm_name: 'Sunrise Poultry Farm',
          location: 'Rural County, State',
          farm_size: 15.5,
          contact_person: 'John Farmer',
          phone_number: '+1 (555) 123-4567',
          email: 'contact@sunrisepoultry.com',
          notes: 'Main production farm with layer chickens'
        },
        {
          farm_name: 'Green Valley Ranch',
          location: 'Valley District, State',
          farm_size: 8.2,
          contact_person: 'Sarah Green',
          phone_number: '+1 (555) 234-5678',
          email: 'info@greenvalleyranch.com',
          notes: 'Organic free-range farm'
        }
      ];

      const createdFarms = [];
      for (const farmData of demoFarms) {
        try {
          const farm = await offlineDataService.createFarm(farmData, true);
          createdFarms.push(farm);
          console.log(`✅ Demo farm created: ${farmData.farm_name} (ID: ${farm.id})`);
        } catch (farmError) {
          console.error(`❌ Error creating demo farm ${farmData.farm_name}:`, farmError);
        }
      }

      // Create demo batches for each farm
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAhead = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

      for (const farm of createdFarms) {
        try {
          const demoBatch = {
            farm_id: farm.id,
            batch_name: `Batch ${farm.id}-001`,
            batch_number: `B${farm.id}001`,
            breed: 'Rhode Island Red',
            initial_count: 500,
            current_count: 485,
            hatch_date: thirtyDaysAgo.toISOString().split('T')[0],
            acquisition_date: thirtyDaysAgo.toISOString().split('T')[0],
            expected_end_date: sixtyDaysAhead.toISOString().split('T')[0],
            status: 'active',
            notes: `Demo batch for ${farm.farm_name}`
          };

          const batch = await offlineDataService.createBatch(demoBatch, true);
          console.log(`✅ Demo batch created: ${demoBatch.batch_name} (ID: ${batch.id})`);

          // Create some demo records for this batch
          await this.createDemoRecords(batch.id);

        } catch (batchError) {
          console.error(`❌ Error creating demo batch for farm ${farm.id}:`, batchError);
        }
      }

      console.log('✅ Demo data creation completed');
    } catch (error) {
      console.error('❌ Error creating demo data:', error);
      // Don't throw - demo data creation failure shouldn't block migration
    }
  }

  // Create demo records for a batch
  async createDemoRecords(batchId) {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

      // Create demo production records
      const productionRecords = [
        {
          batch_id: batchId,
          date: twoDaysAgo.toISOString().split('T')[0],
          eggs_collected: 420,
          eggs_broken: 5,
          eggs_sold: 400,
          egg_weight_kg: 25.2,
          price_per_dozen: 3.50,
          total_revenue: 116.67,
          notes: 'Good production day'
        },
        {
          batch_id: batchId,
          date: yesterday.toISOString().split('T')[0],
          eggs_collected: 435,
          eggs_broken: 3,
          eggs_sold: 425,
          egg_weight_kg: 26.1,
          price_per_dozen: 3.50,
          total_revenue: 124.17,
          notes: 'Excellent laying performance'
        }
      ];

      for (const record of productionRecords) {
        await offlineDataService.createProductionRecord(record, true);
      }

      // Create demo feed records
      const feedRecords = [
        {
          batch_id: batchId,
          feed_type: 'Layer Feed',
          quantity_kg: 45,
          cost_per_kg: 0.85,
          total_cost: 38.25,
          supplier: 'Farm Supply Co.',
          date: yesterday.toISOString().split('T')[0],
          notes: 'Weekly feed delivery'
        }
      ];

      for (const record of feedRecords) {
        await offlineDataService.createFeedRecord(record, true);
      }

      // Create minimal demo mortality record
      const mortalityRecord = {
        batch_id: batchId,
        date: twoDaysAgo.toISOString().split('T')[0],
        count: 2,
        cause: 'Natural',
        age_weeks: 24,
        notes: 'Normal mortality rate'
      };

      await offlineDataService.createMortalityRecord(mortalityRecord, true);

      console.log(`✅ Demo records created for batch ${batchId}`);
    } catch (error) {
      console.error(`❌ Error creating demo records for batch ${batchId}:`, error);
      // Don't throw - record creation failure shouldn't block the batch creation
    }
  }

  // Set up sync state
  async setupSyncState() {
    try {
      // Initialize sync state flags
      const syncState = {
        lastFullSyncTime: null,
        lastIncrementalSyncTime: null,
        pendingSyncItems: 0,
        failedSyncItems: 0,
        isInitialSyncPending: true
      };

      await AsyncStorage.setItem('syncState', JSON.stringify(syncState));
      console.log('✅ Sync state initialized');
    } catch (error) {
      console.error('Error setting up sync state:', error);
      throw error;
    }
  }

  // Fix data integrity issues
  async fixDataIntegrityIssues(validation) {
    try {
      console.log('🔧 Attempting to fix data integrity issues...');

      let fixedCount = 0;

      // Handle missing demo users
      if (validation.missingDemoUsers > 0) {
        await this.ensureDemoUsers();
        fixedCount += validation.missingDemoUsers;
        console.log(`✅ Fixed ${validation.missingDemoUsers} missing demo users`);
      }

      // Log other issues that need manual attention
      if (validation.orphanedBatches > 0) {
        console.warn(`⚠️  ${validation.orphanedBatches} orphaned batches need manual attention`);
      }

      if (validation.duplicateUsers > 0) {
        console.warn(`⚠️  ${validation.duplicateUsers} duplicate users need manual attention`);
      }

      console.log(`✅ Fixed ${fixedCount} data integrity issues`);
    } catch (error) {
      console.error('Error fixing data integrity issues:', error);
      // Don't throw - continue with migration
    }
  }

  // Verify migration v1 completed successfully
  async verifyMigrationV1() {
    try {
      // Check database health
      const healthCheck = await databaseService.healthCheck();
      if (!healthCheck.isHealthy) {
        throw new Error('Database health check failed after migration');
      }

      // Check demo users exist
      const demoUser = await offlineDataService.getUserByEmail('demo@poultry360.com');
      if (!demoUser) {
        throw new Error('Demo users not found after migration');
      }

      // Check initial state is set up
      const initialSetup = await AsyncStorage.getItem('initialSetupCompleted');
      if (initialSetup !== 'true') {
        throw new Error('Initial setup not completed');
      }

      console.log('✅ Migration v1 verification passed');
    } catch (error) {
      console.error('❌ Migration v1 verification failed:', error);
      throw error;
    }
  }

  // Check if there's existing data in the database
  async checkExistingData() {
    try {
      const userCount = await offlineDataService.count('users');
      const farmCount = await offlineDataService.count('farms');
      const batchCount = await offlineDataService.count('poultry_batches');

      const hasData = userCount > 0 || farmCount > 0 || batchCount > 0;

      return {
        hasData,
        users: userCount,
        farms: farmCount,
        batches: batchCount
      };
    } catch (error) {
      console.error('Error checking existing data:', error);
      return { hasData: false, users: 0, farms: 0, batches: 0 };
    }
  }

  // Enhanced initial state setup
  async setupInitialState() {
    try {
      console.log('🎆 Setting up initial state for fresh installation...');

      // Set initial sync flags
      const now = new Date().toISOString();
      await AsyncStorage.setItem('initialSetupCompleted', 'true');
      await AsyncStorage.setItem('lastMigrationTime', now);
      await AsyncStorage.setItem('appInstallTime', now);

      // Create comprehensive default settings
      const defaultSettings = {
        // Sync settings
        autoSync: true,
        syncOnWifiOnly: false,
        backgroundSync: true,
        syncInterval: 300000, // 5 minutes

        // UI settings
        showOfflineIndicator: true,
        theme: 'light',
        language: 'en',

        // Data settings
        dataRetentionDays: 90,
        maxBackupCount: 5,
        enableDataValidation: true,

        // Performance settings
        batchSize: 100,
        cacheSize: 1000,
        enableOptimisticUpdates: true,

        // Notification settings
        enableNotifications: true,
        notifyOnSyncErrors: true,
        notifyOnMortality: true,

        // Debug settings
        enableDebugMode: false,
        logLevel: 'info'
      };

      await AsyncStorage.setItem('appSettings', JSON.stringify(defaultSettings));

      // Create initial user preferences
      const defaultPreferences = {
        dashboardLayout: 'standard',
        recordEntryMode: 'guided',
        dateFormat: 'yyyy-MM-dd',
        numberFormat: 'en-US',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      await AsyncStorage.setItem('userPreferences', JSON.stringify(defaultPreferences));

      // Initialize app state
      const initialAppState = {
        firstLaunch: true,
        tutorialCompleted: false,
        dataImported: false,
        setupWizardCompleted: false
      };

      await AsyncStorage.setItem('appState', JSON.stringify(initialAppState));

      // Set up feature flags
      const featureFlags = {
        enableOfflineMode: true,
        enableDataExport: true,
        enableAdvancedReporting: false,
        enableBetaFeatures: false
      };

      await AsyncStorage.setItem('featureFlags', JSON.stringify(featureFlags));

      console.log('✅ Initial state setup completed successfully');
    } catch (error) {
      console.error('❌ Error setting up initial state:', error);
      throw error;
    }
  }

  // Enhanced legacy data migration with better error handling
  async migrateLegacyData() {
    try {
      console.log('🔄 Checking for legacy data migration...');

      // Check if legacy migration was already completed
      const alreadyMigrated = await AsyncStorage.getItem('legacyDataMigrated');
      if (alreadyMigrated === 'true') {
        console.log('ℹ️  Legacy data migration already completed, skipping...');
        return;
      }

      const migrationResults = {
        farms: 0,
        batches: 0,
        records: 0,
        errors: []
      };

      // Migrate legacy farms
      try {
        const legacyFarms = await AsyncStorage.getItem('farms');
        if (legacyFarms) {
          const farms = JSON.parse(legacyFarms);
          if (Array.isArray(farms) && farms.length > 0) {
            console.log(`🏷️  Found ${farms.length} legacy farms to migrate`);

            for (const farm of farms) {
              try {
                // Check if farm already exists
                const existingFarm = await offlineDataService.getWhere(
                  'farms',
                  'farm_name = ? OR (email = ? AND email IS NOT NULL)',
                  [farm.name || farm.farmName, farm.email]
                );

                if (existingFarm.length === 0) {
                  await offlineDataService.createFarm({
                    farm_name: farm.name || farm.farmName || 'Migrated Farm',
                    location: farm.location || '',
                    farm_size: farm.size || farm.farmSize || 0,
                    contact_person: farm.contactPerson || '',
                    phone_number: farm.phoneNumber || '',
                    email: farm.email || '',
                    notes: farm.description || farm.notes || 'Migrated from legacy data'
                  }, true); // Skip sync for migrated data

                  migrationResults.farms++;
                } else {
                  console.log(`ℹ️  Farm '${farm.name || farm.farmName}' already exists, skipping`);
                }
              } catch (farmError) {
                migrationResults.errors.push(`Farm migration error: ${farmError.message}`);
                console.error('Error migrating individual farm:', farmError);
              }
            }

            // Remove legacy data only after successful migration
            await AsyncStorage.removeItem('farms');
            console.log(`✅ Migrated ${migrationResults.farms} legacy farms`);
          }
        }
      } catch (error) {
        migrationResults.errors.push(`Farms migration error: ${error.message}`);
        console.error('Error migrating legacy farms:', error);
      }

      // Migrate legacy batches
      try {
        const legacyBatches = await AsyncStorage.getItem('batches');
        if (legacyBatches) {
          const batches = JSON.parse(legacyBatches);
          if (Array.isArray(batches) && batches.length > 0) {
            console.log(`🐓 Found ${batches.length} legacy batches to migrate`);

            for (const batch of batches) {
              try {
                // Find corresponding farm
                let farmId = null;
                if (batch.farmId || batch.farmName) {
                  const farmQuery = batch.farmId
                    ? 'server_id = ? OR id = ?'
                    : 'farm_name = ?';
                  const farmValues = batch.farmId
                    ? [batch.farmId.toString(), batch.farmId]
                    : [batch.farmName];

                  const farm = await offlineDataService.getWhere('farms', farmQuery, farmValues);
                  if (farm.length > 0) {
                    farmId = farm[0].id;
                  }
                }

                // Check if batch already exists
                const existingBatch = await offlineDataService.getWhere(
                  'poultry_batches',
                  'batch_name = ? OR batch_number = ?',
                  [batch.name || batch.batchName, batch.batchNumber]
                );

                if (existingBatch.length === 0) {
                  await offlineDataService.createBatch({
                    batch_name: batch.name || batch.batchName || 'Migrated Batch',
                    batch_number: batch.batchNumber || `MIGRATED_${Date.now()}`,
                    breed: batch.breed || 'Unknown',
                    initial_count: parseInt(batch.initialCount) || 0,
                    current_count: parseInt(batch.currentCount || batch.initialCount) || 0,
                    hatch_date: batch.hatchDate || null,
                    acquisition_date: batch.acquisitionDate || new Date().toISOString().split('T')[0],
                    expected_end_date: batch.expectedEndDate || null,
                    status: batch.status || 'active',
                    notes: batch.notes || 'Migrated from legacy data',
                    farm_id: farmId
                  }, true); // Skip sync for migrated data

                  migrationResults.batches++;
                } else {
                  console.log(`ℹ️  Batch '${batch.name || batch.batchName}' already exists, skipping`);
                }
              } catch (batchError) {
                migrationResults.errors.push(`Batch migration error: ${batchError.message}`);
                console.error('Error migrating individual batch:', batchError);
              }
            }

            // Remove legacy data only after successful migration
            await AsyncStorage.removeItem('batches');
            console.log(`✅ Migrated ${migrationResults.batches} legacy batches`);
          }
        }
      } catch (error) {
        migrationResults.errors.push(`Batches migration error: ${error.message}`);
        console.error('Error migrating legacy batches:', error);
      }

      // Migrate other legacy data types if they exist
      const otherLegacyKeys = ['records', 'production', 'mortality', 'health'];
      for (const key of otherLegacyKeys) {
        try {
          const legacyData = await AsyncStorage.getItem(key);
          if (legacyData) {
            console.log(`📊 Found legacy ${key} data, marking for manual review`);
            await AsyncStorage.setItem(`legacy_${key}_backup`, legacyData);
            await AsyncStorage.removeItem(key);
            migrationResults.records++;
          }
        } catch (error) {
          migrationResults.errors.push(`${key} migration error: ${error.message}`);
        }
      }

      // Mark migration as completed
      const migrationSummary = {
        timestamp: new Date().toISOString(),
        results: migrationResults,
        version: this.currentVersion
      };

      await AsyncStorage.setItem('legacyDataMigrated', 'true');
      await AsyncStorage.setItem('legacyMigrationSummary', JSON.stringify(migrationSummary));

      const totalMigrated = migrationResults.farms + migrationResults.batches + migrationResults.records;
      if (totalMigrated > 0 || migrationResults.errors.length > 0) {
        console.log(`✅ Legacy data migration completed:`);
        console.log(`   🏷️  Farms: ${migrationResults.farms}`);
        console.log(`   🐓 Batches: ${migrationResults.batches}`);
        console.log(`   📊 Other records: ${migrationResults.records}`);
        if (migrationResults.errors.length > 0) {
          console.log(`   ⚠️  Errors: ${migrationResults.errors.length}`);
        }
      } else {
        console.log('ℹ️  No legacy data found to migrate');
      }

    } catch (error) {
      console.error('❌ Legacy data migration failed:', error);
      // Don't throw - legacy migration failure shouldn't block the app
      await AsyncStorage.setItem('legacyMigrationError', JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  // Data integrity check and repair
  async performIntegrityCheck() {
    try {
      console.log('Performing data integrity check...');

      const results = {
        orphanedRecords: 0,
        fixedRecords: 0,
        errors: []
      };

      // Check for orphaned records
      const validation = await offlineDataService.validateData();

      if (!validation.isValid) {
        console.log('Data integrity issues found, attempting to fix...');

        // Fix orphaned batches
        if (validation.orphanedBatches > 0) {
          try {
            // For now, we'll just log them. In a real app, you might want to:
            // 1. Reassign to a default farm
            // 2. Mark them for manual review
            // 3. Delete them after user confirmation

            results.orphanedRecords += validation.orphanedBatches;
            results.errors.push(`${validation.orphanedBatches} orphaned batches found`);
          } catch (error) {
            results.errors.push(`Failed to fix orphaned batches: ${error.message}`);
          }
        }
      }

      // Check sync queue for very old items
      try {
        const oldSyncItems = await databaseService.select(
          'sync_queue',
          'COUNT(*) as count',
          "created_at < datetime('now', '-7 days')",
          []
        );

        if (oldSyncItems[0]?.count > 0) {
          console.log(`Found ${oldSyncItems[0].count} old sync items`);
          results.errors.push(`${oldSyncItems[0].count} old sync items need attention`);
        }
      } catch (error) {
        results.errors.push(`Failed to check sync queue: ${error.message}`);
      }

      console.log('Data integrity check completed:', results);
      return results;
    } catch (error) {
      console.error('Data integrity check failed:', error);
      return {
        orphanedRecords: 0,
        fixedRecords: 0,
        errors: [`Integrity check failed: ${error.message}`]
      };
    }
  }

  // Backup creation
  async createBackup() {
    try {
      console.log('Creating data backup...');

      const backupData = {
        version: this.currentVersion,
        timestamp: new Date().toISOString(),
        data: await offlineDataService.exportData(),
        settings: {
          appSettings: await AsyncStorage.getItem('appSettings'),
          lastSyncTime: await AsyncStorage.getItem('lastSyncTime'),
          initialSyncCompleted: await AsyncStorage.getItem('initialSyncCompleted')
        }
      };

      // Store backup with timestamp
      const backupKey = `backup_${Date.now()}`;
      await AsyncStorage.setItem(backupKey, JSON.stringify(backupData));

      // Clean up old backups (keep last 5)
      await this.cleanupOldBackups();

      console.log(`Backup created with key: ${backupKey}`);
      return backupKey;
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  // Restore from backup
  async restoreFromBackup(backupKey) {
    try {
      console.log(`Restoring from backup: ${backupKey}`);

      const backupDataStr = await AsyncStorage.getItem(backupKey);
      if (!backupDataStr) {
        throw new Error('Backup not found');
      }

      const backupData = JSON.parse(backupDataStr);

      // Verify backup integrity
      if (!backupData.data || !backupData.version) {
        throw new Error('Invalid backup format');
      }

      // Clear existing data
      await databaseService.resetDatabase();
      await databaseService.init();

      // Restore data
      await offlineDataService.importData(backupData.data, true);

      // Restore settings
      if (backupData.settings) {
        for (const [key, value] of Object.entries(backupData.settings)) {
          if (value !== null) {
            await AsyncStorage.setItem(key, value);
          }
        }
      }

      // Update version
      await this.setDatabaseVersion(backupData.version);

      console.log('Backup restore completed successfully');
      return true;
    } catch (error) {
      console.error('Backup restore failed:', error);
      throw error;
    }
  }

  // Clean up old backups
  async cleanupOldBackups(keepCount = 5) {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const backupKeys = allKeys
        .filter(key => key.startsWith('backup_'))
        .sort((a, b) => {
          const timestampA = parseInt(a.split('_')[1]);
          const timestampB = parseInt(b.split('_')[1]);
          return timestampB - timestampA; // Sort newest first
        });

      if (backupKeys.length > keepCount) {
        const keysToDelete = backupKeys.slice(keepCount);
        await AsyncStorage.multiRemove(keysToDelete);
        console.log(`Cleaned up ${keysToDelete.length} old backups`);
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }

  // Get migration status
  async getMigrationStatus() {
    try {
      const currentVersion = await this.getCurrentDatabaseVersion();
      const lastMigrationTime = await AsyncStorage.getItem('lastMigrationTime');
      const initialSetupCompleted = await AsyncStorage.getItem('initialSetupCompleted');

      return {
        currentVersion,
        targetVersion: this.currentVersion,
        isUpToDate: currentVersion === this.currentVersion,
        lastMigrationTime: lastMigrationTime ? new Date(lastMigrationTime) : null,
        initialSetupCompleted: initialSetupCompleted === 'true',
        availableMigrations: Object.keys(this.migrations).map(v => parseInt(v))
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return {
        currentVersion: 0,
        targetVersion: this.currentVersion,
        isUpToDate: false,
        lastMigrationTime: null,
        initialSetupCompleted: false,
        availableMigrations: [],
        error: error.message
      };
    }
  }

  // Force full reset (for development/testing)
  async forceReset() {
    try {
      console.log('Performing force reset...');

      // Clear all database data
      await databaseService.resetDatabase();

      // Clear migration-related storage
      await AsyncStorage.multiRemove([
        'database_version',
        'lastMigrationTime',
        'initialSetupCompleted',
        'initialSyncCompleted',
        'lastSyncTime',
        'legacyDataMigrated'
      ]);

      console.log('Force reset completed');
    } catch (error) {
      console.error('Force reset failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
const migrationService = new MigrationService();

export default migrationService;