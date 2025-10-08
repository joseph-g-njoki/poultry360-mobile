# Translation Implementation Guide - Poultry360 Mobile App

## Executive Summary

**Status**: 1 of 11 screens fully translated
- ✅ **FarmsScreen**: Fully translated (100%)
- ⏳ **BatchesScreen**: Requires translation
- ⏳ **DashboardScreen**: Requires translation
- ⏳ **RecordsScreen**: Requires translation
- ⏳ **ProfileScreen**: Requires translation
- ⏳ **ExpensesScreen**: Requires translation
- ⏳ **SalesScreen**: Requires translation
- ⏳ **CustomersScreen**: Requires translation
- ⏳ **AnalyticsScreen**: Requires translation
- ⏳ **NotificationSettingsScreen**: Requires translation
- ⏳ **LoginScreen/RegisterScreen**: Requires translation

## What Was Fixed

### FarmsScreen (COMPLETE)
**File**: `C:\Users\josep\OneDrive\Desktop\poultry360-app\mobile\poultry360-mobile\src\screens\FarmsScreen.js`

**All hardcoded English text replaced with translation keys**:
1. Loading state messages
2. Header titles and buttons
3. Empty state messages
4. Farm card labels and values
5. Modal titles and form labels
6. All placeholders
7. All button text
8. All alert messages (success/error)
9. Dropdown options (farm types)

**Test this screen**:
1. Open the app
2. Go to Settings → Language
3. Switch to Luganda or Swahili
4. Navigate to Farms screen
5. All text should be translated

## Step-by-Step Fix for Remaining Screens

### BatchesScreen

**Location**: `src/screens/BatchesScreen.js`

**Step 1 - Add Import** (After line 22):
```javascript
import { useLanguage } from '../context/LanguageContext';
```

**Step 2 - Add Hook** (After line 28):
```javascript
const { t } = useLanguage();
```

**Step 3 - Replace Hardcoded Text**:

Find and replace these exact strings:

1. **Line 749**: `"Loading Batches..."`
   Replace with: `{t('common.loading')}`

2. **Line 758**: `"Poultry Batches"`
   Replace with: `{t('batches.title')}`

3. **Line 764**: `"+ Add Batch"`
   Replace with: `{"+ " + t('batches.addBatch')}`

4. **Line 773**: `"No Batches Yet"`
   Replace with: `{t('dropdowns.noBatchesCreate')}`

5. **Line 784**: `"Create First Batch"`
   Replace with: `{t('batches.addBatch')}`

6. **Line 817**: `"Edit Batch"` and `"Add New Batch"`
   Replace with: `{editingBatch ? t('batches.editBatch') : t('batches.addBatch')}`

7. **Line 821**: `"Batch Name *"`
   Replace with: `{t('batches.batchName') + " *"}`

8. **Line 828**: `"Enter batch name"`
   Replace with: `{t('placeholders.enterBatchName')}`

9. **Line 838**: `"Farm *"`
   Replace with: `{t('dropdowns.selectFarm') + " *"}`

10. **Line 855**: `"No farms available - Create a farm first"` and `"Select a farm"`
    Replace with:
    ```javascript
    label={farms.length === 0 ? t('dropdowns.noFarms') : t('dropdowns.selectFarm')}
    ```

11. **Line 881**: `"Bird Type *"`
    Replace with: `{t('batches.birdType') + " *"}`

12. **Line 888**: `"Enter bird type (e.g., Broiler, Layer)"`
    Replace with: `{t('placeholders.enterBirdType')}`

13. **Line 899**: `"Initial Count *"`
    Replace with: `{t('batches.initialCount') + " *"}`

14. **Line 906**: `"Number of birds"`
    Replace with: `{t('placeholders.numberOfBirds')}`

15. **Line 917**: `"Current Count"`
    Replace with: `{t('batches.currentCount')}`

16. **Line 924**: `"Current count"`
    Replace with: `{t('placeholders.currentCount')}`

17. **Line 936**: `"Arrival Date *"`
    Replace with: `{t('batches.arrivalDate') + " *"}`

18. **Line 953**: `"Status"`
    Replace with: `{t('batches.status')}`

