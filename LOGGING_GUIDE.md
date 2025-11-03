# Poultry360 Logging Guide

## Overview

The Poultry360 mobile app now includes a feature-based logging system that makes testing and debugging much easier by filtering logs by category.

## Quick Start

### 1. Using Feature-Based Logs in Your Code

Instead of using `console.log()` everywhere, use the category-specific loggers:

```javascript
import logger from '../utils/logger';

// Farm operations
logger.farm.info('Creating new farm', farmData);
logger.farm.success('Farm created successfully');
logger.farm.error('Failed to create farm', error);

// Batch operations
logger.batch.info('Deleting batch', batchId);
logger.batch.warn('Batch has no birds');

// Database operations
logger.database.debug('Executing query', sql);
logger.database.success('Data synced to SQLite');

// API calls
logger.api.info('POST /api/farms', requestData);
logger.api.error('API request failed', error);
```

### 2. Filtering Logs in Metro Terminal

While testing on your phone with Metro Bundler running, you can control which logs appear:

#### Show Only Farm Logs
```javascript
// In Metro terminal, type:
logger.only(['FARM'])
```

#### Show Only Farm and Batch Logs
```javascript
logger.only(['FARM', 'BATCH'])
```

#### Show Everything
```javascript
logger.enableAll()
```

#### Hide Everything (Except Errors)
```javascript
logger.disableAll()
```

#### See What's Currently Enabled
```javascript
logger.showConfig()
```

### 3. Using Logger from Metro Terminal

The logger is globally accessible in the Metro terminal. Just type commands directly:

```bash
# While Metro is running and your app is open:
logger.only(['FARM'])
logger.showConfig()
logger.enableAll()
```

## Available Log Categories

| Category | Purpose | Example Usage |
|----------|---------|---------------|
| `FARM` | Farm CRUD operations | Creating, updating, deleting farms |
| `BATCH` | Batch/flock operations | Managing poultry batches |
| `FEED` | Feed record tracking | Daily feed consumption |
| `WATER` | Water record tracking | Daily water consumption |
| `MORTALITY` | Mortality tracking | Recording bird deaths |
| `WEIGHT` | Weight measurements | Recording bird weights |
| `PRODUCTION` | Egg production | Tracking egg production |
| `HEALTH` | Health records | Vaccinations, treatments |
| `SYNC` | Data synchronization | Online/offline data sync |
| `DATABASE` | SQLite operations | Local database queries |
| `API` | Backend API calls | HTTP requests/responses |
| `AUTH` | Authentication | Login, registration, logout |
| `NETWORK` | Network status | Online/offline detection |
| `EVENTS` | Event bus messages | DataEventBus events |
| `UI` | UI operations | Screen navigation, rendering |
| `OFFLINE` | Offline mode | Offline queue management |

## Log Levels

Each category supports these log levels:

- `debug()` - Detailed debugging info (only in dev)
- `info()` - General information (only in dev)
- `warn()` - Warnings about potential issues (only in dev)
- `error()` - Errors (ALWAYS shown, even if category disabled)
- `success()` - Success messages (only in dev)

## Testing Workflow Example

### Testing Farm Deletion

1. **Start Metro Bundler**
   ```bash
   cd "C:\Users\josep\OneDrive\Desktop\poultry360-app\mobile\poultry360-mobile"
   npx expo start
   ```

2. **Connect Your Phone** (Scan QR code)

3. **Filter Logs to Show Only Farms**
   In Metro terminal:
   ```javascript
   logger.only(['FARM', 'DATABASE', 'API'])
   ```

4. **Delete a Farm** (on your phone)

5. **See Clean, Filtered Output**
   ```
   ℹ️ [FARM] Deleting farm: Farm A
   ℹ️ [API] DELETE /api/farms/122
   ✅ [DATABASE] Farm deleted from SQLite
   ✅ [FARM] Farm deletion complete
   ```

### Testing Batch Creation

```javascript
// In Metro terminal:
logger.only(['BATCH', 'DATABASE'])

// Then create a batch on your phone
// You'll only see batch-related logs
```

### Testing Full CRUD for Multiple Features

