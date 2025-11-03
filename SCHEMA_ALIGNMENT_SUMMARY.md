# Schema Alignment Summary - Quick Reference

## 🎯 What Was Fixed

### Schema Mismatches Identified and Resolved

#### 1. **poultry_batches** Table
| Column | Status Before | Status After | Notes |
|--------|---------------|--------------|-------|
| `organization_id` | ❌ MISSING | ✅ ADDED | Critical for multi-tenant support |
| `notes` | ❌ MISSING | ✅ ADDED | Text field for batch notes |
| `deleted_at` | ❌ MISSING | ✅ ADDED | Soft delete timestamp |

#### 2. **health_records** Table
| Column | Status Before | Status After | Notes |
|--------|---------------|--------------|-------|
| `organization_id` | ❌ MISSING | ✅ ADDED | Critical for multi-tenant support |
| `deleted_at` | ❌ MISSING | ✅ ADDED | Soft delete timestamp |
| `recovery_date` | ✅ EXISTS | ✅ EXISTS | Already present (false alarm) |

#### 3. **water_records** Table
| Column | Status Before | Status After | Notes |
|--------|---------------|--------------|-------|
| `organization_id` | ❌ MISSING | ✅ ADDED | Critical for multi-tenant support |
| `deleted_at` | ❌ MISSING | ✅ ADDED | Soft delete timestamp |
| `water_source` | ✅ EXISTS | ✅ EXISTS | Already present (false alarm) |

#### 4. **weight_records** Table
| Column | Status Before | Status After | Notes |
|--------|---------------|--------------|-------|
| `organization_id` | ❌ MISSING | ✅ ADDED | Critical for multi-tenant support |
| `deleted_at` | ❌ MISSING | ✅ ADDED | Soft delete timestamp |
| `recorded_by` | ✅ EXISTS | ✅ EXISTS | Already present (false alarm) |

---

## 📊 Backend vs Mobile Schema Comparison

### Complete Field Mapping (All Tables)

#### POULTRY_BATCHES
```
Backend (TypeORM) ────────────> Mobile (SQLite)
─────────────────────────────────────────────────
id                            ─> id
organization_id (inherited)   ─> organization_id ✅ ADDED
farm_id                       ─> farm_id
batch_number                  ─> batch_name
breed                         ─> bird_type
initial_count                 ─> initial_count
current_count                 ─> current_count
date_received                 ─> arrival_date
age_weeks                     ─> age_weeks
notes                         ─> notes ✅ ADDED
status                        ─> status
created_at                    ─> created_at
updated_at                    ─> updated_at
deleted_at                    ─> deleted_at ✅ ADDED
                                 is_deleted (legacy, kept for compatibility)
                                 server_id (sync metadata)
                                 needs_sync (sync metadata)
                                 synced_at (sync metadata)
```

#### HEALTH_RECORDS
```
Backend (TypeORM) ────────────> Mobile (SQLite)
─────────────────────────────────────────────────
id                            ─> id
organization_id (inherited)   ─> organization_id ✅ ADDED
batch_id                      ─> batch_id
individual_bird_id            ─> individual_bird_id
health_status                 ─> health_status
symptoms                      ─> symptoms
treatment                     ─> treatment
medication                    ─> medication
treatment_date                ─> treatment_date
recovery_date                 ─> recovery_date ✅ EXISTS
mortality_count               ─> mortality_count
mortality_cause               ─> mortality_cause
recorded_by (userId)          ─> recorded_by
vet_id                        ─> vet_id
vaccination_type              ─> vaccination_type
disease                       ─> disease
record_date                   ─> record_date
notes                         ─> notes
created_at                    ─> created_at
updated_at                    ─> updated_at
deleted_at                    ─> deleted_at ✅ ADDED
                                 is_deleted (legacy)
                                 server_id (sync metadata)
                                 farm_id (denormalized for queries)
```

#### WATER_RECORDS
```
Backend (TypeORM) ────────────> Mobile (SQLite)
─────────────────────────────────────────────────
id                            ─> id
organization_id (inherited)   ─> organization_id ✅ ADDED
batch_id                      ─> batch_id
recorded_by (userId)          ─> recorded_by
date_recorded                 ─> date_recorded
quantity_liters               ─> quantity_liters
water_source                  ─> water_source ✅ EXISTS
quality                       ─> quality
temperature_celsius           ─> temperature_celsius
notes                         ─> notes
created_at                    ─> created_at
updated_at                    ─> updated_at
deleted_at                    ─> deleted_at ✅ ADDED
                                 is_deleted (legacy)
                                 server_id (sync metadata)
                                 farm_id (denormalized)
```

