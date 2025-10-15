/**
 * Database Migration Service
 *
 * Handles schema updates for the SQLite database.
 * Uses fastDatabase for instant, synchronous operations.
 *
 * USAGE:
 * - Call migrationService.runMigrations() on app start
 * - Safe to run multiple times (checks if columns exist)
 */

import fastDatabase from './fastDatabase';

class DatabaseMigrationService {
  constructor() {
    this.serviceName = 'DatabaseMigrationService';
  }

  /**
   * Run all migrations
   */
  async runMigrations() {
    try {
      console.log('[Migration] 🔄 Starting database migrations...');

      // Ensure fastDatabase is initialized
      if (!fastDatabase.isReady || !fastDatabase.db) {
        console.log('[Migration] 🔄 Initializing fastDatabase...');
        const initResult = fastDatabase.init();
        if (!initResult || !fastDatabase.db) {
          throw new Error('Failed to initialize fastDatabase for migrations');
        }
        console.log('[Migration] ✅ FastDatabase initialized successfully');
      }

      // Migration 1: Add is_synced columns (already handled by fastDatabase migration)
      // fastDatabase.migrateAddIsDeletedColumn() handles this
      console.log('[Migration] ✅ Database schema migrations handled by fastDatabase');

      console.log('[Migration] ✅ All migrations completed successfully');
      return { success: true };
    } catch (error) {
      console.error('[Migration] ❌ Migration failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get migration status for debugging
   */
  async getMigrationStatus() {
    try {
      if (!fastDatabase.isReady || !fastDatabase.db) {
        fastDatabase.init();
      }

      const tables = fastDatabase.db.getAllSync(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`);

      const status = {};
      for (const table of tables) {
        try {
          const columns = fastDatabase.db.getAllSync(`PRAGMA table_info(${table.name})`);
          const hasIsDeleted = columns.some(col => col.name === 'is_deleted');
          status[table.name] = {
            exists: true,
            has_is_deleted: hasIsDeleted,
            columns: columns.map(c => c.name)
          };
        } catch (error) {
          status[table.name] = {
            exists: false,
            error: error.message
          };
        }
      }

      return status;
    } catch (error) {
      console.error('[Migration] Error getting status:', error);
      return { error: error.message };
    }
  }
}

export default new DatabaseMigrationService();
