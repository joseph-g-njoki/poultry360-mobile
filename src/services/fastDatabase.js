import { openDatabaseSync } from 'expo-sqlite';

class FastDatabaseService {
  constructor() {
    this.db = null;
    this.isReady = false;
  }

  // CRASH FIX: INSTANT initialization - WITH PROPER ERROR REPORTING AND NULL PREVENTION
  init() {
    try {
      if (this.isReady && this.db) {
        console.log('✅ FastDatabase: Already initialized');
        // CRITICAL FIX: Double-check database is actually valid
        try {
          this.db.getFirstSync('SELECT 1 as test');
          console.log('✅ FastDatabase: Database connection verified');
          return true;
        } catch (verifyError) {
          console.error('❌ FastDatabase: Database connection invalid, reinitializing...');
          this.db = null;
          this.isReady = false;
          // Fall through to reinitialize
        }
      }

      console.log('🔄 FastDatabase: Starting initialization...');

      // CRITICAL FIX: Open database with explicit null check
      this.db = openDatabaseSync('poultry360_offline.db');

      if (!this.db) {
        console.error('❌ CRITICAL: openDatabaseSync returned NULL');
        throw new Error('openDatabaseSync returned null database');
      }

      console.log('✅ FastDatabase: Database file opened');

      // CRITICAL FIX: Test database connection IMMEDIATELY
      try {
        const testResult = this.db.getFirstSync('SELECT 1 as test');
        if (!testResult || testResult.test !== 1) {
          throw new Error('Database connectivity test failed - invalid result');
        }
        console.log('✅ FastDatabase: Database connectivity verified');
      } catch (testError) {
        console.error('❌ CRITICAL: Database connectivity test failed:', testError);
        this.db = null;
        throw new Error(`Database connectivity test failed: ${testError.message}`);
      }

      // Enable foreign keys
      this.db.execSync('PRAGMA foreign_keys = ON;');
      console.log('✅ FastDatabase: Foreign keys enabled');

      // Create minimal tables only if they don't exist
      this.createBasicTablesIfNeeded();

      // CRITICAL FIX: Migrate existing tables to add is_deleted column if missing
      this.migrateAddIsDeletedColumn();

      this.isReady = true;
      console.log('✅ FastDatabase: Initialization complete - database is READY');
      return true;
    } catch (error) {
      console.error('❌ FastDatabase: Init failed, attempting fallback:', error);

      // Silent fallback - create in-memory database
      try {
        this.db = openDatabaseSync(':memory:');

        if (!this.db) {
          console.error('❌ CRITICAL: In-memory database also returned NULL');
          throw new Error('In-memory database creation failed - null database');
        }

        // Test in-memory database
        try {
          const testResult = this.db.getFirstSync('SELECT 1 as test');
          if (!testResult || testResult.test !== 1) {
            throw new Error('In-memory database test failed');
          }
        } catch (testError) {
          console.error('❌ CRITICAL: In-memory database test failed:', testError);
          this.db = null;
          throw new Error(`In-memory database test failed: ${testError.message}`);
        }

        console.log('⚠️ FastDatabase: Using in-memory fallback database');
        this.createBasicTablesIfNeeded();
        this.isReady = true;
        console.log('✅ FastDatabase: Fallback initialization complete - IN-MEMORY MODE');
        return true;
      } catch (fallbackError) {
        console.error('❌ FastDatabase: Even fallback failed:', fallbackError);
        // CRITICAL FIX: ENSURE database is NULL and isReady is FALSE
        this.isReady = false;
        this.db = null;

        // IMPORTANT: Throw instead of silent failure
        throw new Error(`Database initialization failed completely: ${fallbackError.message}`);
      }
    }
  }

  // CRITICAL FIX: Global database state verification - NEVER THROWS, ALWAYS HANDLES GRACEFULLY
  // This method attempts to initialize database if needed, returns true/false for success
  ensureDatabaseReady() {
    if (this.isReady && this.db) {
      // Database is ready, verify it's still working
      try {
        this.db.getFirstSync('SELECT 1 as test');
        return true;
      } catch (testError) {
        console.error('❌ Database connection lost, attempting recovery:', testError.message);
        this.db = null;
        this.isReady = false;
        // Fall through to re-initialize
      }
    }

    // Database not ready or connection lost - attempt to initialize
    try {
      console.log('🔄 Database not ready, attempting initialization...');
      const initResult = this.init();

      if (!initResult || !this.db || !this.isReady) {
        console.error('❌ Database initialization failed - operations will use fallback mode');
        return false;
      }

      console.log('✅ Database initialized successfully');
      return true;
    } catch (initError) {
      console.error('❌ Database initialization threw error:', initError.message);
      return false;
    }
  }

  // CRITICAL FIX: Migration to add is_deleted column to existing tables
  migrateAddIsDeletedColumn() {
    try {
      console.log('🔄 FastDatabase: Checking for is_deleted column migration...');

      const tablesToMigrate = [
        'users', 'farms', 'poultry_batches', 'feed_records', 'health_records',
        'mortality_records', 'production_records', 'water_records', 'weight_records', 'expenses'
      ];

      for (const tableName of tablesToMigrate) {
        try {
          // Check if table exists
          const tableExists = this.db.getFirstSync(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [tableName]
          );

          if (!tableExists) {
            console.log(`⏭️  FastDatabase: Table ${tableName} doesn't exist, skipping migration`);
            continue;
          }

          // Check if is_deleted column already exists
          const columns = this.db.getAllSync(`PRAGMA table_info(${tableName})`);
          const hasIsDeleted = columns.some(col => col.name === 'is_deleted');

          if (hasIsDeleted) {
            console.log(`✅ FastDatabase: Table ${tableName} already has is_deleted column`);
            continue;
          }

          // Add is_deleted column
          console.log(`🔄 FastDatabase: Adding is_deleted column to ${tableName}...`);
          this.db.execSync(`ALTER TABLE ${tableName} ADD COLUMN is_deleted INTEGER DEFAULT 0`);
          console.log(`✅ FastDatabase: Added is_deleted column to ${tableName}`);

        } catch (tableError) {
          console.warn(`⚠️  FastDatabase: Failed to migrate table ${tableName}:`, tableError.message);
          // Continue with other tables even if one fails
        }
      }

      console.log('✅ FastDatabase: Migration check complete');

    } catch (error) {
      console.error('❌ FastDatabase: Migration failed:', error);
      // Don't throw - migration is optional for existing databases
      console.warn('⚠️  FastDatabase: Continuing without migration');
    }
  }

