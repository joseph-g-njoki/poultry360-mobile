/**
 * Database Migration Service
 *
 * Handles schema updates for the SQLite database.
 * Adds 'is_synced' column to all tables for offline-first sync tracking.
 *
 * USAGE:
 * - Call migrationService.runMigrations() on app start
 * - Safe to run multiple times (checks if columns exist)
 */

import fastDatabaseImport from './fastDatabase';

// FIX: Handle both default and named exports from fastDatabase
const fastDatabase = fastDatabaseImport.default || fastDatabaseImport;

class DatabaseMigrationService {
  constructor() {
    this.db = null;
    this.serviceName = 'DatabaseMigrationService';
  }

  /**
   * Initialize database connection
   */
  async init() {
    if (!this.db) {
      await fastDatabase.init();
      this.db = fastDatabase.db;
    }
  }

  /**
   * Run all migrations
   */
  async runMigrations() {
    try {
      console.log('[Migration] 🔄 Starting database migrations...');
      await this.init();

      // Migration 1: Add is_synced columns
      await this.addIsSyncedColumns();

      // Migration 2: Add organization_id and deleted_at columns for backend sync
      await this.addBackendSyncColumns();

      console.log('[Migration] ✅ All migrations completed successfully');
      return { success: true };
    } catch (error) {
      console.error('[Migration] ❌ Migration failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add is_synced column to all tables
   */
  async addIsSyncedColumns() {
    const tables = [
      'farms',
      'poultry_batches',
      'feed_records',
      'production_records',
      'mortality_records',
      'health_records',
      'water_records',
      'weight_records'
    ];

    console.log('[Migration] Adding is_synced columns to tables...');

    for (const table of tables) {
      try {
        // Check if column already exists
        const hasColumn = await this.columnExists(table, 'is_synced');

        if (!hasColumn) {
          await this.addColumn(table, 'is_synced', 'INTEGER DEFAULT 1');
          console.log(`[Migration] ✅ Added is_synced to ${table}`);
        } else {
          console.log(`[Migration] ⏭️  is_synced already exists in ${table}`);
        }
      } catch (error) {
        console.error(`[Migration] ❌ Failed to add is_synced to ${table}:`, error);
        throw error;
      }
    }
  }

  /**
   * Add organization_id and deleted_at columns for backend sync alignment
   */
  async addBackendSyncColumns() {
    console.log('[Migration] Adding backend sync columns (organization_id, deleted_at, notes)...');

    // Tables that need organization_id and deleted_at
    const syncTables = [
      { name: 'poultry_batches', extraColumns: ['notes'] },
      { name: 'health_records', extraColumns: [] },
      { name: 'water_records', extraColumns: [] },
      { name: 'weight_records', extraColumns: [] }
    ];

    for (const tableConfig of syncTables) {
      const { name: table, extraColumns } = tableConfig;

      try {
        // Add organization_id column
        const hasOrgId = await this.columnExists(table, 'organization_id');
        if (!hasOrgId) {
          await this.addColumn(table, 'organization_id', 'INTEGER');
          console.log(`[Migration] ✅ Added organization_id to ${table}`);
        } else {
          console.log(`[Migration] ⏭️  organization_id already exists in ${table}`);
        }

        // Add deleted_at column
        const hasDeletedAt = await this.columnExists(table, 'deleted_at');
        if (!hasDeletedAt) {
          await this.addColumn(table, 'deleted_at', 'TEXT');
          console.log(`[Migration] ✅ Added deleted_at to ${table}`);
        } else {
          console.log(`[Migration] ⏭️  deleted_at already exists in ${table}`);
        }

        // Add extra columns if specified (e.g., notes for poultry_batches)
        for (const columnName of extraColumns) {
          const hasColumn = await this.columnExists(table, columnName);
          if (!hasColumn) {
            await this.addColumn(table, columnName, 'TEXT');
            console.log(`[Migration] ✅ Added ${columnName} to ${table}`);
          } else {
            console.log(`[Migration] ⏭️  ${columnName} already exists in ${table}`);
          }
        }
      } catch (error) {
        console.error(`[Migration] ❌ Failed to add backend sync columns to ${table}:`, error);
        throw error;
      }
    }

    console.log('[Migration] ✅ Backend sync columns migration completed');
  }

  /**
   * Check if column exists in table
   */
  async columnExists(tableName, columnName) {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `PRAGMA table_info(${tableName})`,
          [],
          (_, result) => {
            const columns = [];
            for (let i = 0; i < result.rows.length; i++) {
              columns.push(result.rows.item(i).name);
            }
            resolve(columns.includes(columnName));
          },
          (_, error) => {
            console.error(`Error checking column ${columnName} in ${tableName}:`, error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Add column to table
   */
  async addColumn(tableName, columnName, columnDefinition) {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
          [],
          (_, result) => {
            resolve(result);
          },
          (_, error) => {
            console.error(`Error adding column ${columnName} to ${tableName}:`, error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Get migration status for debugging
   */
  async getMigrationStatus() {
    const tables = [
      'farms',
      'poultry_batches',
      'feed_records',
      'production_records',
      'mortality_records',
      'health_records',
      'water_records',
      'weight_records'
    ];

    const status = {};

    for (const table of tables) {
      try {
        const hasIsSynced = await this.columnExists(table, 'is_synced');
        status[table] = {
          exists: true,
          has_is_synced: hasIsSynced
        };
      } catch (error) {
        status[table] = {
          exists: false,
          error: error.message
        };
      }
    }

    return status;
  }
}

export default new DatabaseMigrationService();
