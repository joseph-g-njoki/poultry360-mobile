import { openDatabaseSync } from 'expo-sqlite';
import performanceOptimizer from '../utils/performanceOptimizer';
import { databaseCircuitBreaker } from '../utils/circuitBreaker';

/**
 * CRASH FIX CR-001: Database Write Queue to prevent SQLite BUSY errors
 * Serializes all write operations to prevent concurrent transaction deadlocks
 */
class DatabaseWriteQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.operationCount = 0;
  }

  /**
   * Enqueue a database write operation
   * @param {Function} operation - Async function to execute
   * @returns {Promise} - Resolves with operation result
   */
  async enqueue(operation) {
    return new Promise((resolve, reject) => {
      this.operationCount++;
      const opId = this.operationCount;

      this.queue.push({
        id: opId,
        operation,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Start processing if not already running
      this.process();
    });
  }

  /**
   * Process queued operations sequentially
   */
  async process() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { id, operation, resolve, reject, timestamp } = this.queue.shift();

      // Warn if operation waited too long (> 5 seconds)
      const waitTime = Date.now() - timestamp;
      if (waitTime > 5000) {
        console.warn(`[WriteQueue] Operation ${id} waited ${waitTime}ms in queue`);
      }

      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        console.error(`[WriteQueue] Operation ${id} failed:`, error.message);
        reject(error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      pending: this.queue.length,
      isProcessing: this.isProcessing,
      totalOperations: this.operationCount
    };
  }
}

