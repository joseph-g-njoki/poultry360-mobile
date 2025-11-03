# Poultry360 Database Schema Migration Guide

## 🎯 Objective
Achieve 100% schema alignment between NestJS backend (PostgreSQL/TypeORM) and React Native mobile app (SQLite) databases.

---

## 📋 Pre-Migration Checklist

### Critical Information Needed
Before running the migration, gather this information:

1. **Organization ID**: What is the current user's organization ID?
   - Check: `AsyncStorage.getItem('organizationId')`
   - Or retrieve from user profile/authentication context
   - This value will be populated into ALL existing records

2. **Database Location**: Confirm database file location
   - Default: `${FileSystem.documentDirectory}SQLite/poultry360.db`
   - Verify with: `console.log(FileSystem.documentDirectory)`

3. **Record Count**: Know how many records you have
   - Run schemaVerification.js first to see data volume
   - Large databases may take longer to migrate

### Backup Strategy
- ✅ Automatic backup is created by executeSchemaMigration.js
- ✅ Backup filename includes timestamp
- ✅ Location: Same as database with prefix `poultry360_backup_`
- ⚠️ Ensure sufficient storage space (backup = database size)

---

## 🔍 Step 1: Pre-Migration Verification

### Run Schema Verification (BEFORE Migration)

```javascript
// In your React Native app, add this test code:
import { verifyDatabaseSchema, generateSchemaReport } from './src/services/schemaVerification';

async function checkSchemaBeforeMigration() {
  try {
    console.log('🔍 Running pre-migration schema check...');
    const results = await verifyDatabaseSchema();
    const report = generateSchemaReport(results);
    console.log(report);

    // Save report for comparison
    return results;
  } catch (error) {
    console.error('Pre-migration verification failed:', error);
  }
}

// Run it
checkSchemaBeforeMigration();
```

**Expected Output (BEFORE migration):**
```
❌ CRITICAL ISSUES:
  - poultry_batches: Missing organization_id, notes, deleted_at
  - health_records: Missing organization_id, deleted_at
  - water_records: Missing organization_id, deleted_at
  - weight_records: Missing organization_id, deleted_at

Total critical issues: 10
```

---

## 🚀 Step 2: Execute Migration

### Option A: Migration with Organization ID (RECOMMENDED)

```javascript
import { executeSchemaMigration } from './src/services/executeSchemaMigration';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function runMigration() {
  try {
    // Get the user's organization ID
    const organizationId = await AsyncStorage.getItem('organizationId');

    if (!organizationId) {
      console.error('❌ Cannot migrate: Organization ID not found!');
      console.error('Please ensure user is logged in and organization is set.');
      return;
    }

    console.log('🚀 Starting migration with organization ID:', organizationId);

    // Execute migration
    const result = await executeSchemaMigration(parseInt(organizationId));

    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log('💾 Backup saved at:', result.backupPath);
      console.log('⏰ Timestamp:', result.timestamp);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Check the backup file to restore if needed');
  }
}

// Execute
runMigration();
```

### Option B: Migration WITHOUT Organization ID (Manual Cleanup Required)

```javascript
import { executeSchemaMigration } from './src/services/executeSchemaMigration';

async function runMigrationWithoutOrgId() {
  try {
    console.warn('⚠️  Running migration WITHOUT organization ID');
    console.warn('You MUST populate organization_id manually after migration!');

    // Execute migration (pass null for organizationId)
    const result = await executeSchemaMigration(null);

    if (result.success) {
      console.log('✅ Schema updated, but organization_id is NULL');
      console.log('🔧 Next step: Run organization ID population script');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}
```

### Option C: Dry Run (Test Without Making Changes)

```javascript
import { dryRunSchemaMigration } from './src/services/executeSchemaMigration';

async function testMigration() {
  try {
    console.log('🧪 Running dry run...');
    await dryRunSchemaMigration();
    console.log('✅ Dry run complete - no changes made');
  } catch (error) {
    console.error('Dry run failed:', error);
  }
}

testMigration();
```

---

## ✅ Step 3: Post-Migration Verification

### Run Schema Verification (AFTER Migration)

```javascript
import { verifyDatabaseSchema, generateSchemaReport, isSchemaAligned } from './src/services/schemaVerification';

async function checkSchemaAfterMigration() {
  try {
    console.log('🔍 Running post-migration schema check...');
    const results = await verifyDatabaseSchema();
    const report = generateSchemaReport(results);
    console.log(report);

    // Quick check
    const aligned = await isSchemaAligned();
    if (aligned) {
      console.log('🎉 SUCCESS: Schema is 100% aligned!');
    } else {
      console.error('⚠️  Schema still has issues. Review the report above.');
    }

    return results;
  } catch (error) {
    console.error('Post-migration verification failed:', error);
  }
}

checkSchemaAfterMigration();
```