```javascript
// Show farms, batches, and database operations
logger.only(['FARM', 'BATCH', 'DATABASE', 'API'])

// Test creating farms, batches, and daily records
// Logs are organized by category
```

## Configuration Persistence

Your log filter settings are saved automatically to AsyncStorage, so they persist between app restarts. This means:

- Set `logger.only(['FARM'])` once
- Close and reopen the app
- Still only see farm logs

## Tips for Efficient Testing

### 1. Start Narrow, Then Expand
```javascript
// Start with just what you're testing
logger.only(['FARM'])

// If you need more context, add categories
logger.configure({ FARM: true, DATABASE: true, API: true })
```

### 2. Use showConfig() Often
```javascript
// Forgot what's enabled?
logger.showConfig()

// Output:
// ════════════════════════════════════════════════
// 📊 LOGGER CONFIGURATION
// ════════════════════════════════════════════════
//    ✅ FARM
//    ❌ BATCH
//    ❌ FEED
//    ...
```

### 3. Errors Always Show
Even if you disable a category, errors from that category will still appear. This ensures you never miss critical issues.

### 4. Quick Toggle
```javascript
// Disable everything when output is too noisy
logger.disableAll()

// Re-enable when you need details
logger.enableAll()
```

## Migration Guide

### Old Way (Everywhere in the Code)
```javascript
console.log('Creating farm:', farmData);
console.log('🌐 Deleting from PostgreSQL backend...');
console.log('💾 Deleting from local SQLite...');
console.error('❌ Failed to delete:', error);
```

**Problem**: All logs mixed together, hard to filter

### New Way (Organized by Feature)
```javascript
import logger from '../utils/logger';

logger.farm.info('Creating farm:', farmData);
logger.api.info('Deleting from PostgreSQL backend...');
logger.database.info('Deleting from local SQLite...');
logger.farm.error('Failed to delete:', error);
```

**Benefit**: Easy to filter with `logger.only(['FARM'])`

## Example: Converting fastApiService.js

### Before
```javascript
console.log('🔄 Starting farm delete operation:', farm.name);
console.log('🌐 Deleting from PostgreSQL backend...');
console.log('💾 Deleting from local SQLite...');
console.log('✅ Farm deleted successfully');
```

### After
```javascript
import logger from '../utils/logger';

logger.farm.info('Starting farm delete operation:', farm.name);
logger.api.info('Deleting from PostgreSQL backend...');
logger.database.info('Deleting from local SQLite...');
logger.farm.success('Farm deleted successfully');
```

### Testing Benefit
```javascript
// Now in Metro terminal, you can do:
logger.only(['FARM']) // See only farm operations
logger.only(['API'])  // See only API calls
logger.only(['FARM', 'DATABASE']) // See farm ops + database
```

## Backend Logs (Render)

The feature-based logger only works for the mobile app (Metro terminal). Backend logs in Render will continue to show as normal.

**Recommended Workflow**:
- **Metro Terminal**: Use filtered logs to focus on mobile app logic
- **Render Dashboard**: Check for backend errors and server-side processing

## Advanced: Custom Categories

You can add more categories by editing `src/utils/logger.js`:

```javascript
const LOG_CATEGORIES = {
  FARM: true,
  BATCH: true,
  // Add your custom category
  REPORTS: true,
  ANALYTICS: true,
};

// Then add the logger
logger.reports = createCategoryLogger('REPORTS');
logger.analytics = createCategoryLogger('ANALYTICS');
```

## Troubleshooting

### Logger Commands Not Working
Make sure Metro terminal is in focus and the app is running on your phone.

### Configuration Not Persisting
Check that AsyncStorage is working:
```javascript
logger.showConfig() // Should show your saved settings
```

### Too Many Logs Still Showing
Use `disableAll()` then selectively enable:
```javascript
logger.disableAll()
logger.configure({ FARM: true })
```

## Summary

**Before**: Hundreds of mixed logs, hard to find what you need
**After**: Clean, filtered logs showing only what matters for your current test

**Commands to Remember**:
- `logger.only(['FARM'])` - Focus on one feature
- `logger.showConfig()` - See what's enabled
- `logger.enableAll()` - Show everything
- `logger.disableAll()` - Hide everything except errors