  createBasicTablesIfNeeded() {
    try {
      console.log('🔄 FastDatabase: Creating basic tables if needed...');

      // Check if tables already exist
      const existingTables = this.db.getAllSync(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`);
      console.log('📋 FastDatabase: Existing tables:', existingTables.map(t => t.name));

      const requiredTables = ['users', 'farms', 'poultry_batches', 'feed_records', 'health_records', 'mortality_records', 'production_records', 'water_records', 'weight_records', 'expenses'];
      const missingTables = requiredTables.filter(table => !existingTables.some(t => t.name === table));

      if (missingTables.length === 0) {
        console.log('✅ FastDatabase: All required tables already exist');
        return;
      }

      console.log('🔄 FastDatabase: Missing tables:', missingTables);
      console.log('🔄 FastDatabase: Creating missing tables...');

      // Create only missing tables
      if (missingTables.includes('users')) {
        this.db.execSync(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            first_name TEXT,
            last_name TEXT,
            role TEXT DEFAULT 'farm_worker',
            organization_id INTEGER DEFAULT 1,
            organization_name TEXT DEFAULT 'Demo Organization',
            organization_slug TEXT DEFAULT 'demo-org',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0
          );
        `);
        console.log('✅ FastDatabase: Created users table');
      }

      if (missingTables.includes('farms')) {
        this.db.execSync(`
          CREATE TABLE farms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_name TEXT NOT NULL,
            location TEXT,
            farm_type TEXT DEFAULT 'broiler',
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0
          );
        `);
        console.log('✅ FastDatabase: Created farms table');
      }

      if (missingTables.includes('poultry_batches')) {
        this.db.execSync(`
          CREATE TABLE poultry_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_name TEXT NOT NULL,
            breed TEXT,
            initial_count INTEGER DEFAULT 0,
            current_count INTEGER DEFAULT 0,
            farm_id INTEGER,
            arrival_date TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created poultry_batches table');
      }

      if (missingTables.includes('feed_records')) {
        this.db.execSync(`
          CREATE TABLE feed_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_id INTEGER,
            batch_id INTEGER,
            date TEXT,
            quantity REAL,
            feed_type TEXT,
            cost REAL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created feed_records table');
      }

      if (missingTables.includes('health_records')) {
        this.db.execSync(`
          CREATE TABLE health_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_id INTEGER,
            batch_id INTEGER,
            date TEXT,
            health_status TEXT,
            treatment TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created health_records table');
      }

      if (missingTables.includes('mortality_records')) {
        this.db.execSync(`
          CREATE TABLE mortality_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_id INTEGER,
            batch_id INTEGER,
            date TEXT,
            count INTEGER,
            cause TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created mortality_records table');
      }

      if (missingTables.includes('production_records')) {
        this.db.execSync(`
          CREATE TABLE production_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_id INTEGER,
            batch_id INTEGER,
            date TEXT,
            eggs_collected INTEGER,
            weight REAL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created production_records table');
      }

      if (missingTables.includes('water_records')) {
        this.db.execSync(`
          CREATE TABLE water_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            farm_id INTEGER,
            date_recorded TEXT NOT NULL,
            quantity_liters REAL NOT NULL,
            water_source TEXT,
            quality TEXT,
            temperature REAL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created water_records table');
      }

      if (missingTables.includes('weight_records')) {
        this.db.execSync(`
          CREATE TABLE weight_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            farm_id INTEGER,
            date_recorded TEXT NOT NULL,
            average_weight REAL NOT NULL,
            sample_size INTEGER NOT NULL,
            weight_unit TEXT DEFAULT 'grams',
            min_weight REAL,
            max_weight REAL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created weight_records table');
      }

      if (missingTables.includes('expenses')) {
        this.db.execSync(`
          CREATE TABLE expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_id INTEGER,
            batch_id INTEGER,
            category TEXT NOT NULL,
            subcategory TEXT,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            expense_date TEXT NOT NULL,
            supplier TEXT,
            receipt_number TEXT,
            receipt_url TEXT,
            payment_method TEXT DEFAULT 'cash',
            notes TEXT,
            is_recurring INTEGER DEFAULT 0,
            recurring_frequency TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE SET NULL
          );
        `);
        console.log('✅ FastDatabase: Created expenses table');
      }

      // Verify tables were created
      const tables = this.db.getAllSync(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`);
      console.log('✅ FastDatabase: Created tables:', tables.map(t => t.name));

      // No demo data - all data should be saved by users in the database

    } catch (error) {
      console.error('❌ FastDatabase: Table creation failed:', error);
      console.error('❌ FastDatabase: Error details:', error.message);
      // CRASH FIX: DON'T throw - log and continue
      // App can work with empty tables or retry later
      console.warn('⚠️  FastDatabase: Continuing despite table creation errors');
    }
  }


  // CRASH FIX: Simple, fast operations with SAFE DEFAULTS
  getUserByEmail(email) {
    try {
      // CRITICAL: Validate input first
      if (!email || typeof email !== 'string') {
        console.warn('FastDatabase: Invalid email provided to getUserByEmail');
        return null;
      }

      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult) {
          console.warn('FastDatabase init failed in getUserByEmail');
          return null;
        }
      }

      // Double check database is available
      if (!this.db || typeof this.db.getFirstSync !== 'function') {
        console.warn('Database not available in getUserByEmail');
        return null;
      }

      const result = this.db.getFirstSync(`SELECT * FROM users WHERE email = ?`, [email]);
      return result || null;
    } catch (error) {
      console.warn('getUserByEmail error:', error.message);
      // CRASH FIX: Always return null on error, never throw
      return null;
    }
  }

  getDashboardData() {
    try {
      // CRASH FIX: Always validate database state before operations
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult) {
          console.warn('FastDatabase init failed in getDashboardData - returning empty dashboard');
          // CRASH FIX: Return safe defaults instead of throwing
          return this.getSafeDashboardDefaults();
        }
      }

      console.log('🔄 FastDatabase: Getting dashboard data...');

      // Check if database is actually initialized and has required methods
      if (!this.db || typeof this.db.getFirstSync !== 'function' || typeof this.db.getAllSync !== 'function') {
        console.warn('Database connection not available - returning empty dashboard');
        // CRASH FIX: Return safe defaults instead of throwing
        return this.getSafeDashboardDefaults();
      }

      // Check what tables exist
      const tables = this.db.getAllSync(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`);
      console.log('📋 FastDatabase: Available tables for dashboard:', tables.map(t => t.name));

      // Test basic query first
      try {
        const testQuery = this.db.getFirstSync(`SELECT 1 as test`);
        console.log('✅ FastDatabase: Database connection test passed');
      } catch (testError) {
        throw new Error(`Database connection test failed: ${testError.message}`);
      }

      // Get fresh counts from database with detailed logging
      console.log('🔄 FastDatabase: Querying farms count...');
      const farms = this.db.getFirstSync(`SELECT COUNT(*) as count FROM farms`);
      console.log('✅ FastDatabase: Farms count result:', farms);

      console.log('🔄 FastDatabase: Querying batches count...');
      const batches = this.db.getFirstSync(`SELECT COUNT(*) as count FROM poultry_batches`);
      console.log('✅ FastDatabase: Batches count result:', batches);

      // Calculate total birds from all batches
      console.log('🔄 FastDatabase: Calculating total birds...');
      const totalBirdsResult = this.db.getFirstSync(`SELECT SUM(current_count) as total FROM poultry_batches`);
      const totalBirds = totalBirdsResult?.total || 0;
      console.log('✅ FastDatabase: Total birds result:', totalBirds);

      // Get today's data
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log('🔄 FastDatabase: Today\'s date for queries:', today);

      // Get today's egg production
      console.log('🔄 FastDatabase: Querying today\'s egg production...');
      const todayEggs = this.db.getFirstSync(`
        SELECT SUM(eggs_collected) as total
        FROM production_records
        WHERE DATE(date) = DATE('${today}')
      `);
      console.log('✅ FastDatabase: Today\'s eggs result:', todayEggs);

      // Get today's mortality
      console.log('🔄 FastDatabase: Querying today\'s mortality...');
      const todayDeaths = this.db.getFirstSync(`
        SELECT SUM(count) as total
        FROM mortality_records
        WHERE DATE(date) = DATE('${today}')
      `);
      console.log('✅ FastDatabase: Today\'s deaths result:', todayDeaths);

      // Get recent activities from the last 7 days
      console.log('🔄 FastDatabase: Querying recent activities...');
      const recentActivities = this.getRecentActivities();
      console.log('✅ FastDatabase: Recent activities result:', recentActivities.length, 'activities');

      const dashboardData = {
        farms: farms?.count || 0,
        activeBatches: batches?.count || 0,
        totalBirds: totalBirds,
        recentMortality: todayDeaths?.total || 0,
        todayProduction: todayEggs?.total || 0,
        totalFarms: farms?.count || 0,
        totalFlocks: batches?.count || 0,
        eggsToday: todayEggs?.total || 0,
        deathsToday: todayDeaths?.total || 0,
        myRecordsToday: 0, // Will calculate based on user in fastApiService
        recentActivities: recentActivities,
        alerts: []
      };

      console.log('✅ FastDatabase: Dashboard data compiled:', {
        farms: dashboardData.totalFarms,
        batches: dashboardData.totalFlocks,
        birds: dashboardData.totalBirds,
        eggsToday: dashboardData.eggsToday,
        deathsToday: dashboardData.deathsToday
      });

      return dashboardData;
    } catch (error) {
      console.error('❌ FastDatabase: Dashboard data error:', error);
      console.error('❌ FastDatabase: Error details:', error.message);
      // CRASH FIX: Return safe defaults
      return this.getSafeDashboardDefaults();
    }
  }

  // CRASH FIX: Helper method to return safe dashboard defaults
  getSafeDashboardDefaults() {
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
      recentActivities: this.getRecentActivitiesFallback(),
      alerts: [],
      error: 'Database not available - showing empty dashboard'
    };
  }

  getFarms() {
    try {
      console.log('🔄 FastDatabase.getFarms() called');

      // CRASH FIX: Ensure database is initialized
      if (!this.isReady || !this.db) {
        console.log('⚠️ Database not ready, attempting initialization...');
        const initResult = this.init();
        if (!initResult || !this.db) {
          console.warn('❌ FastDatabase not available for getFarms - returning empty array');
          return [];
        }
        console.log('✅ Database initialized successfully');
      }

      console.log('🔄 FastDatabase: Getting farms from database...');

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.getAllSync !== 'function') {
        console.warn('❌ Database getAllSync method not available');
        return [];
      }

      // Check what tables exist
      const tables = this.db.getAllSync(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`);
      console.log('📋 FastDatabase: Available tables:', tables.map(t => t.name));