**Expected Output (AFTER successful migration):**
```
✅ SCHEMA 100% ALIGNED WITH BACKEND

Tables analyzed: 4
Perfect matches: 4
Critical issues: 0
Warnings: 0

🎉 SCHEMA IS 100% ALIGNED!
```

---

## 🧪 Step 4: Functional Testing

After migration, test these operations thoroughly:

### Test 1: Create New Records

```javascript
// Test creating a new poultry batch
async function testCreateBatch() {
  const batch = {
    batch_name: 'Test Batch After Migration',
    bird_type: 'Broiler',
    initial_count: 100,
    current_count: 100,
    farm_id: 1,
    organization_id: 1, // Should now be accepted
    arrival_date: new Date().toISOString(),
    notes: 'Testing notes field' // Should now work
  };

  // Insert using your existing database service
  const result = await Database.insertPoultryBatch(batch);
  console.log('✅ Batch created:', result);
}
```

### Test 2: Verify Foreign Key Constraints

```javascript
// Test that foreign keys work correctly
async function testForeignKeys() {
  try {
    // Should succeed: valid batch_id
    await Database.insertHealthRecord({
      batch_id: 1,
      organization_id: 1,
      health_status: 'healthy',
      // ... other fields
    });
    console.log('✅ Foreign key constraint working (valid reference)');

    // Should fail: invalid batch_id
    await Database.insertHealthRecord({
      batch_id: 99999, // Non-existent batch
      organization_id: 1,
      health_status: 'healthy'
    });
    console.error('❌ Foreign key constraint NOT working (should have failed)');
  } catch (error) {
    if (error.message.includes('FOREIGN KEY constraint failed')) {
      console.log('✅ Foreign key constraint working (correctly rejected invalid reference)');
    } else {
      console.error('❌ Unexpected error:', error);
    }
  }
}
```

### Test 3: Soft Delete Functionality

```javascript
// Test soft delete with new deleted_at column
async function testSoftDelete() {
  const db = SQLite.openDatabase('poultry360.db');

  db.transaction(tx => {
    // Create a test record
    tx.executeSql(
      'INSERT INTO poultry_batches (batch_name, organization_id, farm_id) VALUES (?, ?, ?)',
      ['Test Delete Batch', 1, 1],
      (_, result) => {
        const insertId = result.insertId;

        // Soft delete it
        tx.executeSql(
          'UPDATE poultry_batches SET deleted_at = datetime("now") WHERE id = ?',
          [insertId],
          () => {
            // Verify it's soft deleted
            tx.executeSql(
              'SELECT * FROM poultry_batches WHERE id = ? AND deleted_at IS NOT NULL',
              [insertId],
              (_, result) => {
                if (result.rows.length > 0) {
                  console.log('✅ Soft delete working with deleted_at');
                } else {
                  console.error('❌ Soft delete not working');
                }
              }
            );
          }
        );
      }
    );
  });
}
```

### Test 4: Sync with Backend

```javascript
// Test syncing records to backend
async function testBackendSync() {
  try {
    console.log('🔄 Testing sync with backend...');

    // Trigger sync
    await SyncService.syncAll();

    console.log('✅ Sync completed without errors');
    console.log('Check backend logs to verify data was received correctly');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    console.error('Check if organization_id is causing issues');
  }
}
```

---

## 🔧 Step 5: Update fastDatabase.js (For Future Installations)

⚠️ **IMPORTANT**: The migration script only updates EXISTING databases.
For NEW installations, you must update the CREATE TABLE statements.

### Manual Update Required

Open this file and apply the changes:
```
C:/Users/josep/OneDrive/Desktop/poultry360-app/mobile/poultry360-mobile/src/services/fastDatabase_schema_updates.txt
```

Follow the instructions in that file to update all 4 CREATE TABLE statements in `fastDatabase.js`.

**Why this is necessary:**
- The migration script uses ALTER TABLE for existing databases
- New database installations use CREATE TABLE statements
- Without updating CREATE TABLE statements, new installs will have the old schema

---

## 🚨 Troubleshooting

### Issue 1: "Duplicate column" Error

**Symptom:**
```
Error adding organization_id: duplicate column name: organization_id
```

**Solution:**
This is normal! The migration script handles this gracefully. It means the column already exists (possibly from a previous migration attempt). The migration will continue and succeed.

### Issue 2: NULL organization_id After Migration

**Symptom:**
```
⚠️ poultry_batches: 50 records with NULL organization_id
```

**Solution:**
Run organization ID population:

```javascript
import * as SQLite from 'expo-sqlite';

async function populateOrganizationIds(organizationId) {
  const db = SQLite.openDatabase('poultry360.db');

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      const tables = ['poultry_batches', 'health_records', 'water_records', 'weight_records'];

      tables.forEach(tableName => {
        tx.executeSql(
          `UPDATE ${tableName} SET organization_id = ? WHERE organization_id IS NULL`,
          [organizationId],
          (_, result) => {
            console.log(`✅ Updated ${result.rowsAffected} records in ${tableName}`);
          }
        );
      });
    }, reject, resolve);
  });
}

// Run it
populateOrganizationIds(1); // Replace 1 with actual org ID
```