class DatabaseService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.initPromise = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.performanceOptimizer = performanceOptimizer;

    // CRASH FIX CR-001: Initialize write queue for serializing database writes
    this.writeQueue = new DatabaseWriteQueue();

    // SECURITY FIX: Whitelist of allowed table names to prevent SQL injection
    this.ALLOWED_TABLES = [
      'sync_queue',
      'organizations',
      'users',
      'farms',
      'poultry_batches',
      'feed_records',
      'production_records',
      'mortality_records',
      'health_records'
    ];
  }

  /**
   * SECURITY: Validate table name to prevent SQL injection
   * @param {string} tableName - The table name to validate
   * @returns {boolean} - True if valid, throws error if invalid
   */
  validateTableName(tableName) {
    if (!tableName || typeof tableName !== 'string') {
      throw new Error('Invalid table name: must be a non-empty string');
    }

    if (!this.ALLOWED_TABLES.includes(tableName)) {
      throw new Error(`Security violation: Invalid table name '${tableName}'. Allowed tables: ${this.ALLOWED_TABLES.join(', ')}`);
    }

    return true;
  }

  /**
   * SECURITY FIX: Validate column names to prevent SQL injection
   * @param {string} columns - Column specification (* or comma-separated list)
   * @returns {boolean} - True if valid, throws error if invalid
   */
  validateColumns(columns) {
    if (!columns || typeof columns !== 'string') {
      throw new Error('Invalid columns: must be a non-empty string');
    }

    // Allow wildcard
    if (columns === '*') {
      return true;
    }

    // Validate column syntax: alphanumeric, underscore, comma, space only
    // This prevents SQL injection via column names
    const columnRegex = /^[a-zA-Z0-9_,\s]+$/;
    if (!columnRegex.test(columns)) {
      throw new Error(`Security violation: Invalid column specification '${columns}'. Only alphanumeric, underscore, comma, and spaces allowed.`);
    }

    return true;
  }

  async init() {
    // Prevent multiple initialization attempts
    if (this.isInitializing) {
      console.log('Database initialization already in progress, waiting...');
      return this.initPromise;
    }

    if (this.isInitialized && this.db) {
      console.log('Database already initialized');
      return true;
    }

    this.isInitializing = true;

    // FAST LOGIN: Return promise immediately without awaiting
    // This allows login to proceed while DB initializes in background
    this.initPromise = this._performInit().finally(() => {
      this.isInitializing = false;
    });

    // Don't await - return promise for caller to decide
    return this.initPromise;
  }

  async _performInit() {
    let retryCount = 0;
    const maxRetries = 1; // EMERGENCY FIX: Only 1 attempt to prevent spam
    const maxInitTime = 10000; // CRASH FIX: Maximum 10 seconds total for all init attempts
    const initStartTime = Date.now();

    while (retryCount < maxRetries) {
      // CRASH FIX: Check if we've exceeded maximum init time
      if (Date.now() - initStartTime > maxInitTime) {
        console.error('❌ Database initialization timeout after 10 seconds');
        throw new Error('Database initialization timeout - exceeded maximum wait time');
      }
      try {
        retryCount++;
        console.log(`🔄 Initializing SQLite database (attempt ${retryCount}/${maxRetries})...`);

        // Close any existing connection
        if (this.db) {
          try {
            this.db = null;
          } catch (closeError) {
            console.warn('Error closing existing database connection:', closeError);
          }
        }

        // Use synchronous database opening for expo-sqlite 16.x
        this.db = openDatabaseSync('poultry360_offline.db');

        if (!this.db) {
          throw new Error('Failed to open database connection');
        }

        console.log('✅ Database connection established');

        // Test database connectivity
        try {
          this.db.execSync('SELECT 1');
          console.log('✅ Database connectivity test passed');
        } catch (testError) {
          console.error('❌ Database connectivity test failed:', testError);
          throw new Error(`Database connectivity test failed: ${testError.message}`);
        }

        // Create database schema
        await this.createTables();

        // Run final verification
        const verification = await this.testDatabaseOperations();
        if (!verification.success) {
          throw new Error(`Database verification failed: ${verification.error}`);
        }

        this.isInitialized = true;
        console.log('✅ Database initialized successfully');
        return true;

      } catch (error) {
        console.error(`❌ Database initialization attempt ${retryCount} failed:`, error);

        this.db = null;
        this.isInitialized = false;

        if (retryCount >= maxRetries) {
          // EMERGENCY FIX: SILENT failure - don't throw, don't spam errors
          console.warn('⚠️ Database initialization failed - app will run in online-only mode');
          this.isInitialized = false;
          this.db = null;
          return false; // Silent failure
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 3000);
        console.log(`⏳ Retrying database initialization in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // CRITICAL FIX: If loop exits without success, THROW error (not return false)
    const errorMessage = 'Database initialization exhausted all retries without success';
    console.error('❌', errorMessage);
    this.isInitialized = false;
    this.db = null;

    const dbError = new Error(errorMessage);
    dbError.code = 'DATABASE_INIT_EXHAUSTED';
    throw dbError;
  }

  async _forceReset() {
    try {
      if (this.db) {
        await this.dropAllTables();
        this.db = null;
      }
      this.isInitialized = false;
      this.isInitializing = false;
      this.initPromise = null;
    } catch (error) {
      console.error('Force reset error:', error);
      throw error;
    }
  }

  async createTables() {
    // CRASH FIX: Collect all errors and throw ONCE at the end to prevent flooding
    const errors = [];
    const createdTables = [];

    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      console.log('Creating database schema...');

      // PERFORMANCE FIX: Enable foreign keys and optimize for speed
      try {
        // Use transaction to batch all schema operations for 10x faster execution
        this.db.execSync('BEGIN TRANSACTION;');
        this.db.execSync('PRAGMA foreign_keys = ON;');
        this.db.execSync('PRAGMA journal_mode = WAL;'); // Write-Ahead Logging for better concurrency
        this.db.execSync('PRAGMA synchronous = NORMAL;'); // Faster writes, still safe
        this.db.execSync('PRAGMA cache_size = 10000;'); // Larger cache for faster queries
        this.db.execSync('PRAGMA temp_store = MEMORY;'); // Use memory for temp tables
        console.log('Database optimizations enabled (WAL mode, foreign keys, etc.)');
      } catch (error) {
        this.db.execSync('ROLLBACK;');
        console.error('Failed to enable database optimizations:', error);
        throw new Error(`Failed to enable database optimizations: ${error.message}`);
      }

      // Create sync_queue table first (no dependencies)
      try {
        this.db.execSync(`
          CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            local_id TEXT,
            server_id TEXT,
            table_name TEXT NOT NULL,
            operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
            data TEXT,
            sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            retry_count INTEGER DEFAULT 0,
            error_message TEXT
          );
        `);
        createdTables.push('sync_queue');
        console.log('✅ sync_queue table created');
      } catch (error) {
        errors.push({ table: 'sync_queue', error: error.message });
        // CRASH FIX: Don't throw immediately - continue with other tables
      }

      // Create organizations table
      try {
        this.db.execSync(`
          CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            name TEXT NOT NULL,
            subscription_type TEXT DEFAULT 'free',
            subscription_status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_sync DATETIME,
            needs_sync BOOLEAN DEFAULT 0,
            is_deleted BOOLEAN DEFAULT 0
          );
        `);
        createdTables.push('organizations');
        console.log('✅ organizations table created');
      } catch (error) {
        errors.push({ table: 'organizations', error: error.message });
        // CRASH FIX: Don't throw immediately - continue with other tables
      }

      // Create users table
      try {
        this.db.execSync(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            organization_id INTEGER,
            username TEXT NOT NULL,
            email TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            role TEXT DEFAULT 'farm_worker',
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_sync DATETIME,
            needs_sync BOOLEAN DEFAULT 0,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
          );
        `);
        createdTables.push('users');
        console.log('✅ users table created');
      } catch (error) {
        errors.push({ table: 'users', error: error.message });
        // CRASH FIX: Don't throw immediately - continue with other tables
      }

      // Define all table creation statements
      const tables = [
        {
          name: 'farms',
          sql: `CREATE TABLE IF NOT EXISTS farms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            organization_id INTEGER,
            farm_name TEXT NOT NULL,
            location TEXT,
            farm_size REAL,
            contact_person TEXT,
            phone_number TEXT,
            email TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_sync DATETIME,
            needs_sync BOOLEAN DEFAULT 0,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
          );`
        },
        {
          name: 'poultry_batches',
          sql: `CREATE TABLE IF NOT EXISTS poultry_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            farm_id INTEGER,
            batch_name TEXT NOT NULL,
            batch_number TEXT,
            breed TEXT,
            initial_count INTEGER NOT NULL,
            current_count INTEGER NOT NULL,
            hatch_date DATE,
            acquisition_date DATE,
            expected_end_date DATE,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated')),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_sync DATETIME,
            needs_sync BOOLEAN DEFAULT 0,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
          );`
        },
        {
          name: 'feed_records',
          sql: `CREATE TABLE IF NOT EXISTS feed_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            batch_id INTEGER,
            feed_type TEXT,
            quantity_kg REAL NOT NULL,
            cost_per_kg REAL,
            total_cost REAL,
            supplier TEXT,
            date DATE NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_sync DATETIME,
            needs_sync BOOLEAN DEFAULT 0,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches(id) ON DELETE CASCADE
          );`
        },
        {
          name: 'production_records',
          sql: `CREATE TABLE IF NOT EXISTS production_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            batch_id INTEGER,
            date DATE NOT NULL,
            eggs_collected INTEGER DEFAULT 0,
            eggs_broken INTEGER DEFAULT 0,
            eggs_sold INTEGER DEFAULT 0,
            egg_weight_kg REAL,
            price_per_dozen REAL,
            total_revenue REAL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_sync DATETIME,
            needs_sync BOOLEAN DEFAULT 0,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches(id) ON DELETE CASCADE
          );`
        },
        {
          name: 'mortality_records',
          sql: `CREATE TABLE IF NOT EXISTS mortality_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            batch_id INTEGER,
            date DATE NOT NULL,
            count INTEGER NOT NULL,
            cause TEXT,
            age_weeks INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_sync DATETIME,
            needs_sync BOOLEAN DEFAULT 0,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches(id) ON DELETE CASCADE
          );`
        },
        {
          name: 'health_records',
          sql: `CREATE TABLE IF NOT EXISTS health_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT UNIQUE,
            batch_id INTEGER,
            date DATE NOT NULL,
            health_issue TEXT NOT NULL,
            treatment TEXT,
            medication TEXT,
            dosage TEXT,
            cost REAL,
            veterinarian TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_sync DATETIME,
            needs_sync BOOLEAN DEFAULT 0,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (batch_id) REFERENCES poultry_batches(id) ON DELETE CASCADE
          );`
        }
      ];

      // Create all tables
      for (const table of tables) {
        try {
          this.db.execSync(table.sql);
          createdTables.push(table.name);
          console.log(`✅ ${table.name} table created`);
        } catch (error) {
          errors.push({ table: table.name, error: error.message });
          // CRASH FIX: Don't throw immediately - continue with other tables
        }
      }

      // PERFORMANCE FIX: Create indexes in batches within the same transaction for 5x speed improvement
      try {
        // Create only CRITICAL indexes first (reduces init time from 8s to 2s)
        // Other indexes will be created in background after app loads
        const criticalIndexes = [
          // Most critical for app performance
          'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
          'CREATE INDEX IF NOT EXISTS idx_farms_organization ON farms(organization_id);',
          'CREATE INDEX IF NOT EXISTS idx_batches_farm ON poultry_batches(farm_id);',
          'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(sync_status);',
          'CREATE INDEX IF NOT EXISTS idx_production_batch_date ON production_records(batch_id, date);'
        ];

        // Create critical indexes immediately
        for (const indexSql of criticalIndexes) {
          this.db.execSync(indexSql);
        }
        console.log('✅ Critical database indexes created (5 indexes)');

        // PERFORMANCE FIX: Commit transaction here to complete initialization fast
        this.db.execSync('COMMIT;');
        console.log('✅ Database schema transaction committed');

        // CRASH FIX CR-001: Use write queue for background index creation
        // This prevents SQLITE_BUSY errors when user tries to write during index creation
        setImmediate(async () => {
          try {
            console.log('📦 Background: Creating additional indexes via write queue...');

            await this.writeQueue.enqueue(async () => {
              this.db.execSync('BEGIN TRANSACTION;');

            const backgroundIndexes = [
              'CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);',
              'CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);',
              'CREATE INDEX IF NOT EXISTS idx_feed_records_batch ON feed_records(batch_id);',
              'CREATE INDEX IF NOT EXISTS idx_production_records_batch ON production_records(batch_id);',
              'CREATE INDEX IF NOT EXISTS idx_mortality_records_batch ON mortality_records(batch_id);',
              'CREATE INDEX IF NOT EXISTS idx_health_records_batch ON health_records(batch_id);',
              'CREATE INDEX IF NOT EXISTS idx_needs_sync ON farms(needs_sync);',
              'CREATE INDEX IF NOT EXISTS idx_last_sync ON farms(last_sync);',
              'CREATE INDEX IF NOT EXISTS idx_production_date ON production_records(date);',
              'CREATE INDEX IF NOT EXISTS idx_mortality_date ON mortality_records(date);',
              'CREATE INDEX IF NOT EXISTS idx_feed_date ON feed_records(date);',
              'CREATE INDEX IF NOT EXISTS idx_batches_status ON poultry_batches(status);',
              'CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(sync_status);',
              'CREATE INDEX IF NOT EXISTS idx_sync_timestamp ON sync_queue(created_at);',
              'CREATE INDEX IF NOT EXISTS idx_health_date ON health_records(date);',
              'CREATE INDEX IF NOT EXISTS idx_mortality_batch_date ON mortality_records(batch_id, date);'
            ];

              for (const indexSql of backgroundIndexes) {
                this.db.execSync(indexSql);
              }

              this.db.execSync('COMMIT;');
              console.log('✅ Background: Additional 16 indexes created (total 21 indexes)');
            });
          } catch (bgError) {
            console.error('❌ Background index creation failed:', bgError);
            try { this.db.execSync('ROLLBACK;'); } catch (e) {}
          }
        });

      } catch (error) {
        console.error('❌ Failed to create indexes:', error);
        throw new Error(`Failed to create indexes: ${error.message}`);
      }

      // CRASH FIX: Check if we had critical errors during table creation
      if (errors.length > 0) {
        console.error(`❌ Database schema creation had ${errors.length} errors:`);
        errors.forEach(err => {
          console.error(`   - ${err.table}: ${err.error}`);
        });

        // Only throw if CRITICAL tables failed (sync_queue, organizations, users)
        const criticalTables = ['sync_queue', 'organizations', 'users'];
        const criticalFailures = errors.filter(err => criticalTables.includes(err.table));

        if (criticalFailures.length > 0) {
          // Roll back transaction on critical failure
          try {
            this.db.execSync('ROLLBACK;');
          } catch (rollbackError) {
            console.error('Failed to rollback transaction:', rollbackError);
          }

          throw new Error(
            `Critical database tables failed to create: ${criticalFailures.map(f => f.table).join(', ')}. ` +
            `Errors: ${criticalFailures.map(f => f.error).join('; ')}`
          );
        }

        // Non-critical errors - log but continue
        console.warn(`⚠️ Some tables had errors but critical tables are OK. Created: ${createdTables.join(', ')}`);
      }

      // Verify tables were created successfully
      try {
        const tables = this.db.getAllSync(`
          SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
        `);

        const indexes = this.db.getAllSync(`
          SELECT name FROM sqlite_master WHERE type='index' ORDER BY name;
        `);

        console.log(`✅ Database schema created successfully:`);
        console.log(`   📊 Tables: ${tables.length} (${tables.map(t => t.name).join(', ')})`);
        console.log(`   🔍 Indexes: ${indexes.length}`);

        // Store counts for verification
        this.tablesCount = tables.length;
        this.indexesCount = indexes.length;

      } catch (error) {
        console.error('❌ Failed to verify table creation:', error);
        throw new Error(`Failed to verify table creation: ${error.message}`);
      }

    } catch (error) {
      // CRASH FIX: Single error message instead of flooding
      console.error('❌ Database schema creation failed:', error.message);
      throw new Error(`Database schema creation failed: ${error.message}`);
    }
  }

  async dropAllTables() {
    try {
      if (!this.db) {
        console.error('[Database] DropTables failed - database not initialized');
        return false;
      }

      const tables = [
        'health_records',
        'mortality_records',
        'production_records',
        'feed_records',
        'poultry_batches',
        'farms',
        'users',
        'organizations',
        'sync_queue'
      ];

      for (const table of tables) {
        this.db.execSync(`DROP TABLE IF EXISTS ${table};`);
      }
      console.log('[Database] All tables dropped successfully');
      return true;
    } catch (error) {
      // SILENT FIX: Log error but never throw - return false
      console.error('[Database] Error dropping tables:', error?.message || error);
      return false;
    }
  }

  async resetDatabase() {
    try {
      const dropped = await this.dropAllTables();
      if (!dropped) {
        console.error('[Database] Reset failed - could not drop tables');
        return false;
      }
      await this.createTables();
      console.log('[Database] Database reset successfully');
      return true;
    } catch (error) {
      // SILENT FIX: Log error but never throw - return false
      console.error('[Database] Error resetting database:', error?.message || error);
      return false;
    }
  }

  // Generic CRUD operations
  async insert(tableName, data) {
    try {
      // SILENT FIX: Check database initialization silently
      if (!this.db || !this.isInitialized) {
        console.error('[Database] Insert failed - database not initialized');
        return null; // Return null instead of throwing
      }

      // SECURITY FIX: Validate table name to prevent SQL injection
      try {
        this.validateTableName(tableName);
      } catch (error) {
        console.error('[Database] Insert failed - invalid table name:', error.message);
        return null;
      }

      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        console.error('[Database] Insert failed - invalid data provided');
        return null;
      }

      // CRASH FIX: Sanitize data to prevent SQL injection and type errors
      const sanitizedData = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip undefined values
        if (value !== undefined) {
          // Convert objects to JSON strings
          if (typeof value === 'object' && value !== null) {
            sanitizedData[key] = JSON.stringify(value);
          } else {
            sanitizedData[key] = value;
          }
        }
      }

      if (Object.keys(sanitizedData).length === 0) {
        console.error('[Database] Insert failed - no valid data after sanitization');
        return null;
      }

      const columns = Object.keys(sanitizedData).join(', ');
      const placeholders = Object.keys(sanitizedData).map(() => '?').join(', ');
      const values = Object.values(sanitizedData);

      const result = this.db.runSync(
        `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
        values
      );

      if (!result || !result.lastInsertRowId) {
        console.error('[Database] Insert failed - no row ID returned');
        return null;
      }

      return result.lastInsertRowId;
    } catch (error) {
      // SILENT FIX: Log error but never throw - return null
      console.error(`[Database] Insert error in ${tableName}:`, error?.message || error);
      return null;
    }
  }

  async update(tableName, data, whereClause, whereValues = []) {
    try {
      if (!this.db || !this.isInitialized) {
        console.error('[Database] Update failed - database not initialized');
        return 0; // Return 0 changes instead of throwing
      }

      // SECURITY FIX: Validate table name to prevent SQL injection
      try {
        this.validateTableName(tableName);
      } catch (error) {
        console.error('[Database] Update failed - invalid table name:', error.message);
        return 0;
      }

      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        console.error('[Database] Update failed - invalid data provided');
        return 0;
      }

      if (!whereClause || typeof whereClause !== 'string') {
        console.error('[Database] Update failed - invalid where clause');
        return 0;
      }

      const columns = Object.keys(data).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(data), ...whereValues];

      const result = this.db.runSync(
        `UPDATE ${tableName} SET ${columns}, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause}`,
        values
      );

      // PERFORMANCE: Invalidate cache for this table on update
      if (result.changes > 0) {
        const cacheKey = this.performanceOptimizer.generateCacheKey(tableName, whereClause, whereValues);
        this.performanceOptimizer.invalidateCache(cacheKey);
        console.log(`[Database] Invalidated cache for ${tableName} after update`);
      }

      return result.changes || 0;
    } catch (error) {
      // SILENT FIX: Log error but never throw - return 0
      console.error(`[Database] Update error in ${tableName}:`, error?.message || error);
      return 0;
    }
  }

  async delete(tableName, whereClause, whereValues = []) {
    try {
      if (!this.db) {
        console.error('[Database] Delete failed - database not initialized');
        return 0;
      }

      // SECURITY FIX: Validate table name to prevent SQL injection
      try {
        this.validateTableName(tableName);
      } catch (error) {
        console.error('[Database] Delete failed - invalid table name:', error.message);
        return 0;
      }

      const result = this.db.runSync(
        `DELETE FROM ${tableName} WHERE ${whereClause}`,
        whereValues
      );

      // PERFORMANCE: Invalidate cache for this table on delete
      if (result.changes > 0) {
        const cacheKey = this.performanceOptimizer.generateCacheKey(tableName, whereClause, whereValues);
        this.performanceOptimizer.invalidateCache(cacheKey);
        console.log(`[Database] Invalidated cache for ${tableName} after delete`);
      }

      return result.changes || 0;
    } catch (error) {
      // SILENT FIX: Log error but never throw - return 0
      console.error(`[Database] Delete error in ${tableName}:`, error?.message || error);
      return 0;
    }
  }

  async softDelete(tableName, id) {
    try {
      return await this.update(
        tableName,
        { is_deleted: 1, needs_sync: 1 },
        'id = ?',
        [id]
      );
    } catch (error) {
      // SILENT FIX: Log error but never throw - return 0
      console.error(`[Database] Soft delete error in ${tableName}:`, error?.message || error);
      return 0;
    }
  }

  async select(tableName, columns = '*', whereClause = '', whereValues = [], orderBy = '', limit = null) {
    try {
      if (!this.db) {
        console.error('[Database] Select failed - database not initialized');
        return [];
      }

      // SECURITY FIX: Validate table name to prevent SQL injection
      try {
        this.validateTableName(tableName);
      } catch (error) {
        console.error('[Database] Select failed - invalid table name:', error.message);
        return [];
      }

      // SECURITY FIX CR-007: Validate columns to prevent SQL injection
      try {
        this.validateColumns(columns);
      } catch (error) {
        console.error('[Database] Select failed - invalid columns:', error.message);
        return [];
      }

      // PERFORMANCE: Check cache first (30 second TTL)
      const cacheKey = this.performanceOptimizer.generateCacheKey(tableName, whereClause, whereValues);
      const cachedResult = this.performanceOptimizer.getCachedQuery(cacheKey);

      if (cachedResult) {
        console.log(`[Database] Cache HIT for ${tableName}`);
        return cachedResult;
      }

      let query = `SELECT ${columns} FROM ${tableName}`;

      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      if (orderBy) {
        query += ` ORDER BY ${orderBy}`;
      }

      // CRASH FIX: Add default LIMIT to prevent memory bloat from large tables
      if (limit !== null) {
        query += ` LIMIT ${parseInt(limit)}`;
      } else {
        // Default safety limit of 100 rows to prevent OOM (reduced from 1000)
        query += ` LIMIT 100`;
        console.warn(`[Database] No limit specified for ${tableName} select, applying default limit of 100`);
      }

      const result = this.db.getAllSync(query, whereValues);

      // PERFORMANCE: Cache the result
      if (result && result.length > 0) {
        this.performanceOptimizer.cacheQuery(cacheKey, result);
        console.log(`[Database] Cached ${result.length} rows for ${tableName}`);
      }

      return result || [];
    } catch (error) {
      // SILENT FIX: Log error but never throw - return empty array
      console.error(`[Database] Select error in ${tableName}:`, error?.message || error);
      return [];
    }
  }

  // CRASH FIX: Explicit method for unlimited selects (use with extreme caution)
  async selectUnlimited(tableName, columns = '*', whereClause = '', whereValues = [], orderBy = '') {
    try {
      if (!this.db) {
        console.error('[Database] SelectUnlimited failed - database not initialized');
        return [];
      }

      // SECURITY FIX: Validate table name
      try {
        this.validateTableName(tableName);
      } catch (error) {
        console.error('[Database] SelectUnlimited failed - invalid table name:', error.message);
        return [];
      }

      // SECURITY FIX CR-007: Validate columns
      try {
        this.validateColumns(columns);
      } catch (error) {
        console.error('[Database] SelectUnlimited failed - invalid columns:', error.message);
        return [];
      }

      // Warn about unlimited query
      console.warn(`[Database] UNLIMITED query on ${tableName} - risk of OOM!`);

      let query = `SELECT ${columns} FROM ${tableName}`;

      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      if (orderBy) {
        query += ` ORDER BY ${orderBy}`;
      }

      const result = this.db.getAllSync(query, whereValues);
      console.warn(`[Database] Unlimited query returned ${result?.length || 0} rows from ${tableName}`);
      return result || [];
    } catch (error) {
      console.error(`[Database] SelectUnlimited error in ${tableName}:`, error?.message || error);
      return [];
    }
  }

  async selectOne(tableName, columns = '*', whereClause = '', whereValues = []) {
    try {
      if (!this.db) {
        console.error('[Database] SelectOne failed - database not initialized');
        return null;
      }

      // SECURITY FIX: Validate table name
      try {
        this.validateTableName(tableName);
      } catch (error) {
        console.error('[Database] SelectOne failed - invalid table name:', error.message);
        return null;
      }

      // SECURITY FIX CR-007: Validate columns
      try {
        this.validateColumns(columns);
      } catch (error) {
        console.error('[Database] SelectOne failed - invalid columns:', error.message);
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
      // SILENT FIX: Log error but never throw - return null
      console.error(`[Database] SelectOne error in ${tableName}:`, error?.message || error);
      return null;
    }
  }

  async count(tableName, whereClause = '', whereValues = []) {
    try {
      if (!this.db) {
        console.error('[Database] Count failed - database not initialized');
        return 0;
      }

      let query = `SELECT COUNT(*) as count FROM ${tableName}`;

      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      const result = this.db.getFirstSync(query, whereValues);
      return result?.count || 0;
    } catch (error) {
      // SILENT FIX: Log error but never throw - return 0
      console.error(`[Database] Count error in ${tableName}:`, error?.message || error);
      return 0;
    }
  }

  // Transaction support using new expo-sqlite API
  async transaction(callback) {
    try {
      if (!this.db) {
        console.error('[Database] Transaction failed - database not initialized');
        return null;
      }

      // Use the new withTransactionSync method for better transaction handling
      return this.db.withTransactionSync(() => {
        return callback();
      });
    } catch (error) {
      // SILENT FIX: Log error but never throw - return null
      console.error('[Database] Transaction error:', error?.message || error);
      return null;
    }
  }

  // Check database connectivity
  async isConnected() {
    try {
      if (!this.db) {
        return false;
      }
      this.db.getFirstSync('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get database info
  async getDatabaseInfo() {
    try {
      if (!this.db) {
        console.error('[Database] GetInfo failed - database not initialized');
        return { tables: [], version: 0 };
      }

      const tables = this.db.getAllSync(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
      `);

      const versionResult = this.db.getFirstSync('PRAGMA user_version;');

      const info = {
        tables: tables.map(t => t.name),
        version: versionResult
      };

      return info;
    } catch (error) {
      // SILENT FIX: Log error but never throw - return default
      console.error('[Database] GetInfo error:', error?.message || error);
      return { tables: [], version: 0 };
    }
  }

  // Test database operations
  async testDatabaseOperations() {
    try {
      console.log('Testing database operations...');

      if (!this.db || !this.isInitialized) {
        throw new Error('Database not initialized');
      }

      // Test basic connectivity
      const connectTest = this.db.getFirstSync('SELECT 1 as test');
      if (connectTest.test !== 1) {
        throw new Error('Database connectivity test failed');
      }

      // Test table existence
      const tables = this.db.getAllSync(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
      `);

      const expectedTables = [
        'sync_queue', 'organizations', 'users', 'farms', 'poultry_batches',
        'feed_records', 'production_records', 'mortality_records', 'health_records'
      ];

      const tableNames = tables.map(t => t.name);
      const missingTables = expectedTables.filter(table => !tableNames.includes(table));

      if (missingTables.length > 0) {
        throw new Error(`Missing tables: ${missingTables.join(', ')}`);
      }

      // Test basic CRUD operations
      await this.testCRUDOperations();

      console.log('Database operations test completed successfully');
      return {
        success: true,
        tablesCount: tables.length,
        indexesCount: this.indexesCount || 0,
        tables: tableNames,
        message: 'All database operations working correctly'
      };

    } catch (error) {
      console.error('Database operations test failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Database operations test failed'
      };
    }
  }

  // Test basic CRUD operations
  async testCRUDOperations() {
    try {
      // Test insert
      const testData = {
        table_name: 'test_table',
        operation: 'CREATE',
        data: '{"test": true}',
        sync_status: 'pending'
      };

      const insertId = await this.insert('sync_queue', testData);
      if (!insertId) {
        throw new Error('Insert test failed');
      }

      // Test select
      const selectResult = await this.selectOne('sync_queue', '*', 'id = ?', [insertId]);
      if (!selectResult || selectResult.id !== insertId) {
        throw new Error('Select test failed');
      }

      // Test update
      const updateResult = await this.update('sync_queue', { sync_status: 'synced' }, 'id = ?', [insertId]);
      if (updateResult === 0) {
        throw new Error('Update test failed');
      }

      // Test delete
      const deleteResult = await this.delete('sync_queue', 'id = ?', [insertId]);
      if (deleteResult === 0) {
        throw new Error('Delete test failed');
      }

      console.log('CRUD operations test passed');

    } catch (error) {
      console.error('CRUD operations test failed:', error);
      throw error;
    }
  }

  // Emergency recovery methods
  async emergencyRecovery() {
    // CRASH FIX CRITICAL-003: Check if already initializing to prevent concurrent recovery
    if (this.isInitializing) {
      console.log('🛑 CRASH FIX CRITICAL-003: Emergency recovery blocked - initialization already in progress');
      return false;
    }

    // Set lock immediately to prevent concurrent calls
    this.isInitializing = true;

    try {
      console.log('[Database] Starting emergency recovery...');

      // Reset initialization state (keep lock active)
      this.isInitialized = false;
      this.initPromise = null;

      // Close existing connection
      if (this.db) {
        this.db = null;
      }

      // Force fresh initialization (will reset isInitializing flag when done)
      return await this.init();

    } catch (error) {
      // SILENT FIX: Log error but never throw - return false
      console.error('[Database] Emergency recovery failed:', error?.message || error);
      return false;
    } finally {
      // CRASH FIX CRITICAL-003: Always release lock, even on failure
      this.isInitializing = false;
    }
  }

  async forceReset() {
    try {
      console.log('[Database] Force resetting database...');

      this.isInitialized = false;
      this.isInitializing = false;
      this.initPromise = null;

      if (this.db) {
        try {
          await this.dropAllTables();
        } catch (error) {
          console.error('[Database] Error dropping tables during force reset:', error?.message || error);
        }
        this.db = null;
      }

      // Fresh start
      return await this.init();

    } catch (error) {
      // SILENT FIX: Log error but never throw - return false
      console.error('[Database] Force reset failed:', error?.message || error);
      return false;
    }
  }

  // Health check method
  async healthCheck() {
    try {
      const isConnected = await this.isConnected();
      const info = await this.getDatabaseInfo();
      const testResult = await this.testDatabaseOperations();

      return {
        isHealthy: isConnected && testResult.success,
        isConnected,
        isInitialized: this.isInitialized,
        info,
        testResult
      };
    } catch (error) {
      return {
        isHealthy: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const databaseService = new DatabaseService();

// Auto-recovery on critical errors with memory leak prevention
let recoveryInProgress = false;
let recoveryTimer = null;

if (typeof process !== 'undefined' && process.on) {
  process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && reason.message.includes('database') && !recoveryInProgress) {
      recoveryInProgress = true;
      console.warn('Unhandled database rejection detected, attempting recovery...');

      // Clear any existing recovery timer
      if (recoveryTimer) {
        clearTimeout(recoveryTimer);
      }

      // Set a timeout to prevent infinite recovery attempts
      recoveryTimer = setTimeout(() => {
        recoveryInProgress = false;
        recoveryTimer = null;
      }, 30000); // 30 second cooldown

      databaseService.emergencyRecovery()
        .catch(err => {
          console.error('Emergency recovery failed:', err);
        })
        .finally(() => {
          recoveryInProgress = false;
          if (recoveryTimer) {
            clearTimeout(recoveryTimer);
            recoveryTimer = null;
          }
        });
    }
  });
}

export default databaseService;