      // Check if farms table exists
      const farmsTableExists = tables.some(t => t.name === 'farms');
      if (!farmsTableExists) {
        console.warn('⚠️ farms table does not exist yet, creating tables...');
        this.createBasicTablesIfNeeded();
      }

      const farms = this.db.getAllSync(`SELECT * FROM farms WHERE is_deleted = 0 OR is_deleted IS NULL`);
      console.log(`✅ FastDatabase: Retrieved ${farms.length} farms from database`);

      if (farms.length > 0) {
        console.log('📊 FastDatabase: Farm details:', farms.map(f => ({
          id: f.id,
          name: f.farm_name,
          location: f.location,
          type: f.farm_type
        })));
      } else {
        console.log('ℹ️ No farms found in database');
      }

      return Array.isArray(farms) ? farms : [];
    } catch (error) {
      console.error('❌ FastDatabase: Error getting farms:', error);
      console.error('❌ FastDatabase: Error details:', error.message);
      console.error('❌ FastDatabase: Error stack:', error.stack);
      // CRASH FIX: Always return empty array on error
      return [];
    }
  }

  getBatches() {
    try {
      // CRASH FIX: Ensure database is initialized
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          console.warn('FastDatabase not available for getBatches');
          return [];
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.getAllSync !== 'function') {
        console.warn('Database getAllSync method not available');
        return [];
      }

      const batches = this.db.getAllSync(`SELECT * FROM poultry_batches`);
      return Array.isArray(batches) ? batches : [];
    } catch (error) {
      console.error('❌ FastDatabase: Error getting batches:', error.message);
      // CRASH FIX: Always return empty array on error
      return [];
    }
  }

  // CRASH FIX: FARM CRUD OPERATIONS with comprehensive error handling - NEVER CRASHES
  createFarm(farmData) {
    try {
      // CRASH FIX: Validate input
      if (!farmData || typeof farmData !== 'object') {
        throw new Error('Invalid farm data provided');
      }

      // CRITICAL FIX: Ensure database is ready - if not, throw clear error for user
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      const result = this.db.runSync(
        `INSERT INTO farms (farm_name, location, farm_type, description) VALUES (?, ?, ?, ?)`,
        [farmData.name || 'Unnamed Farm', farmData.location || '', farmData.farmType || 'broiler', farmData.description || '']
      );
      return { id: result.lastInsertRowId, ...farmData };
    } catch (error) {
      // CRASH FIX: Log error and throw with clear message
      console.error('❌ FastDatabase: Failed to create farm:', error.message);
      throw new Error(`Failed to create farm: ${error.message}`);
    }
  }

  updateFarm(farmId, farmData) {
    try {
      // CRASH FIX: Validate input
      if (!farmId || !farmData || typeof farmData !== 'object') {
        throw new Error('Invalid farm ID or data provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(
        `UPDATE farms SET farm_name = ?, location = ?, farm_type = ?, description = ? WHERE id = ?`,
        [farmData.name || 'Unnamed Farm', farmData.location || '', farmData.farmType || 'broiler', farmData.description || '', farmId]
      );
      return { id: farmId, ...farmData };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to update farm:', error.message);
      throw new Error(`Failed to update farm: ${error.message}`);
    }
  }

  deleteFarm(farmId) {
    try {
      // CRASH FIX: Validate input
      if (!farmId) {
        throw new Error('Invalid farm ID provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function' || typeof this.db.getFirstSync !== 'function') {
        throw new Error('Database methods not available');
      }

      console.log(`🔄 FastDatabase: Deleting farm with ID: ${farmId}`);

      // Verify farm exists first
      const farm = this.db.getFirstSync(`SELECT * FROM farms WHERE id = ?`, [farmId]);
      if (!farm) {
        throw new Error(`Farm with ID ${farmId} not found`);
      }
      console.log(`✅ FastDatabase: Found farm to delete: ${farm.farm_name || 'Unknown'}`);

      // CRASH FIX: Wrap all delete operations in a transaction to prevent SQLite concurrency issues
      this.db.execSync('BEGIN TRANSACTION');

      try {
        // First delete all related batches (cascade delete will handle related records)
        const batchResult = this.db.runSync(`DELETE FROM poultry_batches WHERE farm_id = ?`, [farmId]);
        console.log(`✅ FastDatabase: Deleted ${batchResult.changes} batches`);

        // Delete all related records
        this.db.runSync(`DELETE FROM feed_records WHERE farm_id = ?`, [farmId]);
        this.db.runSync(`DELETE FROM health_records WHERE farm_id = ?`, [farmId]);
        this.db.runSync(`DELETE FROM mortality_records WHERE farm_id = ?`, [farmId]);
        this.db.runSync(`DELETE FROM production_records WHERE farm_id = ?`, [farmId]);
        this.db.runSync(`DELETE FROM water_records WHERE farm_id = ?`, [farmId]);

        // Finally delete the farm
        const farmResult = this.db.runSync(`DELETE FROM farms WHERE id = ?`, [farmId]);
        console.log(`✅ FastDatabase: Deleted farm (${farmResult.changes} rows affected)`);

        if (farmResult.changes === 0) {
          throw new Error(`No farm was deleted - farm ID ${farmId} may not exist`);
        }

        // CRASH FIX: Commit transaction only if all deletes succeeded
        this.db.execSync('COMMIT');
        console.log(`✅ FastDatabase: Successfully deleted farm ${farmId} and all related data`);
        return true;
      } catch (deleteError) {
        // CRASH FIX: Rollback transaction on any error
        this.db.execSync('ROLLBACK');
        console.error(`❌ FastDatabase: Delete transaction failed, rolled back:`, deleteError.message);
        throw deleteError;
      }
    } catch (error) {
      console.error(`❌ FastDatabase: Error deleting farm ${farmId}:`, error);
      console.error(`❌ FastDatabase: Error details:`, error.message);
      throw new Error(`Failed to delete farm: ${error.message}`);
    }
  }

  getFarmById(farmId) {
    try {
      if (!this.isReady) this.init();
      return this.db.getFirstSync(`SELECT * FROM farms WHERE id = ?`, [farmId]);
    } catch (error) {
      return null;
    }
  }

  // BATCH CRUD OPERATIONS
  createBatch(batchData) {
    try {
      // CRASH FIX: Validate input data
      if (!batchData || typeof batchData !== 'object') {
        throw new Error('Invalid batch data provided');
      }

      // CRASH FIX: Validate required fields
      if (!batchData.batchName || !batchData.farmId || !batchData.initialCount) {
        throw new Error('Missing required fields: batchName, farmId, initialCount');
      }

      // CRASH FIX: Validate farmId is a valid number (prevent NaN database error)
      const farmIdNum = typeof batchData.farmId === 'number' ? batchData.farmId : parseInt(batchData.farmId);
      if (isNaN(farmIdNum) || farmIdNum <= 0) {
        throw new Error('Invalid farmId: must be a positive number');
      }

      // CRASH FIX: Validate count values (prevent NaN database error)
      const initialCountNum = typeof batchData.initialCount === 'number' ? batchData.initialCount : parseInt(batchData.initialCount);
      const currentCountNum = batchData.currentCount
        ? (typeof batchData.currentCount === 'number' ? batchData.currentCount : parseInt(batchData.currentCount))
        : initialCountNum;

      if (isNaN(initialCountNum) || initialCountNum <= 0) {
        throw new Error('Invalid initialCount: must be a positive number');
      }

      if (isNaN(currentCountNum) || currentCountNum < 0) {
        throw new Error('Invalid currentCount: must be a non-negative number');
      }

      // CRITICAL FIX: Ensure database is ready - if not, throw clear error for user
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      // CRITICAL CRASH FIX: Verify farm exists BEFORE attempting to insert batch
      // This prevents SQLite foreign key constraint violation crash
      console.log(`🔄 FastDatabase: Verifying farm ${farmIdNum} exists before creating batch...`);

      // DEBUGGING: List all farms in database first
      try {
        const allFarms = this.db.getAllSync(`SELECT id, farm_name, location, is_deleted FROM farms`);
        console.log(`📊 FastDatabase: Current farms in database (${allFarms.length} total):`);
        allFarms.forEach(farm => {
          console.log(`   - Farm ID ${farm.id}: ${farm.farm_name} (${farm.location}) - is_deleted: ${farm.is_deleted}`);
        });
      } catch (listError) {
        console.warn(`⚠️ FastDatabase: Could not list farms for debugging:`, listError.message);
      }

      const farmExists = this.db.getFirstSync(
        `SELECT id, farm_name FROM farms WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`,
        [farmIdNum]
      );

      console.log(`🔍 FastDatabase: Farm lookup result for ID ${farmIdNum}:`, farmExists);

      if (!farmExists) {
        console.error(`❌ FastDatabase: Farm with ID ${farmIdNum} does not exist in database`);
        console.error(`   Searched for: id = ${farmIdNum} AND (is_deleted = 0 OR is_deleted IS NULL)`);
        throw new Error(`Farm with ID ${farmIdNum} not found. Please select a valid farm from the list.`);
      }
      console.log(`✅ FastDatabase: Farm ${farmIdNum} ("${farmExists.farm_name}") exists, proceeding with batch creation`);

      console.log('🔄 FastDatabase: Creating batch with data:', {
        batchName: batchData.batchName,
        birdType: batchData.birdType || batchData.breed,
        farmId: farmIdNum,
        initialCount: initialCountNum,
        currentCount: currentCountNum
      });

      const result = this.db.runSync(
        `INSERT INTO poultry_batches (batch_name, breed, initial_count, current_count, farm_id, arrival_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          batchData.batchName,
          batchData.birdType || batchData.breed,
          initialCountNum,
          currentCountNum,
          farmIdNum,
          batchData.arrivalDate,
          batchData.status || 'active'
        ]
      );

      console.log('✅ FastDatabase: Batch created successfully with ID:', result.lastInsertRowId);

      return { id: result.lastInsertRowId, ...batchData, farmId: farmIdNum, initialCount: initialCountNum, currentCount: currentCountNum };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to create batch:', error.message);

      // CRASH FIX: Provide specific error messages for foreign key violations
      if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
        throw new Error('Invalid farm selected. The farm may have been deleted. Please refresh and select a valid farm.');
      }

      throw new Error(`Failed to create batch: ${error.message}`);
    }
  }

  updateBatch(batchId, batchData) {
    try {
      // CRASH FIX: Validate input
      if (!batchId || !batchData || typeof batchData !== 'object') {
        throw new Error('Invalid batch ID or data provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for batch update');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(
        `UPDATE poultry_batches SET batch_name = ?, breed = ?, initial_count = ?, current_count = ?, farm_id = ?, arrival_date = ?, status = ? WHERE id = ?`,
        [
          batchData.batchName,
          batchData.birdType || batchData.breed,
          batchData.initialCount,
          batchData.currentCount || batchData.initialCount,
          batchData.farmId,
          batchData.arrivalDate,
          batchData.status || 'active',
          batchId
        ]
      );
      return { id: batchId, ...batchData };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to update batch:', error.message);
      throw new Error(`Failed to update batch: ${error.message}`);
    }
  }

  deleteBatch(batchId) {
    try {
      // CRASH FIX: Validate input
      if (!batchId) {
        throw new Error('Invalid batch ID provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for batch deletion');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      // Delete all related records first
      this.db.runSync(`DELETE FROM feed_records WHERE batch_id = ?`, [batchId]);
      this.db.runSync(`DELETE FROM health_records WHERE batch_id = ?`, [batchId]);
      this.db.runSync(`DELETE FROM mortality_records WHERE batch_id = ?`, [batchId]);
      this.db.runSync(`DELETE FROM production_records WHERE batch_id = ?`, [batchId]);
      this.db.runSync(`DELETE FROM water_records WHERE batch_id = ?`, [batchId]);
      // Finally delete the batch
      this.db.runSync(`DELETE FROM poultry_batches WHERE id = ?`, [batchId]);
      return true;
    } catch (error) {
      console.error('❌ FastDatabase: Failed to delete batch:', error.message);
      throw new Error(`Failed to delete batch: ${error.message}`);
    }
  }

  getBatchById(batchId) {
    try {
      if (!this.isReady) this.init();
      return this.db.getFirstSync(`SELECT * FROM poultry_batches WHERE id = ?`, [batchId]);
    } catch (error) {
      return null;
    }
  }

  // FEED RECORDS CRUD OPERATIONS
  createFeedRecord(recordData) {
    try {
      // CRASH FIX: Validate input
      if (!recordData || typeof recordData !== 'object') {
        throw new Error('Invalid feed record data provided');
      }

      // CRITICAL FIX: Ensure database is ready
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      const result = this.db.runSync(
        `INSERT INTO feed_records (farm_id, batch_id, date, quantity, feed_type, cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [recordData.farmId, recordData.batchId, recordData.date, recordData.quantity, recordData.feedType, recordData.cost, recordData.notes]
      );
      return { id: result.lastInsertRowId, ...recordData };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to create feed record:', error.message);
      throw new Error(`Failed to create feed record: ${error.message}`);
    }
  }

  getFeedRecords() {
    try {
      if (!this.isReady) this.init();
      return this.db.getAllSync(`SELECT * FROM feed_records ORDER BY date DESC`);
    } catch (error) {
      return [];
    }
  }

  deleteFeedRecord(recordId) {
    try {
      // CRASH FIX: Validate input
      if (!recordId) {
        throw new Error('Invalid record ID provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for feed record deletion');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(`DELETE FROM feed_records WHERE id = ?`, [recordId]);
      return true;
    } catch (error) {
      console.error('❌ FastDatabase: Failed to delete feed record:', error.message);
      throw new Error(`Failed to delete feed record: ${error.message}`);
    }
  }

  // HEALTH RECORDS CRUD OPERATIONS
  createHealthRecord(recordData) {
    try {
      // CRASH FIX: Validate input
      if (!recordData || typeof recordData !== 'object') {
        throw new Error('Invalid health record data provided');
      }

      // CRITICAL FIX: Ensure database is ready
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      const result = this.db.runSync(
        `INSERT INTO health_records (farm_id, batch_id, date, health_status, treatment, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [recordData.farmId, recordData.batchId, recordData.date, recordData.healthStatus, recordData.treatment, recordData.notes]
      );
      return { id: result.lastInsertRowId, ...recordData };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to create health record:', error.message);
      throw new Error(`Failed to create health record: ${error.message}`);
    }
  }

  getHealthRecords() {
    try {
      if (!this.isReady) this.init();
      return this.db.getAllSync(`SELECT * FROM health_records ORDER BY date DESC`);
    } catch (error) {
      return [];
    }
  }

  deleteHealthRecord(recordId) {
    try {
      // CRASH FIX: Validate input
      if (!recordId) {
        throw new Error('Invalid record ID provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for health record deletion');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(`DELETE FROM health_records WHERE id = ?`, [recordId]);
      return true;
    } catch (error) {
      console.error('❌ FastDatabase: Failed to delete health record:', error.message);
      throw new Error(`Failed to delete health record: ${error.message}`);
    }
  }

  // MORTALITY RECORDS CRUD OPERATIONS
  createMortalityRecord(recordData) {
    try {
      // CRASH FIX: Validate input
      if (!recordData || typeof recordData !== 'object') {
        throw new Error('Invalid mortality record data provided');
      }

      // CRITICAL FIX: Ensure database is ready
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      // CRASH FIX: Wrap insert + update in a transaction to prevent SQLite concurrency issues
      this.db.execSync('BEGIN TRANSACTION');

      try {
        const result = this.db.runSync(
          `INSERT INTO mortality_records (farm_id, batch_id, date, count, cause, notes) VALUES (?, ?, ?, ?, ?, ?)`,
          [recordData.farmId, recordData.batchId, recordData.date, recordData.count, recordData.cause, recordData.notes]
        );

        // Update batch current count
        this.db.runSync(
          `UPDATE poultry_batches SET current_count = current_count - ? WHERE id = ?`,
          [recordData.count, recordData.batchId]
        );

        // CRASH FIX: Commit transaction only if both operations succeeded
        this.db.execSync('COMMIT');
        return { id: result.lastInsertRowId, ...recordData };
      } catch (insertError) {
        // CRASH FIX: Rollback transaction on any error
        this.db.execSync('ROLLBACK');
        console.error(`❌ FastDatabase: Create mortality record transaction failed, rolled back:`, insertError.message);
        throw insertError;
      }
    } catch (error) {
      console.error('❌ FastDatabase: Failed to create mortality record:', error.message);
      throw new Error(`Failed to create mortality record: ${error.message}`);
    }
  }

  getMortalityRecords() {
    try {
      if (!this.isReady) this.init();
      return this.db.getAllSync(`SELECT * FROM mortality_records ORDER BY date DESC`);
    } catch (error) {
      return [];
    }
  }

  deleteMortalityRecord(recordId) {
    try {
      // CRASH FIX: Validate input
      if (!recordId) {
        throw new Error('Invalid record ID provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for mortality record deletion');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function' || typeof this.db.execSync !== 'function' || typeof this.db.getFirstSync !== 'function') {
        throw new Error('Database methods not available');
      }

      // CRASH FIX: Wrap update + delete in a transaction to prevent SQLite concurrency issues
      this.db.execSync('BEGIN TRANSACTION');

      try {
        // Get the record first to restore the count
        const record = this.db.getFirstSync(`SELECT * FROM mortality_records WHERE id = ?`, [recordId]);
        if (record) {
          // Restore the batch count
          this.db.runSync(
            `UPDATE poultry_batches SET current_count = current_count + ? WHERE id = ?`,
            [record.count, record.batch_id]
          );
        }

        this.db.runSync(`DELETE FROM mortality_records WHERE id = ?`, [recordId]);

        // CRASH FIX: Commit transaction only if both operations succeeded
        this.db.execSync('COMMIT');
        return true;
      } catch (deleteError) {
        // CRASH FIX: Rollback transaction on any error
        this.db.execSync('ROLLBACK');
        console.error(`❌ FastDatabase: Delete mortality record transaction failed, rolled back:`, deleteError.message);
        throw deleteError;
      }
    } catch (error) {
      console.error('❌ FastDatabase: Failed to delete mortality record:', error.message);
      throw new Error(`Failed to delete mortality record: ${error.message}`);
    }
  }

  // PRODUCTION RECORDS CRUD OPERATIONS
  createProductionRecord(recordData) {
    try {
      // CRASH FIX: Validate input
      if (!recordData || typeof recordData !== 'object') {
        throw new Error('Invalid production record data provided');
      }

      // CRITICAL FIX: Ensure database is ready
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      const result = this.db.runSync(
        `INSERT INTO production_records (farm_id, batch_id, date, eggs_collected, weight, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [recordData.farmId, recordData.batchId, recordData.date, recordData.eggsCollected, recordData.weight, recordData.notes]
      );
      return { id: result.lastInsertRowId, ...recordData };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to create production record:', error.message);
      throw new Error(`Failed to create production record: ${error.message}`);
    }
  }

  getProductionRecords() {
    try {
      if (!this.isReady) this.init();
      return this.db.getAllSync(`SELECT * FROM production_records ORDER BY date DESC`);
    } catch (error) {
      return [];
    }
  }

  deleteProductionRecord(recordId) {
    try {
      // CRASH FIX: Validate input
      if (!recordId) {
        throw new Error('Invalid record ID provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for production record deletion');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(`DELETE FROM production_records WHERE id = ?`, [recordId]);
      return true;
    } catch (error) {
      console.error('❌ FastDatabase: Failed to delete production record:', error.message);
      throw new Error(`Failed to delete production record: ${error.message}`);
    }
  }

  // WATER RECORDS
  createWaterRecord(recordData) {
    try {
      // CRASH FIX: Validate input
      if (!recordData || typeof recordData !== 'object') {
        throw new Error('Invalid water record data provided');
      }

      // CRITICAL FIX: Ensure database is ready
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      const result = this.db.runSync(
        `INSERT INTO water_records (batch_id, farm_id, date_recorded, quantity_liters, water_source, quality, temperature, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [recordData.batchId, recordData.farmId, recordData.dateRecorded, recordData.quantityLiters, recordData.waterSource, recordData.quality, recordData.temperature, recordData.notes]
      );
      return { id: result.lastInsertRowId, ...recordData };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to create water record:', error.message);
      throw new Error(`Failed to create water record: ${error.message}`);
    }
  }

  getWaterRecords() {
    try {
      if (!this.isReady) this.init();
      return this.db.getAllSync(`SELECT * FROM water_records ORDER BY date_recorded DESC`);
    } catch (error) {
      return [];
    }
  }

  deleteWaterRecord(recordId) {
    try {
      // CRASH FIX: Validate input
      if (!recordId) {
        throw new Error('Invalid record ID provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for water record deletion');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(`DELETE FROM water_records WHERE id = ?`, [recordId]);
      return true;
    } catch (error) {
      console.error('❌ FastDatabase: Failed to delete water record:', error.message);
      throw new Error(`Failed to delete water record: ${error.message}`);
    }
  }

  // WEIGHT RECORDS
  createWeightRecord(recordData) {
    try {
      // CRASH FIX: Validate input
      if (!recordData || typeof recordData !== 'object') {
        throw new Error('Invalid weight record data provided');
      }

      // CRITICAL FIX: Ensure database is ready
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      const result = this.db.runSync(
        `INSERT INTO weight_records (batch_id, farm_id, date_recorded, average_weight, sample_size, weight_unit, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [recordData.batchId, recordData.farmId, recordData.dateRecorded, recordData.averageWeight, recordData.sampleSize, recordData.weightUnit || 'kg', recordData.notes]
      );
      return { id: result.lastInsertRowId, ...recordData };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to create weight record:', error.message);
      throw new Error(`Failed to create weight record: ${error.message}`);
    }
  }

  getWeightRecords() {
    try {
      if (!this.isReady) this.init();
      return this.db.getAllSync(`SELECT * FROM weight_records ORDER BY date_recorded DESC`);
    } catch (error) {
      return [];
    }
  }

  deleteWeightRecord(recordId) {
    try {
      // CRASH FIX: Validate input
      if (!recordId) {
        throw new Error('Invalid record ID provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for weight record deletion');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(`DELETE FROM weight_records WHERE id = ?`, [recordId]);
      return true;
    } catch (error) {
      console.error('❌ FastDatabase: Failed to delete weight record:', error.message);
      throw new Error(`Failed to delete weight record: ${error.message}`);
    }
  }

  // EXPENSE RECORDS
  createExpense(expenseData) {
    try {
      // CRASH FIX: Validate input
      if (!expenseData || typeof expenseData !== 'object') {
        throw new Error('Invalid expense data provided');
      }

      // CRITICAL FIX: Ensure database is ready
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      const result = this.db.runSync(
        `INSERT INTO expenses (farm_id, batch_id, category, subcategory, description, amount, expense_date, supplier, receipt_number, receipt_url, payment_method, notes, is_recurring, recurring_frequency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          expenseData.farmId || null,
          expenseData.batchId || null,
          expenseData.category,
          expenseData.subcategory || null,
          expenseData.description,
          expenseData.amount,
          expenseData.expenseDate,
          expenseData.supplier || null,
          expenseData.receiptNumber || null,
          expenseData.receiptUrl || null,
          expenseData.paymentMethod || 'cash',
          expenseData.notes || null,
          expenseData.isRecurring ? 1 : 0,
          expenseData.recurringFrequency || null
        ]
      );
      return { id: result.lastInsertRowId, ...expenseData };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to create expense:', error.message);
      throw new Error(`Failed to create expense: ${error.message}`);
    }
  }

  getExpenses(filters = {}) {
    try {
      if (!this.isReady) this.init();

      let query = `SELECT * FROM expenses WHERE 1=1`;
      const params = [];

      if (filters.farmId) {
        query += ` AND farm_id = ?`;
        params.push(filters.farmId);
      }

      if (filters.batchId) {
        query += ` AND batch_id = ?`;
        params.push(filters.batchId);
      }

      if (filters.category) {
        query += ` AND category = ?`;
        params.push(filters.category);
      }

      if (filters.startDate) {
        query += ` AND expense_date >= ?`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ` AND expense_date <= ?`;
        params.push(filters.endDate);
      }

      query += ` ORDER BY expense_date DESC`;

      return this.db.getAllSync(query, params);
    } catch (error) {
      console.error('Failed to get expenses:', error);
      return [];
    }
  }

  getExpenseById(expenseId) {
    try {
      if (!this.isReady) this.init();
      const result = this.db.getFirstSync(`SELECT * FROM expenses WHERE id = ?`, [expenseId]);
      return result || null;
    } catch (error) {
      console.error('Failed to get expense:', error);
      return null;
    }
  }

  updateExpense(expenseId, expenseData) {
    try {
      // CRASH FIX: Validate input
      if (!expenseId || !expenseData || typeof expenseData !== 'object') {
        throw new Error('Invalid expense ID or data provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for expense update');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(
        `UPDATE expenses SET farm_id = ?, batch_id = ?, category = ?, subcategory = ?, description = ?, amount = ?, expense_date = ?, supplier = ?, receipt_number = ?, receipt_url = ?, payment_method = ?, notes = ?, is_recurring = ?, recurring_frequency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [
          expenseData.farmId || null,
          expenseData.batchId || null,
          expenseData.category,
          expenseData.subcategory || null,
          expenseData.description,
          expenseData.amount,
          expenseData.expenseDate,
          expenseData.supplier || null,
          expenseData.receiptNumber || null,
          expenseData.receiptUrl || null,
          expenseData.paymentMethod || 'cash',
          expenseData.notes || null,
          expenseData.isRecurring ? 1 : 0,
          expenseData.recurringFrequency || null,
          expenseId
        ]
      );
      return this.getExpenseById(expenseId);
    } catch (error) {
      console.error('❌ FastDatabase: Failed to update expense:', error.message);
      throw new Error(`Failed to update expense: ${error.message}`);
    }
  }

  deleteExpense(expenseId) {
    try {
      // CRASH FIX: Validate input
      if (!expenseId) {
        throw new Error('Invalid expense ID provided');
      }

      // CRASH FIX: Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for expense deletion');
        }
      }

      // CRASH FIX: Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(`DELETE FROM expenses WHERE id = ?`, [expenseId]);
      return true;
    } catch (error) {
      console.error('❌ FastDatabase: Failed to delete expense:', error.message);
      throw new Error(`Failed to delete expense: ${error.message}`);
    }
  }

  getExpenseSummary(filters = {}) {
    try {
      if (!this.isReady) this.init();

      let query = `SELECT category, SUM(amount) as totalAmount, COUNT(*) as count FROM expenses WHERE 1=1`;
      const params = [];

      if (filters.startDate) {
        query += ` AND expense_date >= ?`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ` AND expense_date <= ?`;
        params.push(filters.endDate);
      }

      query += ` GROUP BY category`;

      return this.db.getAllSync(query, params);
    } catch (error) {
      console.error('Failed to get expense summary:', error);
      return [];
    }
  }

  // UTILITY METHODS
  getAllRecords(type) {
    switch (type) {
      case 'feed':
        return this.getFeedRecords();
      case 'health':
        return this.getHealthRecords();
      case 'mortality':
        return this.getMortalityRecords();
      case 'water':
        return this.getWaterRecords();
      case 'weight':
        return this.getWeightRecords();
      case 'production':
        return this.getProductionRecords();
      case 'expense':
        return this.getExpenses();
      default:
        return [];
    }
  }

  deleteRecord(type, recordId) {
    switch (type) {
      case 'feed':
        return this.deleteFeedRecord(recordId);
      case 'health':
        return this.deleteHealthRecord(recordId);
      case 'mortality':
        return this.deleteMortalityRecord(recordId);
      case 'production':
        return this.deleteProductionRecord(recordId);
      case 'water':
        return this.deleteWaterRecord(recordId);
      case 'weight':
        return this.deleteWeightRecord(recordId);
      case 'expense':
        return this.deleteExpense(recordId);
      default:
        throw new Error(`Unknown record type: ${type}`);
    }
  }

  createRecord(type, recordData) {
    try {
      // Validate input data
      if (!recordData || typeof recordData !== 'object') {
        throw new Error('Invalid record data provided');
      }

      if (!recordData.farmId || !recordData.batchId) {
        throw new Error('Farm ID and Batch ID are required');
      }

      // Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult) {
          throw new Error('Database not available for record creation');
        }
      }

      switch (type) {
        case 'feed':
          return this.createFeedRecord(recordData);
        case 'health':
          return this.createHealthRecord(recordData);
        case 'mortality':
          return this.createMortalityRecord(recordData);
        case 'production':
          return this.createProductionRecord(recordData);
        case 'water':
          return this.createWaterRecord(recordData);
        case 'weight':
          return this.createWeightRecord(recordData);
        default:
          throw new Error(`Unknown record type: ${type}`);
      }
    } catch (error) {
      console.error(`Failed to create ${type} record:`, error.message);
      throw error;
    }
  }

  // RECENT ACTIVITIES METHODS
  getRecentActivities() {
    try {
      if (!this.isReady || !this.db) {
        console.warn('Database not ready for recent activities query');
        return [];
      }

      const activities = [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateLimit = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Get recent farms
      try {
        const recentFarms = this.db.getAllSync(`
          SELECT farm_name as name, created_at as date, 'farm' as type, 'Farm created' as action
          FROM farms
          WHERE DATE(created_at) >= DATE('${dateLimit}')
          ORDER BY created_at DESC
          LIMIT 5
        `);
        activities.push(...recentFarms.map(item => ({
          ...item,
          description: `Farm "${item.name}" was created`,
          icon: '🏢'
        })));
      } catch (error) {
        console.warn('Error fetching recent farms:', error.message);
      }

      // Get recent batches
      try {
        const recentBatches = this.db.getAllSync(`
          SELECT pb.batch_name as name, pb.created_at as date, 'batch' as type, 'Batch created' as action, f.farm_name as farm_name
          FROM poultry_batches pb
          LEFT JOIN farms f ON pb.farm_id = f.id
          WHERE DATE(pb.created_at) >= DATE('${dateLimit}')
          ORDER BY pb.created_at DESC
          LIMIT 5
        `);
        activities.push(...recentBatches.map(item => ({
          ...item,
          description: `Batch "${item.name}" was created at ${item.farm_name || 'Unknown Farm'}`,
          icon: '🐔'
        })));
      } catch (error) {
        console.warn('Error fetching recent batches:', error.message);
      }

      // Get recent production records
      try {
        const recentProduction = this.db.getAllSync(`
          SELECT pr.eggs_collected, pr.date, 'production' as type, 'Eggs recorded' as action, f.farm_name as farm_name, pb.batch_name as batch_name
          FROM production_records pr
          LEFT JOIN farms f ON pr.farm_id = f.id
          LEFT JOIN poultry_batches pb ON pr.batch_id = pb.id
          WHERE DATE(pr.date) >= DATE('${dateLimit}')
          ORDER BY pr.date DESC
          LIMIT 5
        `);
        activities.push(...recentProduction.map(item => ({
          ...item,
          description: `${item.eggs_collected} eggs collected from ${item.batch_name || 'Unknown Batch'} at ${item.farm_name || 'Unknown Farm'}`,
          icon: '🥚'
        })));
      } catch (error) {
        console.warn('Error fetching recent production:', error.message);
      }

      // Get recent mortality records
      try {
        const recentMortality = this.db.getAllSync(`
          SELECT mr.count, mr.date, 'mortality' as type, 'Mortality recorded' as action, f.farm_name as farm_name, pb.batch_name as batch_name
          FROM mortality_records mr
          LEFT JOIN farms f ON mr.farm_id = f.id
          LEFT JOIN poultry_batches pb ON mr.batch_id = pb.id
          WHERE DATE(mr.date) >= DATE('${dateLimit}')
          ORDER BY mr.date DESC
          LIMIT 5
        `);
        activities.push(...recentMortality.map(item => ({
          ...item,
          description: `${item.count} birds died in ${item.batch_name || 'Unknown Batch'} at ${item.farm_name || 'Unknown Farm'}`,
          icon: '⚠️'
        })));
      } catch (error) {
        console.warn('Error fetching recent mortality:', error.message);
      }

      // Get recent feed records
      try {
        const recentFeed = this.db.getAllSync(`
          SELECT fr.quantity, fr.date, 'feed' as type, 'Feed recorded' as action, f.farm_name as farm_name, pb.batch_name as batch_name
          FROM feed_records fr
          LEFT JOIN farms f ON fr.farm_id = f.id
          LEFT JOIN poultry_batches pb ON fr.batch_id = pb.id
          WHERE DATE(fr.date) >= DATE('${dateLimit}')
          ORDER BY fr.date DESC
          LIMIT 5
        `);
        activities.push(...recentFeed.map(item => ({
          ...item,
          description: `${item.quantity}kg feed given to ${item.batch_name || 'Unknown Batch'} at ${item.farm_name || 'Unknown Farm'}`,
          icon: '🌾'
        })));
      } catch (error) {
        console.warn('Error fetching recent feed:', error.message);
      }

      // Get recent health records
      try {
        const recentHealth = this.db.getAllSync(`
          SELECT hr.health_status, hr.date, 'health' as type, 'Health check' as action, f.farm_name as farm_name, pb.batch_name as batch_name
          FROM health_records hr
          LEFT JOIN farms f ON hr.farm_id = f.id
          LEFT JOIN poultry_batches pb ON hr.batch_id = pb.id
          WHERE DATE(hr.date) >= DATE('${dateLimit}')
          ORDER BY hr.date DESC
          LIMIT 5
        `);
        activities.push(...recentHealth.map(item => ({
          ...item,
          description: `Health check: ${item.health_status} for ${item.batch_name || 'Unknown Batch'} at ${item.farm_name || 'Unknown Farm'}`,
          icon: '🏥'
        })));
      } catch (error) {
        console.warn('Error fetching recent health:', error.message);
      }

      // Sort all activities by date and limit to 10 most recent
      activities.sort((a, b) => new Date(b.date) - new Date(a.date));
      const recentActivities = activities.slice(0, 10);

      console.log(`✅ FastDatabase: Retrieved ${recentActivities.length} recent activities`);
      return recentActivities;

    } catch (error) {
      console.error('❌ FastDatabase: Error getting recent activities:', error);
      return this.getRecentActivitiesFallback();
    }
  }

  getRecentActivitiesFallback() {
    // Return some basic fallback activities if database fails
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return [
      {
        type: 'system',
        action: 'App started',
        description: 'Poultry360 app was started',
        date: today,
        icon: '🚀'
      }
    ];
  }

  // COMPREHENSIVE ANALYTICS METHOD - Real-time calculations from SQLite
  getAnalyticsData(params = {}) {
    try {
      // CRASH FIX: Ensure database is initialized
      if (!this.isReady || !this.db) {
        console.log('[FastDatabase] Database not ready for analytics, attempting initialization...');
        const initResult = this.init();
        if (!initResult || !this.db) {
          console.log('[FastDatabase] Database initialization failed - returning empty analytics (this is normal on first launch)');
          return this.getEmptyAnalyticsData();
        }
      }

      // CRASH FIX: Validate database methods are available
      if (typeof this.db.getFirstSync !== 'function' || typeof this.db.getAllSync !== 'function') {
        console.log('[FastDatabase] Database methods not available - returning empty analytics');
        return this.getEmptyAnalyticsData();
      }

      console.log('[FastDatabase] Computing analytics from SQLite...');

      // Parse date range parameters
      const endDate = params.endDate ? new Date(params.endDate) : new Date();
      const startDate = params.startDate ? new Date(params.startDate) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      console.log('[FastDatabase] Analytics date range:', { startDateStr, endDateStr, today });

      // ========== OVERVIEW SECTION ==========
      const farmsResult = this.db.getFirstSync(`SELECT COUNT(*) as count FROM farms WHERE is_deleted = 0 OR is_deleted IS NULL`);
      const totalFarms = farmsResult?.count || 0;

      const batchesResult = this.db.getFirstSync(`SELECT COUNT(*) as count FROM poultry_batches`);
      const totalBatches = batchesResult?.count || 0;

      const activeBatchesResult = this.db.getFirstSync(`SELECT COUNT(*) as count FROM poultry_batches WHERE status = 'active'`);
      const activeBatches = activeBatchesResult?.count || 0;

      const totalBirdsResult = this.db.getFirstSync(`SELECT SUM(current_count) as total FROM poultry_batches WHERE status = 'active'`);
      const totalBirds = totalBirdsResult?.total || 0;

      // ========== PRODUCTION ANALYTICS ==========
      const totalEggsResult = this.db.getFirstSync(`
        SELECT SUM(eggs_collected) as total
        FROM production_records
        WHERE DATE(date) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
      `);
      const totalEggsCollected = totalEggsResult?.total || 0;

      const productionDaysResult = this.db.getFirstSync(`
        SELECT COUNT(DISTINCT DATE(date)) as days
        FROM production_records
        WHERE DATE(date) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
      `);
      const productionDays = productionDaysResult?.days || 1;
      const avgDailyProduction = Math.round(totalEggsCollected / productionDays);

      const todayEggsResult = this.db.getFirstSync(`
        SELECT SUM(eggs_collected) as total
        FROM production_records
        WHERE DATE(date) = DATE('${today}')
      `);
      const todayEggs = todayEggsResult?.total || 0;

      // Production Rate (eggs per bird per day)
      const productionRate = totalBirds > 0 ? ((totalEggsCollected / totalBirds / productionDays) * 100).toFixed(1) : '0.0';

      // Daily production trend (last 7 days)
      const dailyProductionResult = this.db.getAllSync(`
        SELECT DATE(date) as date, SUM(eggs_collected) as totalEggs
        FROM production_records
        WHERE DATE(date) >= DATE('${endDateStr}', '-7 days')
        GROUP BY DATE(date)
        ORDER BY DATE(date) ASC
      `);
      const dailyProduction = dailyProductionResult || [];

      // Production rate by batch
      const productionRateByBatchResult = this.db.getAllSync(`
        SELECT
          pb.id,
          pb.batch_name,
          pb.current_count,
          COALESCE(SUM(pr.eggs_collected), 0) as totalEggs,
          CASE
            WHEN pb.current_count > 0 THEN ROUND((COALESCE(SUM(pr.eggs_collected), 0) * 100.0 / pb.current_count), 2)
            ELSE 0
          END as productionRate
        FROM poultry_batches pb
        LEFT JOIN production_records pr ON pb.id = pr.batch_id
          AND DATE(pr.date) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
        WHERE pb.status = 'active'
        GROUP BY pb.id, pb.batch_name, pb.current_count
      `);
      const productionRateByBatch = productionRateByBatchResult || [];

      // Weekly comparison
      const currentWeekStart = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const previousWeekStart = new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const previousWeekEnd = new Date(endDate.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const currentWeekResult = this.db.getFirstSync(`
        SELECT SUM(eggs_collected) as totalEggs
        FROM production_records
        WHERE DATE(date) BETWEEN DATE('${currentWeekStart}') AND DATE('${endDateStr}')
      `);
      const currentWeekEggs = currentWeekResult?.totalEggs || 0;

      const previousWeekResult = this.db.getFirstSync(`
        SELECT SUM(eggs_collected) as totalEggs
        FROM production_records
        WHERE DATE(date) BETWEEN DATE('${previousWeekStart}') AND DATE('${previousWeekEnd}')
      `);
      const previousWeekEggs = previousWeekResult?.totalEggs || 0;

      const percentageChange = previousWeekEggs > 0
        ? (((currentWeekEggs - previousWeekEggs) / previousWeekEggs) * 100).toFixed(1)
        : 0;

      // ========== MORTALITY ANALYTICS ==========
      const totalDeathsResult = this.db.getFirstSync(`
        SELECT SUM(count) as total
        FROM mortality_records
        WHERE DATE(date) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
      `);
      const totalDeaths = totalDeathsResult?.total || 0;

      const todayDeathsResult = this.db.getFirstSync(`
        SELECT SUM(count) as total
        FROM mortality_records
        WHERE DATE(date) = DATE('${today}')
      `);
      const deathsToday = todayDeathsResult?.total || 0;

      // Mortality Rate (deaths / initial birds * 100)
      const totalInitialBirdsResult = this.db.getFirstSync(`SELECT SUM(initial_count) as total FROM poultry_batches`);
      const totalInitialBirds = totalInitialBirdsResult?.total || 1; // Avoid division by zero
      const mortalityRate = ((totalDeaths / totalInitialBirds) * 100).toFixed(2);

      // Daily mortality trend (last 7 days)
      const dailyMortalityResult = this.db.getAllSync(`
        SELECT DATE(date) as date, SUM(count) as totalDeaths
        FROM mortality_records
        WHERE DATE(date) >= DATE('${endDateStr}', '-7 days')
        GROUP BY DATE(date)
        ORDER BY DATE(date) ASC
      `);
      const dailyMortality = dailyMortalityResult || [];

      // ========== FEED ANALYTICS ==========
      const totalFeedCostResult = this.db.getFirstSync(`
        SELECT SUM(cost) as total
        FROM feed_records
        WHERE DATE(date) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
      `);
      const totalFeedCost = totalFeedCostResult?.total || 0;

      const totalFeedQuantityResult = this.db.getFirstSync(`
        SELECT SUM(quantity) as total
        FROM feed_records
        WHERE DATE(date) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
      `);
      const totalFeedQuantity = totalFeedQuantityResult?.total || 0;

      const avgCostPerBird = totalBirds > 0 ? (totalFeedCost / totalBirds).toFixed(2) : '0.00';
      const avgFeedPerBird = totalBirds > 0 ? (totalFeedQuantity / totalBirds).toFixed(2) : '0.00';

      // Daily feed consumption trend (last 7 days)
      const dailyFeedResult = this.db.getAllSync(`
        SELECT DATE(date) as date, SUM(quantity) as totalFeed, SUM(cost) as totalCost
        FROM feed_records
        WHERE DATE(date) >= DATE('${endDateStr}', '-7 days')
        GROUP BY DATE(date)
        ORDER BY DATE(date) ASC
      `);
      const dailyFeedConsumption = dailyFeedResult || [];

      // ========== HEALTH ANALYTICS ==========
      const totalHealthIssuesResult = this.db.getFirstSync(`
        SELECT COUNT(*) as total
        FROM health_records
        WHERE DATE(date) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
      `);
      const totalHealthIssues = totalHealthIssuesResult?.total || 0;

      const resolvedIssuesResult = this.db.getFirstSync(`
        SELECT COUNT(*) as total
        FROM health_records
        WHERE DATE(date) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
          AND health_status = 'healthy'
      `);
      const resolvedIssues = resolvedIssuesResult?.total || 0;

      const activeIssues = totalHealthIssues - resolvedIssues;

      // ========== WATER ANALYTICS ==========
      const totalWaterResult = this.db.getFirstSync(`
        SELECT SUM(quantity_liters) as total
        FROM water_records
        WHERE DATE(date_recorded) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
      `);
      const totalWaterConsumption = totalWaterResult?.total || 0;

      const avgWaterPerBird = totalBirds > 0 ? (totalWaterConsumption / totalBirds).toFixed(2) : '0.00';

      // ========== WEIGHT ANALYTICS ==========
      const avgWeightResult = this.db.getFirstSync(`
        SELECT AVG(average_weight) as avgWeight
        FROM weight_records
        WHERE DATE(date_recorded) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
      `);
      const averageWeight = avgWeightResult?.avgWeight ? avgWeightResult.avgWeight.toFixed(2) : '0.00';

      // ========== FINANCIAL SUMMARY ==========
      // Revenue from egg sales (assume $0.10 per egg as default - can be customized)
      const eggPrice = 0.10; // Default price per egg
      const totalRevenue = (totalEggsCollected * eggPrice).toFixed(2);
      const totalExpenses = totalFeedCost.toFixed(2);
      const profitLoss = (totalRevenue - totalExpenses).toFixed(2);

      console.log('[FastDatabase] Analytics computed successfully:', {
        farms: totalFarms,
        batches: totalBatches,
        birds: totalBirds,
        eggs: totalEggsCollected,
        deaths: totalDeaths
      });

      // Return comprehensive analytics object
      return {
        overview: {
          totalFarms,
          totalBatches,
          activeBatches,
          totalBirds
        },
        production: {
          totalEggsCollected,
          avgDailyProduction,
          todayEggs,
          productionRate,
          dailyProduction,
          productionRateByBatch,
          weeklyComparison: {
            currentWeek: { totalEggs: currentWeekEggs },
            previousWeek: { totalEggs: previousWeekEggs },
            percentageChange: parseFloat(percentageChange)
          }
        },
        mortality: {
          totalDeaths,
          deathsToday,
          mortalityRate,
          dailyMortality,
          trend: parseFloat(mortalityRate) < 5 ? 'good' : 'concerning'
        },
        feed: {
          totalCost: totalFeedCost,
          totalQuantity: totalFeedQuantity,
          avgCostPerBird,
          avgFeedPerBird,
          dailyFeedConsumption
        },
        health: {
          totalIssues: totalHealthIssues,
          resolvedIssues,
          activeIssues
        },
        water: {
          totalConsumption: totalWaterConsumption,
          avgWaterPerBird
        },
        weight: {
          averageWeight
        },
        financial: {
          totalRevenue,
          totalExpenses,
          profitLoss
        }
      };

    } catch (error) {
      console.log('[FastDatabase] Analytics computation error (returning empty data):', error.message);
      // Don't show full error stack - this is normal on first launch
      return this.getEmptyAnalyticsData();
    }
  }

  // Helper method to return empty analytics data
  getEmptyAnalyticsData() {
    return {
      overview: {
        totalFarms: 0,
        totalBatches: 0,
        activeBatches: 0,
        totalBirds: 0
      },
      production: {
        totalEggsCollected: 0,
        avgDailyProduction: 0,
        todayEggs: 0,
        productionRate: '0.0',
        dailyProduction: [],
        productionRateByBatch: [],
        weeklyComparison: {
          currentWeek: { totalEggs: 0 },
          previousWeek: { totalEggs: 0 },
          percentageChange: 0
        }
      },
      mortality: {
        totalDeaths: 0,
        deathsToday: 0,
        mortalityRate: '0.00',
        dailyMortality: [],
        trend: 'good'
      },
      feed: {
        totalCost: 0,
        totalQuantity: 0,
        avgCostPerBird: '0.00',
        avgFeedPerBird: '0.00',
        dailyFeedConsumption: []
      },
      health: {
        totalIssues: 0,
        resolvedIssues: 0,
        activeIssues: 0
      },
      water: {
        totalConsumption: 0,
        avgWaterPerBird: '0.00'
      },
      weight: {
        averageWeight: '0.00'
      },
      financial: {
        totalRevenue: '0.00',
        totalExpenses: '0.00',
        profitLoss: '0.00'
      }
    };
  }
}

// Export singleton instance
const fastDatabase = new FastDatabaseService();
export default fastDatabase;