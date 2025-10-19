import { openDatabaseSync } from 'expo-sqlite';

class FastDatabaseService {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.currentOrganizationId = null; // Track current user's organization
    this.isTransactionActive = false; // Track if a transaction is in progress
    this.transactionQueue = []; // Queue for pending operations
  }

  // CRASH FIX: Retry database operations that fail with SQLITE_BUSY
  // Handles "database is locked" errors by retrying with exponential backoff
  executeWithRetry(operation, maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return operation();
      } catch (error) {
        attempt++;

        // Check if it's a SQLITE_BUSY error
        const isBusyError = error.message && (
          error.message.includes('database is locked') ||
          error.message.includes('SQLITE_BUSY') ||
          error.message.includes('database table is locked')
        );

        if (isBusyError && attempt < maxRetries) {
          // Exponential backoff: 10ms, 20ms, 40ms
          const delay = 10 * Math.pow(2, attempt - 1);
          console.warn(`⚠️  Database locked, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);

          // Synchronous sleep using busy-wait (necessary for expo-sqlite sync API)
          const start = Date.now();
          while (Date.now() - start < delay) {
            // Busy wait
          }

          continue; // Retry
        }

        // Not a SQLITE_BUSY error or out of retries - rethrow
        throw error;
      }
    }

    throw new Error('Database operation failed after maximum retries');
  }

  // Set the current organization ID (called after login)
  setOrganizationId(organizationId) {
    this.currentOrganizationId = organizationId;
    console.log(`🏢 FastDatabase: Organization ID set to ${organizationId}`);
  }

  // Get current organization ID
  getOrganizationId() {
    return this.currentOrganizationId;
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

      // CRASH FIX: Configure database to prevent SQLITE_BUSY errors
      this.db.execSync('PRAGMA foreign_keys = ON;');
      this.db.execSync('PRAGMA busy_timeout = 5000;'); // Wait up to 5 seconds if locked
      this.db.execSync('PRAGMA journal_mode = WAL;'); // Write-Ahead Logging for better concurrency
      this.db.execSync('PRAGMA synchronous = NORMAL;'); // Faster writes while still safe
      this.db.execSync('PRAGMA cache_size = 10000;'); // Larger cache for better performance
      console.log('✅ FastDatabase: Database PRAGMA settings configured (busy_timeout=5000ms, WAL mode)');

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

  // COMPREHENSIVE MIGRATION: Add sync columns to all existing tables + fix field names
  migrateAddIsDeletedColumn() {
    try {
      console.log('🔄 FastDatabase: Starting comprehensive table migration...');

      const tablesToMigrate = [
        'users', 'farms', 'poultry_batches', 'feed_records', 'health_records',
        'mortality_records', 'production_records', 'water_records', 'weight_records', 'expenses',
        'sync_queue'
      ];

      // Define all columns to add for each table type
      // NOTE: SQLite doesn't allow non-constant defaults when adding columns with ALTER TABLE
      // So we use NULL for updated_at and will set it after adding the column
      const syncColumns = [
        { name: 'server_id', type: 'TEXT', default: null },
        { name: 'needs_sync', type: 'INTEGER', default: 1 },
        { name: 'is_synced', type: 'INTEGER', default: 0 },
        { name: 'synced_at', type: 'TEXT', default: null },
        { name: 'is_deleted', type: 'INTEGER', default: 0 },
        { name: 'updated_at', type: 'TEXT', default: null } // Changed from 'CURRENT_TIMESTAMP' to null
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

          // Get existing columns
          const existingColumns = this.db.getAllSync(`PRAGMA table_info(${tableName})`);
          const existingColumnNames = existingColumns.map(col => col.name);

          // Add missing sync columns
          for (const column of syncColumns) {
            if (!existingColumnNames.includes(column.name)) {
              console.log(`🔄 FastDatabase: Adding ${column.name} column to ${tableName}...`);
              const defaultValue = column.default === null ? 'NULL' :
                                   column.type === 'TEXT' ? `'${column.default}'` : column.default;
              this.db.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type} DEFAULT ${defaultValue}`);
              console.log(`✅ FastDatabase: Added ${column.name} column to ${tableName}`);

              // Initialize updated_at for existing rows (new rows will use trigger or INSERT default)
              if (column.name === 'updated_at') {
                this.db.execSync(`UPDATE ${tableName} SET updated_at = datetime('now') WHERE updated_at IS NULL`);
                console.log(`✅ FastDatabase: Initialized updated_at for existing rows in ${tableName}`);
              }
            }
          }

          // Add server_farm_id to poultry_batches for foreign key tracking
          if (tableName === 'poultry_batches' && !existingColumnNames.includes('server_farm_id')) {
            console.log(`🔄 FastDatabase: Adding server_farm_id column to poultry_batches...`);
            this.db.execSync(`ALTER TABLE poultry_batches ADD COLUMN server_farm_id TEXT DEFAULT NULL`);
            console.log(`✅ FastDatabase: Added server_farm_id column to poultry_batches`);
          }

          // SCHEMA FIX: Add organization_id to farms
          if (tableName === 'farms' && !existingColumnNames.includes('organization_id')) {
            console.log(`🔄 FastDatabase: Adding organization_id column to farms...`);
            this.db.execSync(`ALTER TABLE farms ADD COLUMN organization_id INTEGER`);
            console.log(`✅ FastDatabase: Added organization_id column to farms`);
          }

          // SCHEMA FIX: Add organization_id to poultry_batches (for multi-tenant support)
          if (tableName === 'poultry_batches' && !existingColumnNames.includes('organization_id')) {
            console.log(`🔄 FastDatabase: Adding organization_id column to poultry_batches...`);
            this.db.execSync(`ALTER TABLE poultry_batches ADD COLUMN organization_id INTEGER`);
            console.log(`✅ FastDatabase: Added organization_id column to poultry_batches`);
          }

          // SCHEMA FIX: Add age_weeks to poultry_batches
          if (tableName === 'poultry_batches' && !existingColumnNames.includes('age_weeks')) {
            console.log(`🔄 FastDatabase: Adding age_weeks column to poultry_batches...`);
            this.db.execSync(`ALTER TABLE poultry_batches ADD COLUMN age_weeks INTEGER`);
            console.log(`✅ FastDatabase: Added age_weeks column to poultry_batches`);
          }

          // SCHEMA FIX: Add missing columns to feed_records
          if (tableName === 'feed_records') {
            if (!existingColumnNames.includes('organization_id')) {
              console.log(`🔄 FastDatabase: Adding organization_id column to feed_records...`);
              this.db.execSync(`ALTER TABLE feed_records ADD COLUMN organization_id INTEGER`);
              console.log(`✅ FastDatabase: Added organization_id column to feed_records`);
            }
            if (!existingColumnNames.includes('fed_by')) {
              console.log(`🔄 FastDatabase: Adding fed_by column to feed_records...`);
              this.db.execSync(`ALTER TABLE feed_records ADD COLUMN fed_by INTEGER`);
              console.log(`✅ FastDatabase: Added fed_by column to feed_records`);
            }
            if (!existingColumnNames.includes('cost_per_kg')) {
              console.log(`🔄 FastDatabase: Adding cost_per_kg column to feed_records...`);
              this.db.execSync(`ALTER TABLE feed_records ADD COLUMN cost_per_kg REAL`);
              console.log(`✅ FastDatabase: Added cost_per_kg column to feed_records`);
            }
            if (!existingColumnNames.includes('total_cost')) {
              console.log(`🔄 FastDatabase: Adding total_cost column to feed_records...`);
              this.db.execSync(`ALTER TABLE feed_records ADD COLUMN total_cost REAL`);
              console.log(`✅ FastDatabase: Added total_cost column to feed_records`);
            }
            if (!existingColumnNames.includes('supplier')) {
              console.log(`🔄 FastDatabase: Adding supplier column to feed_records...`);
              this.db.execSync(`ALTER TABLE feed_records ADD COLUMN supplier TEXT`);
              console.log(`✅ FastDatabase: Added supplier column to feed_records`);
            }
            if (!existingColumnNames.includes('date')) {
              console.log(`🔄 FastDatabase: Adding date column to feed_records...`);
              this.db.execSync(`ALTER TABLE feed_records ADD COLUMN date TEXT`);
              console.log(`✅ FastDatabase: Added date column to feed_records`);
            }
          }

          // SCHEMA FIX: Add missing columns to mortality_records
          if (tableName === 'mortality_records') {
            if (!existingColumnNames.includes('organization_id')) {
              console.log(`🔄 FastDatabase: Adding organization_id column to mortality_records...`);
              this.db.execSync(`ALTER TABLE mortality_records ADD COLUMN organization_id INTEGER`);
              console.log(`✅ FastDatabase: Added organization_id column to mortality_records`);
            }
            if (!existingColumnNames.includes('recorded_by')) {
              console.log(`🔄 FastDatabase: Adding recorded_by column to mortality_records...`);
              this.db.execSync(`ALTER TABLE mortality_records ADD COLUMN recorded_by INTEGER`);
              console.log(`✅ FastDatabase: Added recorded_by column to mortality_records`);
            }
            if (!existingColumnNames.includes('death_count')) {
              console.log(`🔄 FastDatabase: Adding death_count column to mortality_records...`);
              this.db.execSync(`ALTER TABLE mortality_records ADD COLUMN death_count INTEGER`);
              console.log(`✅ FastDatabase: Added death_count column to mortality_records`);
            }
            if (!existingColumnNames.includes('death_date')) {
              console.log(`🔄 FastDatabase: Adding death_date column to mortality_records...`);
              this.db.execSync(`ALTER TABLE mortality_records ADD COLUMN death_date TEXT`);
              console.log(`✅ FastDatabase: Added death_date column to mortality_records`);
            }
            if (!existingColumnNames.includes('date')) {
              console.log(`🔄 FastDatabase: Adding date column to mortality_records...`);
              this.db.execSync(`ALTER TABLE mortality_records ADD COLUMN date TEXT`);
              console.log(`✅ FastDatabase: Added date column to mortality_records`);
            }
            if (!existingColumnNames.includes('count')) {
              console.log(`🔄 FastDatabase: Adding count column to mortality_records...`);
              this.db.execSync(`ALTER TABLE mortality_records ADD COLUMN count INTEGER`);
              console.log(`✅ FastDatabase: Added count column to mortality_records`);
            }
          }

          // SCHEMA FIX: Add missing columns to production_records
          if (tableName === 'production_records') {
            if (!existingColumnNames.includes('organization_id')) {
              console.log(`🔄 FastDatabase: Adding organization_id column to production_records...`);
              this.db.execSync(`ALTER TABLE production_records ADD COLUMN organization_id INTEGER`);
              console.log(`✅ FastDatabase: Added organization_id column to production_records`);
            }
            if (!existingColumnNames.includes('broken_eggs')) {
              console.log(`🔄 FastDatabase: Adding broken_eggs column to production_records...`);
              this.db.execSync(`ALTER TABLE production_records ADD COLUMN broken_eggs INTEGER DEFAULT 0`);
              console.log(`✅ FastDatabase: Added broken_eggs column to production_records`);
            }
            if (!existingColumnNames.includes('eggs_broken')) {
              console.log(`🔄 FastDatabase: Adding eggs_broken column to production_records...`);
              this.db.execSync(`ALTER TABLE production_records ADD COLUMN eggs_broken INTEGER DEFAULT 0`);
              console.log(`✅ FastDatabase: Added eggs_broken column to production_records`);
            }
            if (!existingColumnNames.includes('abnormal_eggs')) {
              console.log(`🔄 FastDatabase: Adding abnormal_eggs column to production_records...`);
              this.db.execSync(`ALTER TABLE production_records ADD COLUMN abnormal_eggs INTEGER DEFAULT 0`);
              console.log(`✅ FastDatabase: Added abnormal_eggs column to production_records`);
            }
            if (!existingColumnNames.includes('collected_by')) {
              console.log(`🔄 FastDatabase: Adding collected_by column to production_records...`);
              this.db.execSync(`ALTER TABLE production_records ADD COLUMN collected_by INTEGER`);
              console.log(`✅ FastDatabase: Added collected_by column to production_records`);
            }
            if (!existingColumnNames.includes('date')) {
              console.log(`🔄 FastDatabase: Adding date column to production_records...`);
              this.db.execSync(`ALTER TABLE production_records ADD COLUMN date TEXT`);
              console.log(`✅ FastDatabase: Added date column to production_records`);
            }
            if (!existingColumnNames.includes('date_recorded')) {
              console.log(`🔄 FastDatabase: Adding date_recorded column to production_records...`);
              this.db.execSync(`ALTER TABLE production_records ADD COLUMN date_recorded TEXT`);
              console.log(`✅ FastDatabase: Added date_recorded column to production_records`);
            }
          }

          // SCHEMA FIX: Add missing columns to health_records (15 columns!)
          if (tableName === 'health_records') {
            const healthColumnsToAdd = [
              { name: 'organization_id', type: 'INTEGER' },
              { name: 'symptoms', type: 'TEXT' },
              { name: 'medication', type: 'TEXT' },
              { name: 'treatment_date', type: 'TEXT' },
              { name: 'recovery_date', type: 'TEXT' },
              { name: 'mortality_count', type: 'INTEGER', default: 0 },
              { name: 'mortality_cause', type: 'TEXT' },
              { name: 'recorded_by', type: 'INTEGER' },
              { name: 'vet_id', type: 'INTEGER' },
              { name: 'vaccination_type', type: 'TEXT' },
              { name: 'disease', type: 'TEXT' },
              { name: 'individual_bird_id', type: 'TEXT' },
              { name: 'record_date', type: 'TEXT' },
              { name: 'date', type: 'TEXT' },
              { name: 'health_status', type: 'TEXT', default: "'healthy'" }
            ];

            for (const col of healthColumnsToAdd) {
              if (!existingColumnNames.includes(col.name)) {
                console.log(`🔄 FastDatabase: Adding ${col.name} column to health_records...`);
                const defaultClause = col.default !== undefined ? ` DEFAULT ${col.default}` : '';
                this.db.execSync(`ALTER TABLE health_records ADD COLUMN ${col.name} ${col.type}${defaultClause}`);
                console.log(`✅ FastDatabase: Added ${col.name} column to health_records`);
              }
            }
          }

          // SCHEMA FIX: Add missing columns to water_records
          if (tableName === 'water_records') {
            if (!existingColumnNames.includes('organization_id')) {
              console.log(`🔄 FastDatabase: Adding organization_id column to water_records...`);
              this.db.execSync(`ALTER TABLE water_records ADD COLUMN organization_id INTEGER`);
              console.log(`✅ FastDatabase: Added organization_id column to water_records`);
            }
            if (!existingColumnNames.includes('recorded_by')) {
              console.log(`🔄 FastDatabase: Adding recorded_by column to water_records...`);
              this.db.execSync(`ALTER TABLE water_records ADD COLUMN recorded_by INTEGER`);
              console.log(`✅ FastDatabase: Added recorded_by column to water_records`);
            }
            if (!existingColumnNames.includes('date')) {
              console.log(`🔄 FastDatabase: Adding date column to water_records...`);
              this.db.execSync(`ALTER TABLE water_records ADD COLUMN date TEXT`);
              console.log(`✅ FastDatabase: Added date column to water_records`);
            }
            if (!existingColumnNames.includes('date_recorded')) {
              console.log(`🔄 FastDatabase: Adding date_recorded column to water_records...`);
              this.db.execSync(`ALTER TABLE water_records ADD COLUMN date_recorded TEXT`);
              console.log(`✅ FastDatabase: Added date_recorded column to water_records`);
            }
          }

          // SCHEMA FIX: Add missing columns to weight_records
          if (tableName === 'weight_records') {
            if (!existingColumnNames.includes('organization_id')) {
              console.log(`🔄 FastDatabase: Adding organization_id column to weight_records...`);
              this.db.execSync(`ALTER TABLE weight_records ADD COLUMN organization_id INTEGER`);
              console.log(`✅ FastDatabase: Added organization_id column to weight_records`);
            }
            if (!existingColumnNames.includes('age_weeks')) {
              console.log(`🔄 FastDatabase: Adding age_weeks column to weight_records...`);
              this.db.execSync(`ALTER TABLE weight_records ADD COLUMN age_weeks INTEGER`);
              console.log(`✅ FastDatabase: Added age_weeks column to weight_records`);
            }
            if (!existingColumnNames.includes('recorded_by')) {
              console.log(`🔄 FastDatabase: Adding recorded_by column to weight_records...`);
              this.db.execSync(`ALTER TABLE weight_records ADD COLUMN recorded_by INTEGER`);
              console.log(`✅ FastDatabase: Added recorded_by column to weight_records`);
            }
            if (!existingColumnNames.includes('date')) {
              console.log(`🔄 FastDatabase: Adding date column to weight_records...`);
              this.db.execSync(`ALTER TABLE weight_records ADD COLUMN date TEXT`);
              console.log(`✅ FastDatabase: Added date column to weight_records`);
            }
            if (!existingColumnNames.includes('date_recorded')) {
              console.log(`🔄 FastDatabase: Adding date_recorded column to weight_records...`);
              this.db.execSync(`ALTER TABLE weight_records ADD COLUMN date_recorded TEXT`);
              console.log(`✅ FastDatabase: Added date_recorded column to weight_records`);
            }
            if (!existingColumnNames.includes('average_weight_kg')) {
              console.log(`🔄 FastDatabase: Adding average_weight_kg column to weight_records...`);
              this.db.execSync(`ALTER TABLE weight_records ADD COLUMN average_weight_kg REAL`);
              console.log(`✅ FastDatabase: Added average_weight_kg column to weight_records`);
            }
          }

          console.log(`✅ FastDatabase: Table ${tableName} migration complete`);

        } catch (tableError) {
          console.warn(`⚠️  FastDatabase: Failed to migrate table ${tableName}:`, tableError.message);
          // Continue with other tables even if one fails
        }
      }

      console.log('✅ FastDatabase: Comprehensive migration complete');

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

      const requiredTables = ['users', 'farms', 'poultry_batches', 'feed_records', 'health_records', 'mortality_records', 'production_records', 'water_records', 'weight_records', 'vaccination_records', 'expenses', 'id_mappings', 'sync_conflicts', 'sync_queue'];
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
            password_hash TEXT,
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
            server_id TEXT UNIQUE,
            organization_id INTEGER,
            farm_name TEXT NOT NULL,
            location TEXT,
            farm_type TEXT DEFAULT 'broiler',
            description TEXT,
            needs_sync INTEGER DEFAULT 1,
            synced_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0
          );
        `);
        console.log('✅ FastDatabase: Created farms table with sync columns and organization_id');
      }

      if (missingTables.includes('poultry_batches')) {
        this.db.execSync(`
          CREATE TABLE poultry_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            batch_name TEXT NOT NULL,
            breed TEXT,
            initial_count INTEGER DEFAULT 0,
            current_count INTEGER DEFAULT 0,
            farm_id INTEGER,
            server_farm_id TEXT,
            arrival_date TEXT,
            age_weeks INTEGER,
            status TEXT DEFAULT 'active',
            needs_sync INTEGER DEFAULT 1,
            synced_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created poultry_batches table with all required columns including age_weeks');
      }

      if (missingTables.includes('feed_records')) {
        this.db.execSync(`
          CREATE TABLE feed_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            farm_id INTEGER,
            batch_id INTEGER,
            date_fed TEXT,
            date TEXT,
            quantity_kg REAL,
            feed_type TEXT,
            cost REAL,
            cost_per_kg REAL,
            total_cost REAL,
            supplier TEXT,
            fed_by INTEGER,
            notes TEXT,
            needs_sync INTEGER DEFAULT 1,
            synced_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created feed_records table with all required columns including cost_per_kg');
      }

      if (missingTables.includes('health_records')) {
        this.db.execSync(`
          CREATE TABLE health_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            farm_id INTEGER,
            batch_id INTEGER,
            individual_bird_id TEXT,
            health_status TEXT DEFAULT 'healthy',
            symptoms TEXT,
            treatment TEXT,
            medication TEXT,
            treatment_date TEXT,
            recovery_date TEXT,
            mortality_count INTEGER DEFAULT 0,
            mortality_cause TEXT,
            vaccination_type TEXT,
            disease TEXT,
            record_date TEXT,
            date TEXT,
            recorded_by INTEGER,
            vet_id INTEGER,
            notes TEXT,
            needs_sync INTEGER DEFAULT 1,
            synced_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created health_records table with all required columns');
      }

      if (missingTables.includes('mortality_records')) {
        this.db.execSync(`
          CREATE TABLE mortality_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            farm_id INTEGER,
            batch_id INTEGER,
            death_date TEXT,
            date TEXT,
            date_recorded TEXT,
            death_count INTEGER,
            count INTEGER,
            cause TEXT,
            recorded_by INTEGER,
            notes TEXT,
            needs_sync INTEGER DEFAULT 1,
            synced_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created mortality_records table with all required columns');
      }

      if (missingTables.includes('production_records')) {
        this.db.execSync(`
          CREATE TABLE production_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            farm_id INTEGER,
            batch_id INTEGER,
            date_recorded TEXT,
            date TEXT,
            eggs_collected INTEGER,
            broken_eggs INTEGER DEFAULT 0,
            eggs_broken INTEGER DEFAULT 0,
            abnormal_eggs INTEGER DEFAULT 0,
            egg_weight_avg REAL,
            collected_by INTEGER,
            notes TEXT,
            needs_sync INTEGER DEFAULT 1,
            synced_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created production_records table with all required columns');
      }

      if (missingTables.includes('water_records')) {
        this.db.execSync(`
          CREATE TABLE water_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            batch_id INTEGER NOT NULL,
            farm_id INTEGER,
            date_recorded TEXT NOT NULL,
            date TEXT,
            quantity_liters REAL NOT NULL,
            water_source TEXT,
            quality TEXT,
            temperature_celsius REAL,
            recorded_by INTEGER,
            notes TEXT,
            needs_sync INTEGER DEFAULT 1,
            synced_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created water_records table with all required columns');
      }

      if (missingTables.includes('weight_records')) {
        this.db.execSync(`
          CREATE TABLE weight_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            batch_id INTEGER NOT NULL,
            farm_id INTEGER,
            date_recorded TEXT NOT NULL,
            date TEXT,
            average_weight_grams REAL NOT NULL,
            average_weight_kg REAL,
            sample_size INTEGER NOT NULL,
            min_weight_grams REAL,
            max_weight_grams REAL,
            age_weeks INTEGER,
            recorded_by INTEGER,
            notes TEXT,
            needs_sync INTEGER DEFAULT 1,
            synced_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created weight_records table with all required columns');
      }

      if (missingTables.includes('vaccination_records')) {
        this.db.execSync(`
          CREATE TABLE vaccination_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            batch_id INTEGER NOT NULL,
            farm_id INTEGER,
            vaccination_type TEXT NOT NULL,
            vaccination_date TEXT NOT NULL,
            vaccination_time TEXT,
            medication TEXT,
            administered_by INTEGER,
            notes TEXT,
            date TEXT,
            needs_sync INTEGER DEFAULT 1,
            synced_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches (id) ON DELETE CASCADE,
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
          );
        `);
        console.log('✅ FastDatabase: Created vaccination_records table with all required columns');
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

      // P0-1 FIX: Create centralized ID mapping table
      if (missingTables.includes('id_mappings')) {
        this.db.execSync(`
          CREATE TABLE id_mappings (
            local_table TEXT NOT NULL,
            local_id INTEGER NOT NULL,
            server_id TEXT NOT NULL,
            synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
            entity_type TEXT,
            PRIMARY KEY (local_table, local_id)
          );
        `);
        console.log('✅ FastDatabase: Created id_mappings table for local↔server ID tracking');

        // Create index for fast lookups
        this.db.execSync(`
          CREATE INDEX idx_id_mappings_lookup ON id_mappings(local_table, local_id);
        `);
        this.db.execSync(`
          CREATE INDEX idx_id_mappings_reverse ON id_mappings(local_table, server_id);
        `);
      }

      // P0-4 FIX: Create sync conflicts table for conflict resolution
      if (missingTables.includes('sync_conflicts')) {
        this.db.execSync(`
          CREATE TABLE sync_conflicts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            local_id INTEGER NOT NULL,
            server_id TEXT,
            local_data TEXT NOT NULL,
            server_data TEXT NOT NULL,
            conflict_type TEXT NOT NULL,
            detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
            resolved_at TEXT,
            resolution_strategy TEXT,
            resolved_by TEXT,
            notes TEXT
          );
        `);
        console.log('✅ FastDatabase: Created sync_conflicts table for conflict detection');

        // Create index for pending conflicts
        this.db.execSync(`
          CREATE INDEX idx_sync_conflicts_pending ON sync_conflicts(table_name, resolved_at);
        `);
      }

      // CRITICAL FIX: Create sync_queue table for offline sync management
      // This table tracks all pending, syncing, synced, and failed sync operations
      if (missingTables.includes('sync_queue')) {
        this.db.execSync(`
          CREATE TABLE sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
            local_id TEXT NOT NULL,
            server_id TEXT,
            data TEXT NOT NULL,
            sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')),
            retry_count INTEGER DEFAULT 0,
            error_message TEXT,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced_at TEXT
          );
        `);
        console.log('✅ FastDatabase: Created sync_queue table for offline sync tracking');

        // Create indexes for efficient sync queue queries
        this.db.execSync(`
          CREATE INDEX idx_sync_queue_status ON sync_queue(sync_status, created_at);
        `);
        this.db.execSync(`
          CREATE INDEX idx_sync_queue_table ON sync_queue(table_name, sync_status);
        `);
        this.db.execSync(`
          CREATE INDEX idx_sync_queue_local_id ON sync_queue(table_name, local_id);
        `);
        console.log('✅ FastDatabase: Created sync_queue indexes for performance');
      }

      // Verify tables were created
      const tables = this.db.getAllSync(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`);
      console.log('✅ FastDatabase: Created tables:', tables.map(t => t.name));

      // SECURITY FIX: Add password_hash column to existing users table if missing
      this.addPasswordHashColumnIfMissing();

      // CRASH FIX: Create critical indexes for multi-tenancy and performance
      this.createCriticalIndexes();

      // Initialize demo users with hashed passwords
      this.initializeDemoUsers();

      // DISABLED: Demo data causes crashes - users will create their own data
      // this.initializeDemoData();

    } catch (error) {
      console.error('❌ FastDatabase: Table creation failed:', error);
      console.error('❌ FastDatabase: Error details:', error.message);
      // CRASH FIX: DON'T throw - log and continue
      // App can work with empty tables or retry later
      console.warn('⚠️  FastDatabase: Continuing despite table creation errors');
    }
  }

  // CRASH FIX: Create critical indexes for multi-tenancy and performance
  // Prevents "no such column: organization_id" errors when querying with WHERE organization_id
  createCriticalIndexes() {
    try {
      console.log('🔄 FastDatabase: Creating critical indexes...');

      const indexes = [
        // Multi-tenancy indexes (CRITICAL for organization_id queries)
        'CREATE INDEX IF NOT EXISTS idx_farms_organization ON farms(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id)',

        // Foreign key indexes for joins
        'CREATE INDEX IF NOT EXISTS idx_batches_farm ON poultry_batches(farm_id)',
        'CREATE INDEX IF NOT EXISTS idx_feed_batch ON feed_records(batch_id)',
        'CREATE INDEX IF NOT EXISTS idx_production_batch ON production_records(batch_id)',
        'CREATE INDEX IF NOT EXISTS idx_mortality_batch ON mortality_records(batch_id)',
        'CREATE INDEX IF NOT EXISTS idx_health_batch ON health_records(batch_id)',
        'CREATE INDEX IF NOT EXISTS idx_water_batch ON water_records(batch_id)',
        'CREATE INDEX IF NOT EXISTS idx_weight_batch ON weight_records(batch_id)',

        // Sync status indexes
        'CREATE INDEX IF NOT EXISTS idx_farms_needs_sync ON farms(needs_sync)',
        'CREATE INDEX IF NOT EXISTS idx_batches_needs_sync ON poultry_batches(needs_sync)',

        // Date-based query indexes
        'CREATE INDEX IF NOT EXISTS idx_feed_date ON feed_records(date)',
        'CREATE INDEX IF NOT EXISTS idx_production_date ON production_records(date)',
        'CREATE INDEX IF NOT EXISTS idx_mortality_date ON mortality_records(date)',
        'CREATE INDEX IF NOT EXISTS idx_health_date ON health_records(date)',

        // Soft delete indexes
        'CREATE INDEX IF NOT EXISTS idx_farms_deleted ON farms(is_deleted)',
        'CREATE INDEX IF NOT EXISTS idx_batches_deleted ON poultry_batches(is_deleted)',

        // Batch status index
        'CREATE INDEX IF NOT EXISTS idx_batches_status ON poultry_batches(status)'
      ];

      let createdCount = 0;
      for (const indexSql of indexes) {
        try {
          this.db.execSync(indexSql);
          createdCount++;
        } catch (indexError) {
          // CRASH FIX: Log but don't fail if index already exists
          if (!indexError.message.includes('already exists')) {
            console.warn(`⚠️  Failed to create index: ${indexError.message}`);
          }
        }
      }

      console.log(`✅ FastDatabase: Created ${createdCount} indexes successfully`);
    } catch (error) {
      console.error('❌ FastDatabase: Index creation failed:', error);
      // CRASH FIX: Don't throw - indexes are performance optimization, not critical
      console.warn('⚠️  FastDatabase: Continuing without all indexes');
    }
  }


  // SECURITY FIX: Add password_hash column to existing users table if missing
  addPasswordHashColumnIfMissing() {
    try {
      console.log('🔄 FastDatabase: Checking if password_hash column exists...');

      // Check if users table exists
      const tables = this.db.getAllSync(`SELECT name FROM sqlite_master WHERE type='table' AND name='users';`);
      if (!tables || tables.length === 0) {
        console.log('⚠️  FastDatabase: Users table does not exist yet, skipping password_hash migration');
        return;
      }

      // Check if password_hash column exists
      const columns = this.db.getAllSync(`PRAGMA table_info(users);`);
      const hasPasswordHash = columns.some(col => col.name === 'password_hash');

      if (hasPasswordHash) {
        console.log('✅ FastDatabase: password_hash column already exists');
        return;
      }

      // Add password_hash column to existing users table
      console.log('🔄 FastDatabase: Adding password_hash column to users table...');
      this.db.execSync(`ALTER TABLE users ADD COLUMN password_hash TEXT;`);
      console.log('✅ FastDatabase: password_hash column added successfully');
    } catch (error) {
      console.error('❌ FastDatabase: Failed to add password_hash column:', error.message);
      // Don't throw - app can continue, but login will fail
      console.warn('⚠️  FastDatabase: Continuing without password_hash column - login security may be compromised');
    }
  }

  // SECURITY FIX: Simple password hashing (for demo purposes - use bcrypt in production)
  hashPassword(password) {
    // Simple hash using base64 encoding (NOT SECURE FOR PRODUCTION)
    // In production, use bcrypt or similar: const bcrypt = require('bcryptjs');
    // return bcrypt.hashSync(password, 10);

    // For demo/offline mode, we'll use a simple reversible encoding
    // This allows us to validate passwords without external dependencies
    try {
      return Buffer.from(password).toString('base64');
    } catch (error) {
      console.error('❌ FastDatabase: Password hashing failed:', error.message);
      return null;
    }
  }

  // SECURITY FIX: Validate user credentials with password check
  validateUserCredentials(email, password) {
    try {
      console.log(`🔄 FastDatabase: Validating credentials for ${email}`);

      // CRITICAL: Validate inputs first
      if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        console.warn('FastDatabase: Invalid email or password provided to validateUserCredentials');
        return null;
      }

      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult) {
          console.warn('FastDatabase init failed in validateUserCredentials');
          return null;
        }
      }

      // Double check database is available
      if (!this.db || typeof this.db.getFirstSync !== 'function') {
        console.warn('Database not available in validateUserCredentials');
        return null;
      }

      // Get user by email
      const user = this.db.getFirstSync(`SELECT * FROM users WHERE email = ?`, [email]);

      if (!user) {
        console.warn(`FastDatabase: No user found with email ${email}`);
        return null;
      }

      // Check if password_hash exists
      if (!user.password_hash) {
        console.warn(`FastDatabase: User ${email} has no password_hash - cannot validate`);
        return null;
      }

      // Hash the provided password and compare
      const hashedPassword = this.hashPassword(password);

      if (hashedPassword !== user.password_hash) {
        console.warn(`FastDatabase: Password validation failed for ${email}`);
        return null;
      }

      console.log(`✅ FastDatabase: Credentials validated successfully for ${email}`);
      return user;
    } catch (error) {
      console.warn('validateUserCredentials error:', error.message);
      // CRASH FIX: Always return null on error, never throw
      return null;
    }
  }

  // SECURITY FIX: Initialize demo users with hashed passwords
  initializeDemoUsers() {
    try {
      console.log('🔄 FastDatabase: Checking if demo users exist...');

      // Check if we already have demo users
      const existingUsers = this.db.getAllSync(`SELECT COUNT(*) as count FROM users`);
      if (existingUsers && existingUsers[0].count > 0) {
        console.log('✅ FastDatabase: Demo users already exist, skipping initialization');
        return;
      }

      console.log('🔄 FastDatabase: Initializing demo users...');

      // Create demo users with hashed passwords
      const demoUsers = [
        {
          email: 'demo@poultry360.com',
          password: 'demo123',
          first_name: 'Demo',
          last_name: 'User',
          role: 'farm_worker',
          organization_id: 1,
          organization_name: 'Demo Organization',
          organization_slug: 'demo-org'
        },
        {
          email: 'owner@poultry360.com',
          password: 'owner123',
          first_name: 'Farm',
          last_name: 'Owner',
          role: 'farm_owner',
          organization_id: 1,
          organization_name: 'Demo Organization',
          organization_slug: 'demo-org'
        },
        {
          email: 'admin@poultry360.com',
          password: 'admin123',
          first_name: 'System',
          last_name: 'Admin',
          role: 'admin',
          organization_id: 1,
          organization_name: 'Demo Organization',
          organization_slug: 'demo-org'
        }
      ];

      for (const user of demoUsers) {
        const passwordHash = this.hashPassword(user.password);

        this.db.runSync(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, organization_id, organization_name, organization_slug, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.email,
            passwordHash,
            user.first_name,
            user.last_name,
            user.role,
            user.organization_id,
            user.organization_name,
            user.organization_slug,
            new Date().toISOString()
          ]
        );

        console.log(`✅ FastDatabase: Created demo user ${user.email} with role ${user.role}`);
      }

      console.log('✅ FastDatabase: Demo users initialization complete!');
    } catch (error) {
      console.error('❌ FastDatabase: Demo users initialization failed:', error.message);
      console.error('   Error stack:', error.stack);
      // Don't throw - app can still work without demo users
      console.warn('⚠️  FastDatabase: Continuing without demo users');
    }
  }

  // DEMO DATA INITIALIZATION - Critical for offline-first demo mode
  initializeDemoData() {
    try {
      console.log('🔄 FastDatabase: Checking if demo data exists...');

      // Check if we already have demo data
      const existingFarms = this.db.getAllSync(`SELECT COUNT(*) as count FROM farms`);
      if (existingFarms && existingFarms[0].count > 0) {
        console.log('✅ FastDatabase: Demo data already exists, skipping initialization');
        return;
      }

      console.log('🔄 FastDatabase: Initializing demo data...');

      // Create demo farms
      const demoFarms = [
        {
          farm_name: 'Green Valley Farm',
          location: 'North District',
          farm_type: 'broiler',
          description: 'Main broiler farm - Demo data',
          server_id: null,
          needs_sync: 1,
          synced_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: 0
        },
        {
          farm_name: 'Sunrise Poultry',
          location: 'East District',
          farm_type: 'layer',
          description: 'Layer farm - Demo data',
          server_id: null,
          needs_sync: 1,
          synced_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: 0
        }
      ];

      const farmIds = [];
      for (const farm of demoFarms) {
        const result = this.db.runSync(
          `INSERT INTO farms (farm_name, location, farm_type, description, server_id, needs_sync, synced_at, created_at, updated_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [farm.farm_name, farm.location, farm.farm_type, farm.description, farm.server_id, farm.needs_sync, farm.synced_at, farm.created_at, farm.updated_at, farm.is_deleted]
        );
        farmIds.push(result.lastInsertRowId);
        console.log(`✅ FastDatabase: Created demo farm "${farm.farm_name}" with ID ${result.lastInsertRowId}`);
      }

      // Create demo batches
      const demoBatches = [
        {
          batch_name: 'Batch A - Broilers',
          breed: 'Cobb 500',
          initial_count: 1000,
          current_count: 980,
          farm_id: farmIds[0],
          server_farm_id: null,
          arrival_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          status: 'active',
          server_id: null,
          needs_sync: 1,
          synced_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: 0
        },
        {
          batch_name: 'Batch B - Layers',
          breed: 'Lohmann Brown',
          initial_count: 500,
          current_count: 495,
          farm_id: farmIds[1],
          server_farm_id: null,
          arrival_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
          status: 'active',
          server_id: null,
          needs_sync: 1,
          synced_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: 0
        }
      ];

      const batchIds = [];
      for (const batch of demoBatches) {
        const result = this.db.runSync(
          `INSERT INTO poultry_batches (batch_name, breed, initial_count, current_count, farm_id, server_farm_id, arrival_date, status, server_id, needs_sync, synced_at, created_at, updated_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [batch.batch_name, batch.breed, batch.initial_count, batch.current_count, batch.farm_id, batch.server_farm_id, batch.arrival_date, batch.status, batch.server_id, batch.needs_sync, batch.synced_at, batch.created_at, batch.updated_at, batch.is_deleted]
        );
        batchIds.push(result.lastInsertRowId);
        console.log(`✅ FastDatabase: Created demo batch "${batch.batch_name}" with ID ${result.lastInsertRowId}`);
      }

      // Create some demo records for each batch
      const today = new Date().toISOString();

      // Feed records
      this.db.runSync(
        `INSERT INTO feed_records (batch_id, feed_type, quantity_kg, cost_per_kg, total_cost, date, notes, created_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [batchIds[0], 'Starter Feed', 50, 50, 2500, today, 'Daily feed for broilers', today, 0]
      );

      // Production records (for layers)
      this.db.runSync(
        `INSERT INTO production_records (batch_id, eggs_collected, eggs_broken, date, notes, created_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batchIds[1], 450, 15, today, 'Daily egg production', today, 0]
      );

      // Mortality records
      this.db.runSync(
        `INSERT INTO mortality_records (batch_id, death_count, cause, death_date, notes, created_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batchIds[0], 5, 'Natural causes', today, 'Normal mortality rate', today, 0]
      );

      // Health records
      this.db.runSync(
        `INSERT INTO health_records (batch_id, health_status, treatment, medication, record_date, notes, created_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [batchIds[0], 'Routine check', 'Vaccination', 'Newcastle vaccine', today, 'Routine vaccination', today, 0]
      );

      // Water records
      this.db.runSync(
        `INSERT INTO water_records (batch_id, quantity_liters, date, notes, created_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [batchIds[0], 500, today, 'Daily water consumption', today, 0]
      );

      // Weight records
      this.db.runSync(
        `INSERT INTO weight_records (batch_id, average_weight_kg, sample_size, date, notes, created_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batchIds[0], 1.8, 20, today, 'Weekly weight measurement', today, 0]
      );

      console.log('✅ FastDatabase: Demo data initialization complete!');
      console.log(`   - Created ${farmIds.length} demo farms`);
      console.log(`   - Created ${batchIds.length} demo batches`);
      console.log('   - Created sample records (feed, production, mortality, health, water, weight)');

    } catch (error) {
      console.error('❌ FastDatabase: Demo data initialization failed:', error.message);
      console.error('   Error stack:', error.stack);
      // Don't throw - app can still work without demo data
      console.warn('⚠️  FastDatabase: Continuing without demo data');
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

  // SECURITY FIX: Create user with hashed password
  createUser(userData) {
    try {
      console.log(`🔄 FastDatabase: Creating user with email ${userData.email}`);

      // CRITICAL: Validate input first
      if (!userData || !userData.email || !userData.password) {
        console.error('FastDatabase: Invalid user data - email and password required');
        return null;
      }

      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult) {
          console.error('FastDatabase init failed in createUser');
          return null;
        }
      }

      // Double check database is available
      if (!this.db || typeof this.db.runSync !== 'function') {
        console.error('Database not available in createUser');
        return null;
      }

      // Check if user already exists
      const existingUser = this.getUserByEmail(userData.email);
      if (existingUser) {
        console.warn(`FastDatabase: User with email ${userData.email} already exists`);
        return null;
      }

      // Hash the password
      const passwordHash = this.hashPassword(userData.password);
      if (!passwordHash) {
        console.error('FastDatabase: Failed to hash password');
        return null;
      }

      // Insert user into database
      const result = this.db.runSync(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, organization_id, organization_name, organization_slug, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userData.email,
          passwordHash,
          userData.firstName || userData.first_name || '',
          userData.lastName || userData.last_name || '',
          userData.role || 'farm_worker',
          userData.organizationId || userData.organization_id || 1,
          userData.organizationName || userData.organization_name || 'Demo Organization',
          userData.organizationSlug || userData.organization_slug || 'demo-org',
          new Date().toISOString()
        ]
      );

      const userId = result.lastInsertRowId;
      console.log(`✅ FastDatabase: User created successfully with ID ${userId}`);

      // Return the created user
      return this.getUserByEmail(userData.email);
    } catch (error) {
      console.error('FastDatabase: createUser error:', error.message);
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

      // Get fresh counts from database with organization filtering
      console.log('🔄 FastDatabase: Querying farms count...');
      console.log(`🏢 FastDatabase: Filtering by organization_id = ${this.currentOrganizationId}`);

      // Build WHERE clause for organization filtering
      const orgFilter = this.currentOrganizationId
        ? `WHERE organization_id = ${this.currentOrganizationId}`
        : '';
      const farmsQuery = `SELECT COUNT(*) as count FROM farms ${orgFilter}`;
      console.log(`📝 Query: ${farmsQuery}`);

      const farms = this.db.getFirstSync(farmsQuery);
      console.log('✅ FastDatabase: Farms count result:', farms);

      console.log('🔄 FastDatabase: Querying batches count...');
      // For batches, join with farms to filter by organization
      const batchesQuery = this.currentOrganizationId
        ? `SELECT COUNT(*) as count FROM poultry_batches pb
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}`
        : `SELECT COUNT(*) as count FROM poultry_batches`;
      console.log(`📝 Query: ${batchesQuery}`);

      const batches = this.db.getFirstSync(batchesQuery);
      console.log('✅ FastDatabase: Batches count result:', batches);

      // Calculate total birds from batches in user's organization only
      console.log('🔄 FastDatabase: Calculating total birds...');
      const totalBirdsQuery = this.currentOrganizationId
        ? `SELECT SUM(pb.current_count) as total FROM poultry_batches pb
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}`
        : `SELECT SUM(current_count) as total FROM poultry_batches`;
      console.log(`📝 Query: ${totalBirdsQuery}`);

      const totalBirdsResult = this.db.getFirstSync(totalBirdsQuery);
      const totalBirds = totalBirdsResult?.total || 0;
      console.log('✅ FastDatabase: Total birds result:', totalBirds);

      // Get today's data
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log('🔄 FastDatabase: Today\'s date for queries:', today);

      // Get today's egg production (filtered by organization)
      console.log('🔄 FastDatabase: Querying today\'s egg production...');
      const todayEggsQuery = this.currentOrganizationId
        ? `SELECT SUM(pr.eggs_collected) as total
           FROM production_records pr
           INNER JOIN poultry_batches pb ON pr.batch_id = pb.id
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}
           AND DATE(COALESCE(pr.date, pr.date_recorded, pr.created_at)) = DATE('${today}')`
        : `SELECT SUM(eggs_collected) as total
           FROM production_records
           WHERE DATE(COALESCE(date, date_recorded, created_at)) = DATE('${today}')`;
      console.log(`📝 Query: ${todayEggsQuery}`);

      const todayEggs = this.db.getFirstSync(todayEggsQuery);
      console.log('✅ FastDatabase: Today\'s eggs result:', todayEggs);

      // Get today's mortality (filtered by organization)
      console.log('🔄 FastDatabase: Querying today\'s mortality...');
      const todayDeathsQuery = this.currentOrganizationId
        ? `SELECT SUM(mr.count) as total
           FROM mortality_records mr
           INNER JOIN poultry_batches pb ON mr.batch_id = pb.id
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}
           AND DATE(COALESCE(mr.date, mr.date_recorded, mr.created_at)) = DATE('${today}')`
        : `SELECT SUM(count) as total
           FROM mortality_records
           WHERE DATE(date) = DATE('${today}')`;
      console.log(`📝 Query: ${todayDeathsQuery}`);

      const todayDeaths = this.db.getFirstSync(todayDeathsQuery);
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

      // Apply organization filter
      const orgFilter = this.currentOrganizationId
        ? `AND organization_id = ${this.currentOrganizationId}`
        : '';
      const farmsQuery = `SELECT * FROM farms WHERE (is_deleted = 0 OR is_deleted IS NULL) ${orgFilter}`;
      console.log(`📝 Query: ${farmsQuery}`);
      console.log(`🏢 Filtering by organization_id: ${this.currentOrganizationId || 'NONE'}`);

      const farms = this.db.getAllSync(farmsQuery);
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

      // Apply organization filter via JOIN with farms
      const batchesQuery = this.currentOrganizationId
        ? `SELECT pb.* FROM poultry_batches pb
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}`
        : `SELECT * FROM poultry_batches`;
      console.log(`📝 Query: ${batchesQuery}`);
      console.log(`🏢 Filtering by organization_id: ${this.currentOrganizationId || 'NONE'}`);

      const batches = this.db.getAllSync(batchesQuery);
      console.log(`✅ FastDatabase: Retrieved ${batches.length} batches from database`);
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

      // SYNC FIX: Set sync flags and timestamps
      const serverId = farmData.server_id || null;
      const needsSync = farmData.needs_sync !== undefined ? farmData.needs_sync : 1;
      const syncedAt = farmData.synced_at || null;
      const now = new Date().toISOString();
      // CRITICAL FIX: Include organization_id for proper multi-tenancy
      const organizationId = farmData.organization_id || farmData.organizationId || this.currentOrganizationId;

      const result = this.db.runSync(
        `INSERT INTO farms (farm_name, location, farm_type, description, organization_id, server_id, needs_sync, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          farmData.name || 'Unnamed Farm',
          farmData.location || '',
          farmData.farmType || 'broiler',
          farmData.description || '',
          organizationId,
          serverId,
          needsSync,
          syncedAt,
          now,
          now
        ]
      );

      console.log(`✅ FastDatabase: Created farm with ID ${result.lastInsertRowId}, server_id: ${serverId || 'null'}, needs_sync: ${needsSync}`);

      return {
        id: result.lastInsertRowId,
        ...farmData,
        server_id: serverId,
        needs_sync: needsSync,
        synced_at: syncedAt,
        created_at: now,
        updated_at: now
      };
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
      this.beginTransaction();

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

      // SYNC FIX: Get farm's server_id for foreign key mapping
      const serverFarmId = farmExists.server_id || null;
      console.log(`🔍 FastDatabase: Farm server_id: ${serverFarmId || 'null (not synced yet)'}`);

      // SYNC FIX: Set sync flags and timestamps
      const serverId = batchData.server_id || null;
      const needsSync = batchData.needs_sync !== undefined ? batchData.needs_sync : 1;
      const syncedAt = batchData.synced_at || null;
      const now = new Date().toISOString();

      console.log('🔄 FastDatabase: Creating batch with data:', {
        batchName: batchData.batchName,
        birdType: batchData.birdType || batchData.breed,
        farmId: farmIdNum,
        serverFarmId: serverFarmId,
        initialCount: initialCountNum,
        currentCount: currentCountNum,
        serverId: serverId,
        needsSync: needsSync
      });

      const result = this.db.runSync(
        `INSERT INTO poultry_batches (batch_name, breed, initial_count, current_count, farm_id, server_farm_id, arrival_date, status, server_id, needs_sync, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchData.batchName,
          batchData.birdType || batchData.breed,
          initialCountNum,
          currentCountNum,
          farmIdNum,
          serverFarmId,
          batchData.arrivalDate,
          batchData.status || 'active',
          serverId,
          needsSync,
          syncedAt,
          now,
          now
        ]
      );

      console.log('✅ FastDatabase: Batch created successfully with ID:', result.lastInsertRowId);

      return {
        id: result.lastInsertRowId,
        ...batchData,
        farmId: farmIdNum,
        server_farm_id: serverFarmId,
        initialCount: initialCountNum,
        currentCount: currentCountNum,
        server_id: serverId,
        needs_sync: needsSync,
        synced_at: syncedAt,
        created_at: now,
        updated_at: now
      };
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

      // SCHEMA FIX: Use quantity_kg instead of quantity (matches schema column name)
      const result = this.db.runSync(
        `INSERT INTO feed_records (farm_id, batch_id, date, quantity_kg, feed_type, cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [recordData.farmId, recordData.batchId, recordData.date, recordData.quantityKg || recordData.quantity, recordData.feedType, recordData.cost, recordData.notes]
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

      // Apply organization filter via JOIN with farms
      const query = this.currentOrganizationId
        ? `SELECT fr.* FROM feed_records fr
           INNER JOIN poultry_batches pb ON fr.batch_id = pb.id
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}
           ORDER BY fr.date DESC`
        : `SELECT * FROM feed_records ORDER BY date DESC`;

      console.log(`📝 getFeedRecords Query: ${query}`);
      return this.db.getAllSync(query);
    } catch (error) {
      console.error('Error getting feed records:', error);
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

      // Apply organization filter via JOIN with farms
      const query = this.currentOrganizationId
        ? `SELECT hr.* FROM health_records hr
           INNER JOIN poultry_batches pb ON hr.batch_id = pb.id
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}
           ORDER BY hr.date DESC`
        : `SELECT * FROM health_records ORDER BY date DESC`;

      console.log(`📝 getHealthRecords Query: ${query}`);
      return this.db.getAllSync(query);
    } catch (error) {
      console.error('Error getting health records:', error);
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
      this.beginTransaction();

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

      // Apply organization filter via JOIN with farms
      const query = this.currentOrganizationId
        ? `SELECT mr.* FROM mortality_records mr
           INNER JOIN poultry_batches pb ON mr.batch_id = pb.id
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}
           ORDER BY mr.date DESC`
        : `SELECT * FROM mortality_records ORDER BY date DESC`;

      console.log(`📝 getMortalityRecords Query: ${query}`);
      return this.db.getAllSync(query);
    } catch (error) {
      console.error('Error getting mortality records:', error);
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
      this.beginTransaction();

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

      // SCHEMA FIX: Remove 'weight' field - production_records schema doesn't have it
      // Schema has: eggs_collected, broken_eggs, eggs_broken, abnormal_eggs, egg_weight_avg
      const result = this.db.runSync(
        `INSERT INTO production_records (farm_id, batch_id, date, eggs_collected, egg_weight_avg, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [recordData.farmId, recordData.batchId, recordData.date, recordData.eggsCollected, recordData.eggWeightAvg || recordData.weight, recordData.notes]
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

      // Apply organization filter via JOIN with farms
      const query = this.currentOrganizationId
        ? `SELECT pr.* FROM production_records pr
           INNER JOIN poultry_batches pb ON pr.batch_id = pb.id
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}
           ORDER BY pr.date DESC`
        : `SELECT * FROM production_records ORDER BY date DESC`;

      console.log(`📝 getProductionRecords Query: ${query}`);
      return this.db.getAllSync(query);
    } catch (error) {
      console.error('Error getting production records:', error);
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
        `INSERT INTO water_records (batch_id, farm_id, date_recorded, quantity_liters, water_source, quality, temperature_celsius, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

      // Apply organization filter via JOIN with farms
      const query = this.currentOrganizationId
        ? `SELECT wr.* FROM water_records wr
           INNER JOIN poultry_batches pb ON wr.batch_id = pb.id
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}
           ORDER BY wr.date_recorded DESC`
        : `SELECT * FROM water_records ORDER BY date_recorded DESC`;

      console.log(`📝 getWaterRecords Query: ${query}`);
      const records = this.db.getAllSync(query);

      // Map date_recorded to date for UI compatibility
      return records.map(record => ({
        ...record,
        date: record.date_recorded || record.date
      }));
    } catch (error) {
      console.error('Error getting water records:', error);
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

      // Convert weight to both kg and grams based on weightUnit
      const weightInKg = recordData.weightUnit === 'kg' ? recordData.averageWeight : recordData.averageWeight / 1000;
      const weightInGrams = recordData.weightUnit === 'kg' ? recordData.averageWeight * 1000 : recordData.averageWeight;

      const result = this.db.runSync(
        `INSERT INTO weight_records (batch_id, farm_id, date_recorded, average_weight_kg, average_weight_grams, sample_size, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [recordData.batchId, recordData.farmId, recordData.dateRecorded, weightInKg, weightInGrams, recordData.sampleSize, recordData.notes]
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

      // Apply organization filter via JOIN with farms
      const query = this.currentOrganizationId
        ? `SELECT wtr.* FROM weight_records wtr
           INNER JOIN poultry_batches pb ON wtr.batch_id = pb.id
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}
           ORDER BY wtr.date_recorded DESC`
        : `SELECT * FROM weight_records ORDER BY date_recorded DESC`;

      console.log(`📝 getWeightRecords Query: ${query}`);
      const records = this.db.getAllSync(query);

      // Map date_recorded to date for UI compatibility
      return records.map(record => ({
        ...record,
        date: record.date_recorded || record.date
      }));
    } catch (error) {
      console.error('Error getting weight records:', error);
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

  // ================================
  // Vaccination Records Operations
  // ================================

  createVaccinationRecord(recordData) {
    try {
      // Validate input
      if (!recordData || typeof recordData !== 'object') {
        throw new Error('Invalid vaccination record data provided');
      }

      // Ensure database is ready
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database is not available. Please check your internet connection or restart the app.');
      }

      const result = this.db.runSync(
        `INSERT INTO vaccination_records (batch_id, farm_id, vaccination_type, vaccination_date, vaccination_time, medication, notes, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordData.batchId,
          recordData.farmId,
          recordData.vaccinationType,
          recordData.vaccinationDate,
          recordData.vaccinationTime || null,
          recordData.medication || null,
          recordData.notes || null,
          recordData.date || recordData.vaccinationDate
        ]
      );
      return { id: result.lastInsertRowId, ...recordData };
    } catch (error) {
      console.error('❌ FastDatabase: Failed to create vaccination record:', error.message);
      throw new Error(`Failed to create vaccination record: ${error.message}`);
    }
  }

  getVaccinationRecords() {
    try {
      if (!this.isReady) this.init();

      // Apply organization filter via JOIN with farms
      const query = this.currentOrganizationId
        ? `SELECT vr.* FROM vaccination_records vr
           INNER JOIN poultry_batches pb ON vr.batch_id = pb.id
           INNER JOIN farms f ON pb.farm_id = f.id
           WHERE f.organization_id = ${this.currentOrganizationId}
           ORDER BY vr.vaccination_date DESC`
        : `SELECT * FROM vaccination_records ORDER BY vaccination_date DESC`;

      console.log(`📝 getVaccinationRecords Query: ${query}`);
      const records = this.db.getAllSync(query);

      // Map vaccination_date to date for UI compatibility
      return records.map(record => ({
        ...record,
        date: record.vaccination_date || record.date
      }));
    } catch (error) {
      console.error('Error getting vaccination records:', error);
      return [];
    }
  }

  deleteVaccinationRecord(recordId) {
    try {
      // Validate input
      if (!recordId) {
        throw new Error('Invalid record ID provided');
      }

      // Ensure database is ready
      if (!this.isReady || !this.db) {
        const initResult = this.init();
        if (!initResult || !this.db) {
          throw new Error('Database not available for vaccination record deletion');
        }
      }

      // Validate database has required methods
      if (typeof this.db.runSync !== 'function') {
        throw new Error('Database runSync method not available');
      }

      this.db.runSync(`DELETE FROM vaccination_records WHERE id = ?`, [recordId]);
      return true;
    } catch (error) {
      console.error('❌ FastDatabase: Failed to delete vaccination record:', error.message);
      throw new Error(`Failed to delete vaccination record: ${error.message}`);
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
      case 'vaccination':
        return this.getVaccinationRecords();
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
      case 'vaccination':
        return this.deleteVaccinationRecord(recordId);
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
        case 'vaccination':
          return this.createVaccinationRecord(recordData);
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

      // 🔐 Apply organization filtering
      const orgWhere = this.currentOrganizationId
        ? `AND f.organization_id = ${this.currentOrganizationId}`
        : '';

      // Get recent farms
      try {
        const recentFarmsQuery = `
          SELECT farm_name as name, created_at as date, 'farm' as type, 'Farm created' as action
          FROM farms f
          WHERE DATE(created_at) >= DATE('${dateLimit}')
          ${this.currentOrganizationId ? `AND f.organization_id = ${this.currentOrganizationId}` : ''}
          ORDER BY created_at DESC
          LIMIT 5
        `;
        const recentFarms = this.db.getAllSync(recentFarmsQuery);
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
        const recentBatchesQuery = `
          SELECT pb.batch_name as name, pb.created_at as date, 'batch' as type, 'Batch created' as action, f.farm_name as farm_name
          FROM poultry_batches pb
          LEFT JOIN farms f ON pb.farm_id = f.id
          WHERE DATE(pb.created_at) >= DATE('${dateLimit}')
          ${orgWhere}
          ORDER BY pb.created_at DESC
          LIMIT 5
        `;
        const recentBatches = this.db.getAllSync(recentBatchesQuery);
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
        const recentProductionQuery = `
          SELECT pr.eggs_collected, pr.date, 'production' as type, 'Eggs recorded' as action, f.farm_name as farm_name, pb.batch_name as batch_name
          FROM production_records pr
          LEFT JOIN poultry_batches pb ON pr.batch_id = pb.id
          LEFT JOIN farms f ON pb.farm_id = f.id
          WHERE DATE(pr.date) >= DATE('${dateLimit}')
          ${orgWhere}
          ORDER BY pr.date DESC
          LIMIT 5
        `;
        const recentProduction = this.db.getAllSync(recentProductionQuery);
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
        const recentMortalityQuery = `
          SELECT mr.count, mr.date, 'mortality' as type, 'Mortality recorded' as action, f.farm_name as farm_name, pb.batch_name as batch_name
          FROM mortality_records mr
          LEFT JOIN poultry_batches pb ON mr.batch_id = pb.id
          LEFT JOIN farms f ON pb.farm_id = f.id
          WHERE DATE(mr.date) >= DATE('${dateLimit}')
          ${orgWhere}
          ORDER BY mr.date DESC
          LIMIT 5
        `;
        const recentMortality = this.db.getAllSync(recentMortalityQuery);
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
        const recentFeedQuery = `
          SELECT fr.quantity_kg AS quantity, fr.date, 'feed' as type, 'Feed recorded' as action, f.farm_name as farm_name, pb.batch_name as batch_name
          FROM feed_records fr
          LEFT JOIN poultry_batches pb ON fr.batch_id = pb.id
          LEFT JOIN farms f ON pb.farm_id = f.id
          WHERE DATE(fr.date) >= DATE('${dateLimit}')
          ${orgWhere}
          ORDER BY fr.date DESC
          LIMIT 5
        `;
        const recentFeed = this.db.getAllSync(recentFeedQuery);
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

  // SYNC SUPPORT METHODS - Critical for offline-first sync
  markAsSynced(tableName, localId, serverId) {
    try {
      if (!this.ensureDatabaseReady()) {
        console.error('❌ Database not ready for markAsSynced');
        return false;
      }

      const now = new Date().toISOString();

      console.log(`🔄 FastDatabase: Marking ${tableName} record ${localId} as synced with server_id: ${serverId}`);

      this.db.runSync(
        `UPDATE ${tableName}
         SET server_id = ?, needs_sync = 0, synced_at = ?, updated_at = ?
         WHERE id = ?`,
        [serverId, now, now, localId]
      );

      console.log(`✅ FastDatabase: Marked ${tableName} record ${localId} as synced`);
      return true;
    } catch (error) {
      console.error(`❌ FastDatabase: Failed to mark ${tableName} ${localId} as synced:`, error.message);
      return false;
    }
  }

  getUnsyncedRecords(tableName) {
    try {
      if (!this.ensureDatabaseReady()) {
        console.error('❌ Database not ready for getUnsyncedRecords');
        return [];
      }

      const records = this.db.getAllSync(
        `SELECT * FROM ${tableName} WHERE needs_sync = 1 AND (is_deleted = 0 OR is_deleted IS NULL)`
      );

      console.log(`📊 FastDatabase: Found ${records.length} unsynced records in ${tableName}`);
      return records || [];
    } catch (error) {
      console.error(`❌ FastDatabase: Failed to get unsynced records from ${tableName}:`, error.message);
      return [];
    }
  }

  getRecordByServerId(tableName, serverId) {
    try {
      if (!this.ensureDatabaseReady()) {
        console.error('❌ Database not ready for getRecordByServerId');
        return null;
      }

      const record = this.db.getFirstSync(
        `SELECT * FROM ${tableName} WHERE server_id = ?`,
        [serverId]
      );

      return record || null;
    } catch (error) {
      console.error(`❌ FastDatabase: Failed to get record by server_id from ${tableName}:`, error.message);
      return null;
    }
  }

  updateLocalRecordWithServerData(tableName, localId, serverData) {
    try {
      if (!this.ensureDatabaseReady()) {
        console.error('❌ Database not ready for updateLocalRecordWithServerData');
        return false;
      }

      const now = new Date().toISOString();

      // Build dynamic UPDATE query based on serverData keys
      const updateFields = Object.keys(serverData)
        .filter(key => !['id', 'created_at'].includes(key)) // Don't update these fields
        .map(key => `${key} = ?`)
        .join(', ');

      const values = Object.keys(serverData)
        .filter(key => !['id', 'created_at'].includes(key))
        .map(key => serverData[key]);

      values.push(now, localId); // Add updated_at and localId

      this.db.runSync(
        `UPDATE ${tableName} SET ${updateFields}, updated_at = ? WHERE id = ?`,
        values
      );

      console.log(`✅ FastDatabase: Updated local ${tableName} record ${localId} with server data`);
      return true;
    } catch (error) {
      console.error(`❌ FastDatabase: Failed to update local record:`, error.message);
      return false;
    }
  }

  // GENERIC DATABASE METHODS - Required by offlineDataService
  select(tableName, columns = '*', whereClause = null, whereValues = [], orderBy = null) {
    try {
      if (!this.ensureDatabaseReady()) {
        console.error('❌ Database not ready for select');
        return [];
      }

      let query = `SELECT ${columns} FROM ${tableName}`;

      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      if (orderBy) {
        query += ` ORDER BY ${orderBy}`;
      }

      const results = this.db.getAllSync(query, whereValues);
      return results || [];
    } catch (error) {
      console.error(`❌ FastDatabase: select failed for ${tableName}:`, error.message);
      return [];
    }
  }

  selectOne(tableName, columns = '*', whereClause = null, whereValues = []) {
    try {
      if (!this.ensureDatabaseReady()) {
        console.error('❌ Database not ready for selectOne');
        return null;
      }

      let query = `SELECT ${columns} FROM ${tableName}`;

      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      query += ' LIMIT 1';

      const result = this.db.getFirstSync(query, whereValues);
      return result || null;
    } catch (error) {
      console.error(`❌ FastDatabase: selectOne failed for ${tableName}:`, error.message);
      return null;
    }
  }

  count(tableName, whereClause = null, whereValues = []) {
    try {
      if (!this.ensureDatabaseReady()) {
        console.error('❌ Database not ready for count');
        return 0;
      }

      let query = `SELECT COUNT(*) as count FROM ${tableName}`;

      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      const result = this.db.getFirstSync(query, whereValues);
      return result?.count || 0;
    } catch (error) {
      console.error(`❌ FastDatabase: count failed for ${tableName}:`, error.message);
      return 0;
    }
  }

  // INSERT operation with retry logic
  insert(tableName, data) {
    return this.executeWithRetry(() => {
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database not ready for insert');
      }

      const columns = Object.keys(data);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(data);

      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

      const result = this.db.runSync(query, values);
      return result.lastInsertRowId;
    });
  }

  // UPDATE operation with retry logic
  update(tableName, data, whereClause, whereValues = []) {
    return this.executeWithRetry(() => {
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database not ready for update');
      }

      const setClauses = Object.keys(data).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(data), ...whereValues];

      const query = `UPDATE ${tableName} SET ${setClauses} WHERE ${whereClause}`;

      const result = this.db.runSync(query, values);
      return result.changes;
    });
  }

  // DELETE operation with retry logic
  delete(tableName, whereClause, whereValues = []) {
    return this.executeWithRetry(() => {
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database not ready for delete');
      }

      const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;

      const result = this.db.runSync(query, whereValues);
      return result.changes;
    });
  }

  // SOFT DELETE operation (sets is_deleted = 1)
  softDelete(tableName, id) {
    return this.executeWithRetry(() => {
      if (!this.ensureDatabaseReady()) {
        throw new Error('Database not ready for soft delete');
      }

      const query = `UPDATE ${tableName} SET is_deleted = 1, updated_at = ? WHERE id = ?`;
      const now = new Date().toISOString();

      const result = this.db.runSync(query, [now, id]);
      return result.changes;
    });
  }

  // EMERGENCY RECOVERY - Reinitialize database from scratch
  async emergencyRecovery() {
    try {
      console.log('🆘 FastDatabase: Emergency recovery initiated...');

      // Close existing connection
      this.db = null;
      this.isReady = false;

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reinitialize
      const initResult = this.init();

      if (initResult && this.db && this.isReady) {
        console.log('✅ FastDatabase: Emergency recovery successful');
        return true;
      } else {
        console.error('❌ FastDatabase: Emergency recovery failed');
        return false;
      }
    } catch (error) {
      console.error('❌ FastDatabase: Emergency recovery error:', error);
      return false;
    }
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

      // SCHEMA FIX: Use quantity_kg instead of quantity (matches schema column name)
      const totalFeedQuantityResult = this.db.getFirstSync(`
        SELECT SUM(quantity_kg) as total
        FROM feed_records
        WHERE DATE(date) BETWEEN DATE('${startDateStr}') AND DATE('${endDateStr}')
      `);
      const totalFeedQuantity = totalFeedQuantityResult?.total || 0;

      const avgCostPerBird = totalBirds > 0 ? (totalFeedCost / totalBirds).toFixed(2) : '0.00';
      const avgFeedPerBird = totalBirds > 0 ? (totalFeedQuantity / totalBirds).toFixed(2) : '0.00';

      // Daily feed consumption trend (last 7 days)
      // SCHEMA FIX: Use quantity_kg instead of quantity (matches schema column name)
      const dailyFeedResult = this.db.getAllSync(`
        SELECT DATE(date) as date, SUM(quantity_kg) as totalFeed, SUM(cost) as totalCost
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
      // SCHEMA FIX: Use average_weight_kg instead of average_weight (matches schema column name)
      const avgWeightResult = this.db.getFirstSync(`
        SELECT AVG(average_weight_kg) as avgWeight
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

  // ============================================================================
  // P0-1 FIX: ID MAPPING METHODS (Local ↔ Server ID Management)
  // ============================================================================

  /**
   * Store mapping between local ID and server ID after successful sync
   * @param {string} tableName - The table name (e.g., 'farms', 'poultry_batches')
   * @param {number} localId - The local INTEGER ID
   * @param {string} serverId - The server TEXT ID
   */
  storeIdMapping(tableName, localId, serverId) {
    try {
      if (!this.isReady) this.init();

      // Validate inputs
      if (!tableName || !localId || !serverId) {
        console.warn(`⚠️  Invalid ID mapping parameters: table=${tableName}, local=${localId}, server=${serverId}`);
        return false;
      }

      // Insert or replace mapping
      this.db.runSync(
        `INSERT OR REPLACE INTO id_mappings (local_table, local_id, server_id, synced_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [tableName, localId, serverId]
      );

      console.log(`✅ ID mapping stored: ${tableName} local=${localId} → server=${serverId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to store ID mapping for ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Get server ID for a given local ID
   * @param {string} tableName - The table name
   * @param {number} localId - The local INTEGER ID
   * @returns {string|null} - The server TEXT ID, or null if not found
   */
  getServerIdForLocalId(tableName, localId) {
    try {
      if (!this.isReady) this.init();

      const mapping = this.db.getFirstSync(
        `SELECT server_id FROM id_mappings WHERE local_table = ? AND local_id = ?`,
        [tableName, localId]
      );

      return mapping ? mapping.server_id : null;
    } catch (error) {
      console.error(`❌ Failed to get server ID for ${tableName} local=${localId}:`, error);
      return null;
    }
  }

  /**
   * Get local ID for a given server ID
   * @param {string} tableName - The table name
   * @param {string} serverId - The server TEXT ID
   * @returns {number|null} - The local INTEGER ID, or null if not found
   */
  getLocalIdForServerId(tableName, serverId) {
    try {
      if (!this.isReady) this.init();

      const mapping = this.db.getFirstSync(
        `SELECT local_id FROM id_mappings WHERE local_table = ? AND server_id = ?`,
        [tableName, serverId]
      );

      return mapping ? mapping.local_id : null;
    } catch (error) {
      console.error(`❌ Failed to get local ID for ${tableName} server=${serverId}:`, error);
      return null;
    }
  }

  /**
   * Get all ID mappings for a table (useful for debugging)
   * @param {string} tableName - The table name
   * @returns {Array} - Array of {local_id, server_id, synced_at}
   */
  getAllIdMappings(tableName) {
    try {
      if (!this.isReady) this.init();

      return this.db.getAllSync(
        `SELECT local_id, server_id, synced_at FROM id_mappings WHERE local_table = ? ORDER BY local_id`,
        [tableName]
      );
    } catch (error) {
      console.error(`❌ Failed to get ID mappings for ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Remap foreign key IDs from local → server before sync upload
   * @param {string} tableName - The table name
   * @param {object} data - The record data with local foreign key IDs
   * @returns {object} - The data with server foreign key IDs
   */
  remapForeignKeysToServer(tableName, data) {
    try {
      const remapped = { ...data };

      // Table-specific foreign key remapping
      switch (tableName) {
        case 'poultry_batches':
          // Remap farm_id (local) → farmId (server)
          if (data.farm_id) {
            const serverFarmId = this.getServerIdForLocalId('farms', data.farm_id);
            if (serverFarmId) {
              remapped.farmId = parseInt(serverFarmId, 10);
              console.log(`🔄 Remapped batch.farm_id: local=${data.farm_id} → server=${serverFarmId}`);
            } else {
              console.warn(`⚠️  No server ID found for farm local_id=${data.farm_id}`);
            }
          }
          break;

        case 'feed_records':
        case 'health_records':
        case 'mortality_records':
        case 'production_records':
        case 'water_records':
        case 'weight_records':
          // Remap batch_id (local) → batchId (server)
          if (data.batch_id) {
            const serverBatchId = this.getServerIdForLocalId('poultry_batches', data.batch_id);
            if (serverBatchId) {
              remapped.batchId = parseInt(serverBatchId, 10);
              console.log(`🔄 Remapped ${tableName}.batch_id: local=${data.batch_id} → server=${serverBatchId}`);
            } else {
              console.warn(`⚠️  No server ID found for batch local_id=${data.batch_id}`);
            }
          }

          // Remap farm_id (local) → farmId (server) if present
          if (data.farm_id) {
            const serverFarmId = this.getServerIdForLocalId('farms', data.farm_id);
            if (serverFarmId) {
              remapped.farmId = parseInt(serverFarmId, 10);
              console.log(`🔄 Remapped ${tableName}.farm_id: local=${data.farm_id} → server=${serverFarmId}`);
            }
          }
          break;

        case 'expenses':
          // Remap farm_id and batch_id if present
          if (data.farm_id) {
            const serverFarmId = this.getServerIdForLocalId('farms', data.farm_id);
            if (serverFarmId) {
              remapped.farmId = parseInt(serverFarmId, 10);
            }
          }
          if (data.batch_id) {
            const serverBatchId = this.getServerIdForLocalId('poultry_batches', data.batch_id);
            if (serverBatchId) {
              remapped.batchId = parseInt(serverBatchId, 10);
            }
          }
          break;

        default:
          // No foreign keys to remap
          break;
      }

      // Remove local-only fields
      delete remapped.id;
      delete remapped.server_id;
      delete remapped.needs_sync;
      delete remapped.synced_at;
      delete remapped.is_deleted;

      return remapped;
    } catch (error) {
      console.error(`❌ Failed to remap foreign keys for ${tableName}:`, error);
      return data; // Return original data on error
    }
  }

  // ============================================================================
  // P0-3 FIX: TRANSACTION SUPPORT (Atomic Sync Operations)
  // ============================================================================

  /**
   * Begin a database transaction
   */
  beginTransaction() {
    try {
      if (!this.isReady) this.init();

      // CRASH FIX: Check if transaction is already active
      if (this.isTransactionActive) {
        console.warn('⚠️  Transaction already active, skipping BEGIN');
        return;
      }

      this.db.execSync('BEGIN TRANSACTION');
      this.isTransactionActive = true;
      console.log('🔒 Transaction started');
    } catch (error) {
      console.error('❌ Failed to begin transaction:', error);
      // If BEGIN failed, ensure flag is reset
      this.isTransactionActive = false;
      throw error;
    }
  }

  /**
   * Commit a database transaction
   */
  commitTransaction() {
    try {
      if (!this.isTransactionActive) {
        console.warn('⚠️  No active transaction to commit');
        return;
      }

      this.db.execSync('COMMIT');
      this.isTransactionActive = false;
      console.log('✅ Transaction committed');
    } catch (error) {
      console.error('❌ Failed to commit transaction:', error);
      this.isTransactionActive = false;
      throw error;
    }
  }

  /**
   * Rollback a database transaction
   */
  rollbackTransaction() {
    try {
      if (!this.isTransactionActive) {
        console.warn('⚠️  No active transaction to rollback');
        return;
      }

      this.db.execSync('ROLLBACK');
      this.isTransactionActive = false;
      console.log('🔄 Transaction rolled back');
    } catch (error) {
      console.error('❌ Failed to rollback transaction:', error);
      this.isTransactionActive = false;
      throw error;
    }
  }

  /**
   * Execute a callback within a transaction with automatic commit/rollback
   * @param {Function} callback - The function to execute within the transaction
   * @returns {*} - The result of the callback
   */
  async withTransaction(callback) {
    try {
      this.beginTransaction();
      const result = await callback();
      this.commitTransaction();
      return result;
    } catch (error) {
      console.error('❌ Transaction failed, rolling back:', error);
      this.rollbackTransaction();
      throw error;
    }
  }

  // ============================================================================
  // P0-4 FIX: CONFLICT DETECTION & RESOLUTION
  // ============================================================================

  /**
   * Store a detected sync conflict for user resolution
   * @param {object} conflictData - {tableName, localId, serverId, localData, serverData, conflictType}
   */
  storeConflict(conflictData) {
    try {
      if (!this.isReady) this.init();

      const { tableName, localId, serverId, localData, serverData, conflictType } = conflictData;

      this.db.runSync(
        `INSERT INTO sync_conflicts (table_name, local_id, server_id, local_data, server_data, conflict_type, detected_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          tableName,
          localId,
          serverId || null,
          JSON.stringify(localData),
          JSON.stringify(serverData),
          conflictType
        ]
      );

      console.log(`⚠️  Conflict stored: ${tableName} local=${localId} type=${conflictType}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to store conflict:', error);
      return false;
    }
  }

  /**
   * Get all unresolved conflicts
   * @returns {Array} - Array of pending conflicts
   */
  getPendingConflicts() {
    try {
      if (!this.isReady) this.init();

      const conflicts = this.db.getAllSync(
        `SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY detected_at DESC`
      );

      // Parse JSON strings back to objects
      return conflicts.map(c => ({
        ...c,
        local_data: JSON.parse(c.local_data),
        server_data: JSON.parse(c.server_data)
      }));
    } catch (error) {
      console.error('❌ Failed to get pending conflicts:', error);
      return [];
    }
  }

  /**
   * Mark a conflict as resolved
   * @param {number} conflictId - The conflict ID
   * @param {string} resolutionStrategy - 'local_wins', 'server_wins', 'merged', etc.
   * @param {string} resolvedBy - User ID or 'auto'
   */
  resolveConflict(conflictId, resolutionStrategy, resolvedBy = 'auto') {
    try {
      if (!this.isReady) this.init();

      this.db.runSync(
        `UPDATE sync_conflicts SET resolved_at = CURRENT_TIMESTAMP, resolution_strategy = ?, resolved_by = ? WHERE id = ?`,
        [resolutionStrategy, resolvedBy, conflictId]
      );

      console.log(`✅ Conflict ${conflictId} resolved: ${resolutionStrategy}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to resolve conflict:', error);
      return false;
    }
  }

  /**
   * Clear all unsynced records from database (useful for clearing corrupted data)
   * WARNING: This will delete all records that haven't been synced to the server
   */
  clearUnsyncedRecords() {
    try {
      if (!this.isReady) this.init();

      console.log('🧹 FastDatabase: Starting to clear unsynced records...');

      const tables = [
        'farms',
        'poultry_batches',
        'feed_records',
        'production_records',
        'mortality_records',
        'health_records',
        'water_records',
        'weight_records',
        'vaccination_records',
        'expenses',
        'sales'
      ];

      let totalDeleted = 0;

      for (const table of tables) {
        try {
          // Count unsynced records
          const count = this.db.getFirstSync(
            `SELECT COUNT(*) as count FROM ${table} WHERE needs_sync = 1`
          );

          if (count && count.count > 0) {
            console.log(`   Deleting ${count.count} unsynced records from ${table}...`);

            // Delete unsynced records
            const result = this.db.runSync(
              `DELETE FROM ${table} WHERE needs_sync = 1`
            );

            totalDeleted += count.count;
            console.log(`   ✅ Deleted ${count.count} records from ${table}`);
          }
        } catch (tableError) {
          console.warn(`   ⚠️ Could not clear ${table}:`, tableError.message);
        }
      }

      console.log(`✅ FastDatabase: Cleared ${totalDeleted} total unsynced records`);
      return totalDeleted;
    } catch (error) {
      console.error('❌ FastDatabase: Failed to clear unsynced records:', error);
      throw error;
    }
  }
}

// Export singleton instance
const fastDatabase = new FastDatabaseService();
export default fastDatabase;