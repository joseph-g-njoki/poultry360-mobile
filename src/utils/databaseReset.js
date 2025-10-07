/**
 * Database Reset Utility for Poultry360 Mobile App
 *
 * This utility helps reset the mobile database when encountering
 * schema errors like "fisrt name" column issues.
 *
 * Usage:
 * 1. Import this utility in your component
 * 2. Call resetDatabase() to clear all data and recreate schema
 * 3. Call debugDatabase() to inspect current database state
 */

import { openDatabaseSync } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

class DatabaseResetUtil {
  constructor() {
    this.db = null;
  }

  /**
   * Debug current database state
   * Helps identify schema issues and column problems
   */
  async debugDatabase() {
    try {
      console.log('🔍 Starting database debug analysis...');

      this.db = openDatabaseSync('poultry360_offline.db');

      // Check all tables
      const tables = this.db.getAllSync(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
      `);

      console.log(`📊 Found ${tables.length} tables:`, tables.map(t => t.name));

      // Specifically check users table schema
      if (tables.some(t => t.name === 'users')) {
        const userSchema = this.db.getAllSync("PRAGMA table_info(users)");
        console.log('👥 Users table schema:');
        userSchema.forEach(col => {
          console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''}`);
        });

        // Check for first_name column specifically
        const hasFirstName = userSchema.some(col => col.name === 'first_name');
        const hasTypo = userSchema.some(col => col.name.includes('fisrt'));

        if (hasFirstName) {
          console.log('✅ first_name column exists correctly');
        } else {
          console.log('❌ first_name column is missing');
        }

        if (hasTypo) {
          console.log('🎯 Found typo in column name!');
          const typoColumn = userSchema.find(col => col.name.includes('fisrt'));
          console.log(`   Typo column: ${typoColumn.name}`);
        }

        // Try to query users table
        try {
          const userCount = this.db.getFirstSync("SELECT COUNT(*) as count FROM users");
          console.log(`📈 Users table has ${userCount.count} records`);

          if (userCount.count > 0) {
            // Try to select with correct column name
            const sampleUsers = this.db.getAllSync("SELECT id, email, first_name, last_name FROM users LIMIT 3");
            console.log('📝 Sample users:', sampleUsers);
          }
        } catch (queryError) {
          console.log('❌ Error querying users table:', queryError.message);
          if (queryError.message.includes('fisrt')) {
            console.log('🎯 Confirmed: Query contains typo "fisrt"');
          }
        }
      } else {
        console.log('❌ Users table does not exist');
      }

      // Check storage keys
      const allKeys = await AsyncStorage.getAllKeys();
      const relevantKeys = allKeys.filter(key =>
        key.includes('user') || key.includes('auth') || key.includes('database')
      );
      console.log('🗄️  Relevant AsyncStorage keys:', relevantKeys);

      return {
        success: true,
        tablesFound: tables.length,
        hasUsersTable: tables.some(t => t.name === 'users'),
        issues: []
      };

    } catch (error) {
      console.error('❌ Database debug failed:', error);
      return {
        success: false,
        error: error.message,
        hasTypoInError: error.message.includes('fisrt')
      };
    }
  }

  /**
   * Reset the entire mobile database
   * This will clear all local data and recreate the schema
   */
  async resetDatabase() {
    try {
      console.log('🔄 Starting database reset...');

      this.db = openDatabaseSync('poultry360_offline.db');

      // List of tables to drop (in dependency order)
      const tablesToDrop = [
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

      // Drop all tables
      for (const table of tablesToDrop) {
        try {
          this.db.execSync(`DROP TABLE IF EXISTS ${table};`);
          console.log(`✅ Dropped table: ${table}`);
        } catch (error) {
          console.log(`⚠️  Could not drop table ${table}: ${error.message}`);
        }
      }

      // Clear related AsyncStorage data
      const keysToRemove = [
        'userToken',
        'userData',
        'database_version',
        'lastSyncTime',
        'initialSyncCompleted',
        'initialSetupCompleted',
        'lastMigrationTime',
        'legacyDataMigrated'
      ];

      for (const key of keysToRemove) {
        try {
          await AsyncStorage.removeItem(key);
          console.log(`✅ Cleared AsyncStorage key: ${key}`);
        } catch (error) {
          console.log(`⚠️  Could not clear key ${key}: ${error.message}`);
        }
      }

      console.log('✅ Database reset completed successfully');
      console.log('ℹ️  Please restart the app to reinitialize the database');

      return {
        success: true,
        message: 'Database reset completed. Please restart the app.'
      };

    } catch (error) {
      console.error('❌ Database reset failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Force recreate users table with correct schema
   * Use this if only the users table has issues
   */
  async recreateUsersTable() {
    try {
      console.log('🔧 Recreating users table...');

      this.db = openDatabaseSync('poultry360_offline.db');

      // Drop existing users table
      this.db.execSync('DROP TABLE IF EXISTS users;');

      // Recreate with correct schema
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

      console.log('✅ Users table recreated with correct schema');

      return {
        success: true,
        message: 'Users table recreated successfully'
      };

    } catch (error) {
      console.error('❌ Failed to recreate users table:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if database has corruption or schema issues
   */
  async checkDatabaseHealth() {
    try {
      this.db = openDatabaseSync('poultry360_offline.db');

      // Run PRAGMA integrity check
      const integrityResult = this.db.getFirstSync('PRAGMA integrity_check;');

      const issues = [];

      if (integrityResult.integrity_check !== 'ok') {
        issues.push(`Database integrity issue: ${integrityResult.integrity_check}`);
      }

      // Check for expected tables
      const tables = this.db.getAllSync(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
      `);

      const expectedTables = [
        'users', 'organizations', 'farms', 'poultry_batches',
        'feed_records', 'production_records', 'mortality_records',
        'health_records', 'sync_queue'
      ];

      const missingTables = expectedTables.filter(
        expected => !tables.some(t => t.name === expected)
      );

      if (missingTables.length > 0) {
        issues.push(`Missing tables: ${missingTables.join(', ')}`);
      }

      return {
        success: true,
        isHealthy: issues.length === 0,
        issues,
        tableCount: tables.length,
        tables: tables.map(t => t.name)
      };

    } catch (error) {
      return {
        success: false,
        isHealthy: false,
        error: error.message,
        issues: [error.message]
      };
    }
  }
}

export default new DatabaseResetUtil();