19. **Lines 965-967**: Status picker items:
    ```javascript
    <Picker.Item label={t('batchStatus.active')} value="active" />
    <Picker.Item label={t('batchStatus.completed')} value="completed" />
    <Picker.Item label={t('batchStatus.inactive')} value="inactive" />
    ```

20. **Line 977**: `"Cancel"`
    Replace with: `{t('common.cancel')}`

21. **Line 984**: `"Update"` and `"Create"`
    Replace with: `{editingBatch ? t('common.save') : t('common.add')}`

22. **Alert messages** - Replace all Alert.alert calls:
    - Line 298: `Alert.alert('Access Denied', '...')` → `Alert.alert(t('common.error'), '...')`
    - Line 514: `Alert.alert('Success', 'Batch updated successfully!')` → `Alert.alert(t('common.success'), t('batches.batchUpdated'))`
    - Line 543: `Alert.alert('Success', 'Batch created successfully!')` → `Alert.alert(t('common.success'), t('batches.batchCreated'))`
    - Line 599: `Alert.alert('Success', 'Deleted successfully!')` → `Alert.alert(t('common.success'), t('batches.batchDeleted'))`

### DashboardScreen

**Location**: `src/screens/DashboardScreen.js`

**Critical Replacements**:

1. **Line 411**: `"Loading Dashboard..."`
   Replace with: `{t('dashboard.loadingDashboard')}`

2. **Line 429**: `"Welcome back,"`
   Replace with: `{t('dashboard.welcome') + ","}`

3. **Line 460**: `"Farm Overview"`
   Replace with: `{t('dashboard.overview')}`

4. **Lines 466-493**: Stats cards - Replace all titles:
   ```javascript
   title={t('dashboard.totalFarms')}  // "Total Farms"
   title={t('dashboard.activeFlocks')}  // "Active Flocks"
   title={t('kpi.totalBirds')}  // "Total Birds"
   title={t('kpi.todayStats')}  // "Today's Stats"
   title={t('kpi.myRecords')}  // "My Records"
   ```

5. **Line 511**: `"Recent Activities"`
   Replace with: `{t('dashboard.recentActivities')}`

6. **Line 533**: `"No recent activities"`
   Replace with: `{t('common.noData')}`

7. **Line 540**: `"Quick Actions"`
   Replace with: `{t('dashboard.quickActions')}`

8. **Lines 551-610**: Quick action buttons:
   ```javascript
   <Text>{t('feed.title')}</Text>  // "Record Feed"
   <Text>{t('health.title')}</Text>  // "Health Check"
   <Text>{t('batches.addBatch')}</Text>  // "Add Batch"
   <Text>{t('farms.title')}</Text>  // "Manage Farms"
   <Text>{t('dashboard.viewReports')}</Text>  // "View Reports"
   <Text>{t('production.title')}</Text>  // "Record Eggs"
   ```

### RecordsScreen

**Location**: `src/screens/RecordsScreen.js`

**Complex screen with 6 tabs (feed, health, mortality, production, water, weight)**

**Critical Replacements**:

1. **Line 936**: `"Loading Records..."`
   Replace with: `{t('common.loading')}`

2. **Line 945**: `"Records"`
   Replace with: `{t('navigation.production')}`

3. **Line 950**: `"+ Add Record"`
   Replace with: `{"+ " + t('dashboard.addRecord')}`

4. **Lines 956-961**: Tab buttons:
   ```javascript
   {renderTabButton('feed', t('navigation.feed'), '🌾')}
   {renderTabButton('health', t('navigation.health'), '🏥')}
   {renderTabButton('mortality', t('navigation.mortality'), '⚠️')}
   {renderTabButton('production', t('navigation.production'), '🥚')}
   {renderTabButton('water', t('placeholders.waterSource'), '💧')}
   {renderTabButton('weight', t('placeholders.weight'), '⚖️')}
   ```

5. **Line 968**: `"No {activeTab} records"`
   Replace with: `{t('common.noData')}`

6. **Line 976**: `"Add First Record"`
   Replace with: `{t('dashboard.addRecord')}`

7. **Line 1021**: Modal title
   Replace with: `{t('dashboard.addRecord')}`

