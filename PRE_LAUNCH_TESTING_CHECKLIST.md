# Pre-Launch Testing Checklist for Poultry360 Mobile App

## Overview
This checklist ensures the app is production-ready before deploying to real users. Test in the order listed to catch critical issues early.

---

## 1. Authentication & Security Tests

### Registration Flow
- [ ] Register new user with valid email and password
- [ ] Verify user is assigned to correct organization
- [ ] Attempt to register with existing email (should fail gracefully)
- [ ] Try registration with weak password (validate password rules)
- [ ] Test registration with missing required fields

### Login Flow
- [ ] Login with valid credentials
- [ ] Verify correct user data is loaded (name, role, organization)
- [ ] Attempt login with wrong password (should fail)
- [ ] Attempt login with non-existent email (should fail)
- [ ] **CRITICAL**: Verify users from Organization A cannot see data from Organization B

### Multi-Tenant Security (CRITICAL)
- [ ] Create test users in 2 different organizations (Org A and Org B)
- [ ] Login as User A, create farms/batches/records
- [ ] Logout, login as User B
- [ ] **VERIFY**: User B cannot see User A's farms, batches, or records
- [ ] Check dashboard counts (should only show User B's data)
- [ ] Check RecordsScreen tabs (should only show User B's records)
- [ ] **CRITICAL**: Verify organization_id is present in all API responses

### Session Management
- [ ] Close and reopen app (should stay logged in)
- [ ] Logout and verify all user data is cleared
- [ ] Verify token expiration (if implemented)

---

## 2. Farm Management Tests

### Create Farm
- [ ] Create farm with all fields filled
- [ ] Create farm with only required fields
- [ ] Verify farm appears on FarmsScreen immediately
- [ ] Verify dashboard "Total Farms" count increases

### View Farms
- [ ] Open FarmsScreen and verify all farms are listed
- [ ] Verify farm details (name, location, type, batch count, total birds)
- [ ] Tap on farm to view details

### Edit Farm
- [ ] Edit farm name
- [ ] Edit farm location
- [ ] Edit farm type
- [ ] Verify changes are saved and reflected immediately

### Delete Farm
- [ ] Delete farm with no batches
- [ ] **CRITICAL**: Attempt to delete farm with active batches (should warn or prevent)
- [ ] Verify farm is removed from FarmsScreen immediately
- [ ] Verify dashboard "Total Farms" count decreases

---

## 3. Batch (Flock) Management Tests

### Create Batch
- [ ] Create batch with all fields (name, bird type, initial count, arrival date)
- [ ] Verify batch appears on FlocksScreen immediately
- [ ] Verify dashboard "Active Batches" count increases
- [ ] Verify farm's "Batch Count" increases on FarmsScreen

### View Batches
- [ ] Open FlocksScreen and verify all batches are listed
- [ ] Verify batch details (name, bird type, counts, age, status)
- [ ] Verify "Age" is calculated correctly (days since arrival)

### Edit Batch
- [ ] Edit batch name
- [ ] Edit bird type
- [ ] Verify changes are saved and reflected immediately

### Delete Batch
- [ ] **CRITICAL**: Attempt to delete batch with existing records (should warn)
- [ ] Delete batch with no records
- [ ] Verify batch is removed from FlocksScreen immediately
- [ ] Verify dashboard "Active Batches" count decreases

---

## 4. Mortality Monitoring Tests (CRITICAL FEATURE)

### Create Mortality Record
- [ ] Add mortality record for Batch A (e.g., 5 deaths, Week 1)
- [ ] Verify batch "Current Count" decreases by 5
- [ ] Verify record appears in RecordsScreen "Mortality" tab immediately
- [ ] Verify dashboard "Recent Mortality" count increases

### Mortality Alerts (SMART MONITORING)
- [ ] **Week 1 Test (0-7 days)**: Add 50 deaths for 1000-bird batch (5% - should trigger WARNING)
- [ ] **Week 2 Test (8-14 days)**: Add 30 deaths for 1000-bird batch (3% - should trigger WARNING)
- [ ] **Week 3+ Test (15+ days)**: Add 20 deaths for 1000-bird batch (2% - should trigger WARNING)
- [ ] **CRITICAL Test**: Add 100 deaths for 1000-bird batch (10% - should trigger EMERGENCY)
- [ ] Verify notification appears with correct severity (⚠️ Warning, 🔥 Critical, 🚨 Emergency)
- [ ] Verify alert appears on Dashboard "Alerts" section
- [ ] **Cooldown Test**: Add another high mortality within 4 hours (should not notify again)
- [ ] **After Cooldown**: Wait 4 hours and add high mortality (should notify again)

### Filter Mortality Records by Batch
- [ ] Tap "View Mortality" from dashboard mortality alert
- [ ] Verify filter banner shows: "🔍 Showing mortality records for: [Batch Name]"
- [ ] Verify only that batch's mortality records are displayed
- [ ] **CRITICAL**: Verify filter banner ONLY appears on "Mortality" tab, not on other tabs
- [ ] Tap "Clear Filter ✕" and verify all mortality records appear again
- [ ] Verify filter banner disappears after clearing

### Delete Mortality Record
- [ ] Delete a mortality record
- [ ] **CRITICAL**: Verify batch "Current Count" INCREASES by the deleted death count
- [ ] Verify record is removed from RecordsScreen immediately
- [ ] Verify dashboard "Recent Mortality" count decreases

---

## 5. Production Records Tests

### Create Production Record
- [ ] Add production record for layer batch (e.g., 800 eggs collected)
- [ ] Verify record appears in RecordsScreen "Production" tab immediately
- [ ] Verify dashboard "Today's Production" count increases (if same day)

### View Production Records
- [ ] Open RecordsScreen "Production" tab
- [ ] Verify all production records are listed
- [ ] Verify record details (date, batch, eggs collected, notes)

### Delete Production Record
- [ ] Delete production record
- [ ] Verify record is removed immediately
- [ ] Verify dashboard "Today's Production" decreases (if same day)

---

## 6. Feed Records Tests

### Create Feed Record
- [ ] Add feed record (quantity, feed type, cost)
- [ ] Verify record appears in RecordsScreen "Feed" tab immediately

### View Feed Records
- [ ] Open RecordsScreen "Feed" tab
- [ ] Verify all feed records are listed with correct details

### Delete Feed Record
- [ ] Delete feed record
- [ ] Verify record is removed immediately

---

## 7. Health Records Tests

### Create Health Record
- [ ] Add health record (health status, treatment, notes)
- [ ] Verify record appears in RecordsScreen "Health" tab immediately

### View Health Records
- [ ] Open RecordsScreen "Health" tab
- [ ] Verify all health records are listed

### Delete Health Record
- [ ] Delete health record
- [ ] Verify record is removed immediately

---

## 8. Water Records Tests

### Create Water Record
- [ ] Add water record (quantity in liters, date)
- [ ] Verify record appears in RecordsScreen "Water" tab immediately

### View Water Records
- [ ] Open RecordsScreen "Water" tab
- [ ] Verify all water records are listed

### Delete Water Record
- [ ] Delete water record
- [ ] Verify record is removed immediately

---

## 9. Weight Records Tests

### Create Weight Record
- [ ] Add weight record (average weight, sample size, date)
- [ ] Verify record appears in RecordsScreen "Weight" tab immediately

### View Weight Records
- [ ] Open RecordsScreen "Weight" tab
- [ ] Verify all weight records are listed

### Delete Weight Record
- [ ] Delete weight record
- [ ] Verify record is removed immediately

---

## 10. Vaccination Records Tests

### Create Vaccination Record
- [ ] Add vaccination record (vaccine type, date, administered by)
- [ ] Verify record appears in RecordsScreen "Vaccination" tab immediately

### View Vaccination Records
- [ ] Open RecordsScreen "Vaccination" tab
- [ ] Verify all vaccination records are listed

### Delete Vaccination Record
- [ ] Delete vaccination record
- [ ] Verify record is removed immediately

---

## 11. Dashboard Tests (CRITICAL)

### Dashboard Data Accuracy
- [ ] Verify "Total Farms" count matches actual farms
- [ ] Verify "Active Batches" count matches active batches
- [ ] Verify "Total Birds" count matches sum of all batch current_counts
- [ ] Verify "Recent Mortality" count matches recent death records
- [ ] Verify "Today's Production" matches today's egg collection

### Dashboard Refresh
- [ ] Create new farm → verify dashboard updates immediately
- [ ] Create new batch → verify dashboard updates immediately
- [ ] Add mortality record → verify "Recent Mortality" and "Total Birds" update immediately
- [ ] Add production record → verify "Today's Production" updates immediately
- [ ] Delete farm → verify dashboard updates immediately

### Recent Activities
- [ ] Verify recent activities list shows latest actions
- [ ] Verify activity items have correct timestamps
- [ ] Verify activity items have correct descriptions

### Alerts Section
- [ ] Verify mortality alerts appear on dashboard
- [ ] Tap "View Mortality" from alert → verify navigation to filtered mortality records
- [ ] Verify alert severity colors (yellow = warning, orange = critical, red = emergency)

---

## 12. Analytics Screen Tests

### Analytics Data
- [ ] Open Analytics screen
- [ ] Verify charts display correct data
- [ ] Verify mortality trends are accurate
- [ ] Verify production trends are accurate
- [ ] Verify feed consumption trends are accurate

### Date Range Filters
- [ ] Test "Last 7 Days" filter
- [ ] Test "Last 30 Days" filter
- [ ] Test "Last 90 Days" filter
- [ ] Test custom date range

---

## 13. Profile & Settings Tests

### Profile Management
- [ ] View profile (verify user details)
- [ ] Edit first name
- [ ] Edit last name
- [ ] Edit phone number
- [ ] Verify changes are saved and reflected immediately

### App Settings
- [ ] Toggle dark mode on/off
- [ ] Verify theme changes apply immediately to all screens
- [ ] Test notification settings (if implemented)

---

## 14. Offline Mode Tests (CRITICAL)

### Offline Data Creation
- [ ] Turn off WiFi and mobile data
- [ ] Create farm while offline
- [ ] Create batch while offline
- [ ] Add mortality record while offline
- [ ] Add production record while offline
- [ ] Verify all data is stored locally in SQLite
- [ ] Verify UI shows "Offline Mode" or similar indicator

### Sync When Online
- [ ] Turn WiFi/data back on
- [ ] Verify app detects online status
- [ ] Verify all offline data syncs to PostgreSQL backend
- [ ] Verify `needs_sync` flag is cleared after successful sync
- [ ] Verify `server_id` is populated for synced records

### Offline to Online Transitions
- [ ] Start offline, create data, go online → verify auto-sync
- [ ] Start online, create data, go offline, come back online → verify consistency

---

## 15. Edge Cases & Error Handling

### Invalid Inputs
- [ ] Try creating farm with empty name (should show validation error)
- [ ] Try creating batch with 0 initial count (should show validation error)
- [ ] Try adding mortality count greater than batch current count (should warn or prevent)
- [ ] Try adding production record with negative egg count (should prevent)

### Data Consistency
- [ ] Delete batch → verify all associated records are handled correctly
- [ ] Delete farm → verify all batches and records are handled correctly
- [ ] **CRITICAL**: Add 100 deaths to 50-bird batch (should prevent or cap at 50)

### App Crashes
- [ ] Force close app during record creation → verify data integrity on restart
- [ ] Force close app during sync → verify sync resumes correctly

---

## 16. Performance Tests

### Large Dataset Handling
- [ ] Create 50+ farms → verify FarmsScreen loads quickly
- [ ] Create 100+ batches → verify FlocksScreen loads quickly
- [ ] Create 500+ mortality records → verify RecordsScreen scrolls smoothly
- [ ] Verify dashboard loads quickly even with large dataset

### Memory Usage
- [ ] Monitor app memory usage during heavy use
- [ ] Verify no memory leaks when navigating between screens
- [ ] Test app on low-end Android device (2GB RAM)

---

## 17. UI/UX Tests

### Navigation
- [ ] Test bottom tab navigation (Dashboard, Farms, Flocks, Records, Analytics, Profile)
- [ ] Test back navigation on all screens
- [ ] Verify screen headers are correct
- [ ] Verify icons are visible and appropriate

### Visual Polish
- [ ] Verify consistent spacing and padding across screens
- [ ] Verify text is readable in both light and dark modes
- [ ] Verify buttons are touch-friendly (minimum 44x44 pixels)
- [ ] Verify loading indicators appear during data fetches
- [ ] Verify empty states ("No farms yet", "No records", etc.) are user-friendly

### Accessibility
- [ ] Test with large font size (Android Accessibility Settings)
- [ ] Verify important text has sufficient contrast
- [ ] Verify all interactive elements are accessible

---

## 18. Notification Tests

### Mortality Alerts
- [ ] Trigger mortality alert → verify push notification appears
- [ ] Tap notification → verify app opens to mortality records
- [ ] Verify notification sound/vibration (if enabled)
- [ ] Verify notification appears in notification tray

### Permission Checks
- [ ] First launch → verify notification permission is requested
- [ ] Grant permission → verify notifications work
- [ ] Deny permission → verify app still works (but no notifications)

---

## 19. Platform-Specific Tests

### Android Tests
- [ ] Test on Android 8.0 (API 26) - minimum supported version
- [ ] Test on Android 13 (API 33) - latest version
- [ ] Test on different screen sizes (phone, tablet)
- [ ] Test app icon and splash screen
- [ ] Test back button behavior (should exit app or go back)

### iOS Tests (if applicable)
- [ ] Test on iOS 12+ (minimum supported version)
- [ ] Test on different iPhone models
- [ ] Test app icon and splash screen
- [ ] Test swipe gestures

---

## 20. Production Build Tests

### APK Build
- [ ] Build production APK: `eas build --platform android --profile production`
- [ ] Install APK on physical device (not emulator)
- [ ] Verify app launches successfully
- [ ] Verify no debug logs appear
- [ ] Verify app version and build number are correct

### Sentry Error Tracking
- [ ] Trigger a test error in production build
- [ ] Verify error appears in Sentry dashboard (https://sentry.io)
- [ ] Verify stack trace is readable (source maps working)
- [ ] Verify user context is included (email, organization)

### App Store Readiness (when ready)
- [ ] App icon (512x512 PNG)
- [ ] App screenshots (various screen sizes)
- [ ] App description and keywords
- [ ] Privacy policy URL
- [ ] Terms of service URL

---

## Critical Issues to Report Immediately

If any of these occur, **STOP TESTING** and report:

1. **Multi-tenant data leak**: User from Org A sees data from Org B
2. **Data loss**: Records disappear or are not saved
3. **Crash on launch**: App crashes immediately when opened
4. **Authentication bypass**: Can access app without login
5. **Incorrect bird counts**: Mortality not updating batch counts correctly
6. **Sync failure**: Offline data not syncing to backend when online

---

## Testing Environment

- **Device 1**: Physical Android phone (Android 10+)
- **Device 2**: Physical Android phone (Android 8.0 - minimum supported)
- **Device 3** (optional): Android tablet
- **Network**: Test with WiFi, 4G, and offline mode
- **Backend**: Use staging/test backend (not production)

---

## Test Users

Create these test accounts for comprehensive testing:

| Email | Password | Organization | Role | Purpose |
|-------|----------|--------------|------|---------|
| org1-admin@test.com | Test1234! | Org A | admin | Test admin features for Org A |
| org1-user@test.com | Test1234! | Org A | user | Test regular user for Org A |
| org2-admin@test.com | Test1234! | Org B | admin | Test multi-tenant isolation |
| org2-user@test.com | Test1234! | Org B | user | Test cross-org access prevention |

---

## Completion Checklist

After completing all tests above:

- [ ] All critical issues are resolved
- [ ] No data leaks between organizations
- [ ] App works smoothly in offline mode
- [ ] Dashboard data is accurate and real-time
- [ ] Mortality monitoring alerts work correctly
- [ ] Sentry is capturing errors in production build
- [ ] App is ready for alpha/beta testing with real users

---

## Next Steps After Testing

1. Fix any bugs found during testing
2. Re-test fixed issues
3. Build production APK
4. Deploy to Google Play Console (closed alpha track)
5. Invite 5-10 beta testers
6. Monitor Sentry for crash reports
7. Gather user feedback
8. Iterate and improve

---

**Good luck with testing! 🎉**