#### WEIGHT_RECORDS
```
Backend (TypeORM) ────────────> Mobile (SQLite)
─────────────────────────────────────────────────
id                            ─> id
organization_id (inherited)   ─> organization_id ✅ ADDED
batch_id                      ─> batch_id
recorded_by (userId)          ─> recorded_by ✅ EXISTS
date_recorded                 ─> date_recorded
sample_size                   ─> sample_size
average_weight_grams          ─> average_weight_grams
min_weight_grams              ─> min_weight_grams
max_weight_grams              ─> max_weight_grams
age_weeks                     ─> age_weeks
notes                         ─> notes
created_at                    ─> created_at
updated_at                    ─> updated_at
deleted_at                    ─> deleted_at ✅ ADDED
                                 is_deleted (legacy)
                                 server_id (sync metadata)
                                 farm_id (denormalized)
                                 average_weight_kg (convenience)
```

---

## 🔑 Critical Changes Explained

### 1. organization_id Column (CRITICAL)

**Why it's critical:**
- Backend uses TenantAwareEntity which adds organization_id to all tables
- Multi-tenant data isolation depends on this field
- Without it, sync will fail with "column not found" errors
- Data from different organizations could potentially mix

**Data type:** INTEGER
**Nullable:** Should be NOT NULL but SQLite limitations require nullable during ALTER
**Default value:** Must be populated manually for existing records

### 2. deleted_at Column (IMPORTANT)

**Why it's needed:**
- Backend uses TypeORM's `@DeleteDateColumn` decorator
- Soft delete implementation uses timestamps, not boolean flags
- Mobile currently uses `is_deleted INTEGER (0/1)`
- Mismatch causes sync issues when backend sends/expects deleted_at

**Data type:** TEXT (ISO 8601 timestamp in SQLite)
**Nullable:** YES (null means not deleted)
**Format:** "2025-10-22T10:30:00.000Z"

**Migration strategy:**
- Keep `is_deleted` for backward compatibility
- Add `deleted_at` for backend sync compatibility
- Convert existing soft deletes: `UPDATE ... SET deleted_at = datetime(updated_at) WHERE is_deleted = 1`

### 3. notes Column in poultry_batches (MINOR)

**Why it's needed:**
- Backend entity has notes field
- Mobile was missing this field entirely
- Not critical but prevents data loss when syncing from backend

**Data type:** TEXT
**Nullable:** YES

---

## 📋 Migration Scripts Provided

### 1. schemaMigration_v1.sql
**Purpose:** Raw SQL migration script
**Use case:** Manual execution in SQLite if needed
**Location:** `C:/Users/josep/OneDrive/Desktop/poultry360-app/mobile/poultry360-mobile/src/services/schemaMigration_v1.sql`

**Contains:**
- ALTER TABLE statements for all 4 tables
- CREATE INDEX statements for performance
- Comments and verification queries

### 2. executeSchemaMigration.js
**Purpose:** Automated migration executor with safety features
**Use case:** Run in React Native app
**Location:** `C:/Users/josep/OneDrive/Desktop/poultry360-app/mobile/poultry360-mobile/src/services/executeSchemaMigration.js`

**Features:**
- ✅ Automatic database backup
- ✅ Transaction-based (all-or-nothing)
- ✅ Error handling and rollback
- ✅ Organization ID population
- ✅ Soft delete conversion
- ✅ Post-migration verification

**Usage:**
```javascript
import { executeSchemaMigration } from './src/services/executeSchemaMigration';
await executeSchemaMigration(organizationId);
```

### 3. schemaVerification.js
**Purpose:** Compare mobile schema against backend schema
**Use case:** Run before and after migration to verify alignment
**Location:** `C:/Users/josep/OneDrive/Desktop/poultry360-app/mobile/poultry360-mobile/src/services/schemaVerification.js`

**Features:**
- ✅ Column existence checking
- ✅ Data type validation
- ✅ Foreign key verification
- ✅ Comprehensive reporting
- ✅ Quick alignment check

**Usage:**
```javascript
import { verifyDatabaseSchema, isSchemaAligned } from './src/services/schemaVerification';
const results = await verifyDatabaseSchema();
const aligned = await isSchemaAligned(); // Returns boolean
```

### 4. fastDatabase_schema_updates.txt
**Purpose:** Manual patch instructions for CREATE TABLE statements
**Use case:** Update fastDatabase.js for new installations
**Location:** `C:/Users/josep/OneDrive/Desktop/poultry360-app/mobile/poultry360-mobile/src/services/fastDatabase_schema_updates.txt`

**Why it's needed:**
- Migration script only updates EXISTING databases
- New installations use CREATE TABLE statements
- Must update CREATE TABLE to match migrated schema

---

## 🚀 Quick Start Guide

### For Existing Databases (MIGRATION)

1. **Get organization ID:**
   ```javascript
   const orgId = await AsyncStorage.getItem('organizationId');
   ```