8. **Form labels** - Replace all:
   - "Farm *" → `{t('dropdowns.selectFarm') + " *"}`
   - "Batch *" → `{t('dropdowns.selectBatch') + " *"}`
   - "Date *" → `{t('production.date') + " *"}`
   - "Feed Type *" → `{t('feed.feedType') + " *"}`
   - "Quantity (kg) *" → `{t('feed.quantityKg') + " *"}`
   - "Cost ($)" → `{t('feed.costPerKg')}`
   - "Health Status *" → `{t('health.healthIssue') + " *"}`
   - "Treatment" → `{t('health.treatment')}`
   - "Count *" → `{t('mortality.count') + " *"}`
   - "Cause" → `{t('mortality.cause')}`
   - "Eggs Collected" → `{t('production.eggsCollected')}`
   - "Weight (kg)" → `{t('production.eggsWeight')}`
   - "Notes" → `{t('production.notes')}`

9. **Picker items** - Translate all health status, water source, water quality options

10. **Placeholders** - Use `t('placeholders.*')` for all

### ProfileScreen

**Location**: `src/screens/ProfileScreen.js`

Need to read file first to identify all hardcoded text. Likely needs:
- Profile information labels
- Settings section titles
- Notification settings labels
- Account settings labels
- Button text

## Quick Implementation Steps

For each remaining screen:

1. Add import: `import { useLanguage } from '../context/LanguageContext';`
2. Add hook: `const { t } = useLanguage();`
3. Find all hardcoded English text
4. Replace with appropriate `t('key')` calls
5. Test by switching language in Settings

## Translation Key Reference

All keys are organized in these files:
- `src/locales/en.json` (English - reference)
- `src/locales/lg.json` (Luganda)
- `src/locales/sw.json` (Swahili)

Common patterns:
- `t('common.*')` - Buttons, actions, states
- `t('navigation.*')` - Screen names, navigation
- `t('farms.*')` - Farm-specific text
- `t('batches.*')` - Batch-specific text
- `t('production.*')` - Production records
- `t('feed.*')` - Feed records
- `t('health.*')` - Health records
- `t('mortality.*')` - Mortality records
- `t('placeholders.*')` - All input placeholders
- `t('dropdowns.*')` - Dropdown text
- `t('farmTypes.*')` - Farm type options
- `t('batchStatus.*')` - Batch status options
- `t('healthStatus.*')` - Health status options
- `t('waterSource.*')` - Water source options
- `t('waterQuality.*')` - Water quality options

## Testing Process

1. Complete translations for one screen
2. Test that screen:
   ```
   Settings → Language → Select Luganda
   Navigate to the screen
   Verify all text is in Luganda
   ```
3. Switch to Swahili and verify
4. Switch back to English and verify
5. Move to next screen

## Priority Order

Based on user interaction frequency:

1. ✅ FarmsScreen (DONE)
2. BatchesScreen (Next - high priority)
3. DashboardScreen (High priority)
4. RecordsScreen (High priority)
5. ProfileScreen (Medium priority)
6. ExpensesScreen (Medium priority)
7. SalesScreen (Medium priority)
8. Others (Lower priority)

## Expected Results

After full implementation:
- Users can switch between English, Luganda, and Swahili
- All UI text translates instantly
- Forms, buttons, labels, messages all display in selected language
- Language preference persists across app restarts
- No hardcoded English text remains

## Files Modified So Far

1. ✅ `src/screens/FarmsScreen.js` - Fully translated

## Files Remaining

1. `src/screens/BatchesScreen.js`
2. `src/screens/DashboardScreen.js`
3. `src/screens/RecordsScreen.js`
4. `src/screens/ProfileScreen.js`
5. `src/screens/ExpensesScreen.js`
6. `src/screens/SalesScreen.js`
7. `src/screens/CustomersScreen.js`
8. `src/screens/AnalyticsScreen.js`
9. `src/screens/NotificationSettingsScreen.js`
10. `src/screens/LoginScreen.js`
11. `src/screens/RegisterScreen.js`

## Success Criteria

- [x] LanguageContext properly set up
- [x] Translation JSON files complete
- [x] useLanguage hook functional
- [x] FarmsScreen fully translated
- [ ] All screens use translation system
- [ ] No English hardcoded text in app
- [ ] Language switching works seamlessly
- [ ] All three languages display correctly