### Issue 3: Foreign Key Constraint Failures

**Symptom:**
```
FOREIGN KEY constraint failed when inserting health_record
```

**Solution:**
Ensure the referenced batch exists:

```javascript
// Check if batch exists
db.transaction(tx => {
  tx.executeSql(
    'SELECT id FROM poultry_batches WHERE id = ? AND deleted_at IS NULL',
    [batchId],
    (_, result) => {
      if (result.rows.length === 0) {
        console.error('❌ Batch does not exist or is soft-deleted');
      }
    }
  );
});
```

### Issue 4: Migration Failed Completely

**Symptom:**
Migration transaction failed with critical error

**Solution:**
Restore from backup:

```javascript
import * as FileSystem from 'expo-file-system';

async function restoreFromBackup(backupPath) {
  try {
    const dbPath = `${FileSystem.documentDirectory}SQLite/poultry360.db`;

    // Close all database connections first!
    // Then copy backup over current database
    await FileSystem.copyAsync({
      from: backupPath,
      to: dbPath
    });

    console.log('✅ Database restored from backup');
    console.log('🔄 Restart the app to reload the database');
  } catch (error) {
    console.error('❌ Restore failed:', error);
  }
}

// Usage
restoreFromBackup('path/to/backup/poultry360_backup_2025-10-22T12-00-00.db');
```

---

## 📊 Verification Checklist

After completing the migration, verify:

- [ ] All 4 tables have `organization_id` column
- [ ] All 4 tables have `deleted_at` column
- [ ] `poultry_batches` has `notes` column
- [ ] No records have NULL `organization_id` (unless intended)
- [ ] Can create new records successfully
- [ ] Can update existing records
- [ ] Foreign key constraints work (reject invalid references)
- [ ] Soft delete works with `deleted_at`
- [ ] Sync to backend succeeds without errors
- [ ] Schema verification shows 100% alignment
- [ ] `fastDatabase.js` CREATE TABLE statements are updated

---

## 📝 Migration Log Template

Keep a record of your migration:

```
Migration Date: 2025-10-22
Executed By: [Your Name]
Organization ID Used: [ID]
Pre-Migration Record Counts:
  - poultry_batches: [count]
  - health_records: [count]
  - water_records: [count]
  - weight_records: [count]

Migration Result: [SUCCESS/FAILED]
Backup Path: [path]
Issues Encountered: [list any issues]
Post-Migration Verification: [PASSED/FAILED]

Notes:
[Any additional notes]
```

---

## 🎉 Success Criteria

Migration is complete and successful when:

1. ✅ Schema verification shows 0 critical issues
2. ✅ All CRUD operations work correctly
3. ✅ Foreign key constraints are enforced
4. ✅ Backend sync completes without errors
5. ✅ No NULL organization_ids (or justified)
6. ✅ Soft delete works with deleted_at
7. ✅ fastDatabase.js is updated for new installations

---

## 📞 Support

If you encounter issues not covered in this guide:

1. Check the migration logs for specific error messages
2. Run schema verification to see exact mismatches
3. Review the backup file to ensure data is safe
4. Check backend logs for sync-related errors
5. Verify organization_id is correctly set in user context

---

## 🔄 Rollback Plan

If migration fails catastrophically:

1. **Immediate**: Restore from backup (see Issue 4 above)
2. **Verify**: Run schema verification to confirm rollback
3. **Investigate**: Review error logs to understand what went wrong
4. **Fix**: Address the root cause
5. **Retry**: Run migration again after fixing issues

---

## 📚 Files Reference

Migration files created:

1. **schemaMigration_v1.sql**
   - Raw SQL migration script
   - Use for manual execution if needed
   - Location: `src/services/schemaMigration_v1.sql`

2. **executeSchemaMigration.js**
   - JavaScript migration executor
   - Includes backup, transaction support, verification
   - Location: `src/services/executeSchemaMigration.js`

3. **schemaVerification.js**
   - Schema comparison and validation
   - Run before and after migration
   - Location: `src/services/schemaVerification.js`

4. **fastDatabase_schema_updates.txt**
   - Manual patch instructions for fastDatabase.js
   - Apply after migration for new installations
   - Location: `src/services/fastDatabase_schema_updates.txt`

5. **SCHEMA_MIGRATION_GUIDE.md**
   - This guide
   - Comprehensive execution instructions
   - Location: Root of mobile project

---

## ✅ Final Notes

- **Always test in development first** before migrating production databases
- **Keep backups** - they're created automatically but verify they exist
- **Update CREATE TABLE statements** in fastDatabase.js after successful migration
- **Document any customizations** you make to the migration scripts
- **Verify sync** with backend after migration to ensure compatibility

**Good luck with your migration! 🚀**