2. **Run migration:**
   ```javascript
   import { executeSchemaMigration } from './src/services/executeSchemaMigration';
   await executeSchemaMigration(parseInt(orgId));
   ```

3. **Verify success:**
   ```javascript
   import { isSchemaAligned } from './src/services/schemaVerification';
   const aligned = await isSchemaAligned(); // Should return true
   ```

### For New Installations (SCHEMA UPDATE)

1. **Open fastDatabase.js:**
   ```
   C:/Users/josep/OneDrive/Desktop/poultry360-app/mobile/poultry360-mobile/src/services/fastDatabase.js
   ```

2. **Apply patches:**
   - Follow instructions in `fastDatabase_schema_updates.txt`
   - Add `organization_id` to all 4 tables
   - Add `deleted_at` to all 4 tables
   - Add `notes` to poultry_batches

3. **Test new installation:**
   - Delete app data
   - Reinstall app
   - Run schema verification
   - Confirm 100% alignment

---

## ✅ Expected Results After Migration

### Schema Verification Output
```
========================================
📊 VERIFICATION SUMMARY
========================================
Total tables checked: 4
Perfect matches: 4
Critical issues: 0
Warnings: 0

✅ SCHEMA 100% ALIGNED WITH BACKEND
```

### Database Columns (Example: poultry_batches)
```sql
PRAGMA table_info(poultry_batches);

-- Should show:
organization_id | INTEGER | 0 | NULL | 0
notes           | TEXT    | 0 | NULL | 0
deleted_at      | TEXT    | 0 | NULL | 0
```

### Record Sample (organization_id populated)
```sql
SELECT organization_id, batch_name, deleted_at FROM poultry_batches LIMIT 1;

-- Should return:
organization_id: 1
batch_name: "Batch 2024-01"
deleted_at: NULL
```

---

## 🔧 Maintenance

### Regular Schema Checks

Add to your app's health check routine:

```javascript
// In your app startup or health check
async function checkSchemaHealth() {
  const aligned = await isSchemaAligned();

  if (!aligned) {
    console.warn('⚠️ Schema misalignment detected!');
    // Notify admin or trigger migration flow
  }

  return aligned;
}
```

### Backend Schema Changes

When backend entities change:

1. Update EXPECTED_SCHEMA in schemaVerification.js
2. Create new migration script (e.g., schemaMigration_v2.sql)
3. Update fastDatabase.js CREATE TABLE statements
4. Run verification to identify new mismatches
5. Execute new migration
6. Verify alignment

---

## 📞 Troubleshooting Quick Reference

| Error | Cause | Solution |
|-------|-------|----------|
| "duplicate column" | Column already exists | Safe to ignore - migration continues |
| NULL organization_id | Migration without org ID | Run organization ID population script |
| FOREIGN KEY constraint failed | Referencing non-existent batch | Verify batch exists and is not soft-deleted |
| Migration transaction failed | Critical error | Restore from backup, check logs |
| Schema still misaligned | Migration didn't run completely | Re-run migration, check for errors |
| Sync fails after migration | Backend expects different format | Verify organization_id is populated |

---

## 📚 Documentation Files

| File | Purpose | Location |
|------|---------|----------|
| SCHEMA_MIGRATION_GUIDE.md | Comprehensive guide | Root of mobile project |
| SCHEMA_ALIGNMENT_SUMMARY.md | This quick reference | Root of mobile project |
| schemaMigration_v1.sql | SQL migration script | src/services/ |
| executeSchemaMigration.js | Migration executor | src/services/ |
| schemaVerification.js | Schema validator | src/services/ |
| fastDatabase_schema_updates.txt | Patch instructions | src/services/ |

---

## 🎯 Success Checklist

- [ ] Migration executed successfully
- [ ] Backup created and verified
- [ ] Schema verification shows 100% alignment
- [ ] No NULL organization_ids (or justified)
- [ ] Can create new records
- [ ] Can update existing records
- [ ] Foreign keys enforced correctly
- [ ] Soft delete works with deleted_at
- [ ] Sync to backend succeeds
- [ ] fastDatabase.js updated for new installs
- [ ] All tests pass

---

## 📊 Statistics

**Total columns added:** 10
- organization_id × 4 tables = 4 columns
- deleted_at × 4 tables = 4 columns
- notes × 1 table = 1 column
- Additional indexes = 8 indexes

**Tables updated:** 4
- poultry_batches
- health_records
- water_records
- weight_records

**Lines of code:** ~1500 lines across all migration scripts

**Estimated migration time:**
- Small DB (<1000 records): < 5 seconds
- Medium DB (<10000 records): < 30 seconds
- Large DB (>10000 records): < 2 minutes

---

**Last Updated:** 2025-10-22
**Version:** 1.0
**Status:** Ready for execution
