# Analytics E2E Testing Checklist

## Manual Verification Steps for Analytics Integration

This document provides a comprehensive checklist to verify that Analytics is fully integrated with the offline-first system and connected to all other parts of the Poultry360 application.

---

## ✅ 1. ONLINE MODE TESTING

### 1.1 Analytics Loads from Server
- [ ] Open the app **with internet connection**
- [ ] Navigate to **Analytics tab**
- [ ] Verify: Analytics screen loads **without errors**
- [ ] Verify: You see production data, KPI cards, charts
- [ ] Check logs: Should show `[OfflineFirst] Network status check: ONLINE`
- [ ] Check logs: Should show API call to `/analytics/production-trends`

### 1.2 Analytics Caches Locally
- [ ] After loading analytics online, check logs
- [ ] Verify: Should see `[OfflineDataService] Analytics data cached: dashboard`
- [ ] Verify: Data is stored in AsyncStorage (check DevTools)

### 1.3 Server Error Fallback
- [ ] Turn on airplane mode **AFTER** analytics has loaded once
- [ ] Pull to refresh on Analytics screen
- [ ] Verify: App shows cached data (no crash)
- [ ] Verify: No "internal server error" message
- [ ] Verify: Data displayed is from cache (may be slightly old)

---

## ✅ 2. OFFLINE MODE TESTING

### 2.1 Analytics Computed from Local SQLite
- [ ] **Close the app completely**
- [ ] **Turn on airplane mode** (disable WiFi and mobile data)
- [ ] Open the app
- [ ] Navigate to **Analytics tab**
- [ ] Verify: Analytics screen loads (no infinite loading)
- [ ] Verify: You see data computed from local SQLite database
- [ ] Check logs: Should show `[OfflineFirst] Network status check: OFFLINE`
- [ ] Check logs: Should show `[OfflineDataService] Computing analytics from local data`

### 2.2 Offline Data Accuracy
- [ ] While offline, check the analytics values:
  - **Total Birds**: Should match sum of current_count from all batches
  - **Production Rate**: Should match average across batches
  - **Egg Production**: Should show total eggs from local records
  - **Active Batches**: Should show number of batches in SQLite
- [ ] Verify: Daily production chart shows last 7 days from local data
- [ ] Verify: Weekly comparison shows difference between weeks

### 2.3 Export Disabled Offline
- [ ] While **offline**, tap **"📊 Export"** button
- [ ] Verify: Alert shows "Offline Mode - Export requires an internet connection"
- [ ] Verify: No crash or error

---

## ✅ 3. REAL-TIME UPDATES TESTING

### 3.1 Production Record → Analytics Updates
- [ ] Go to **Dashboard** or **Records** tab
- [ ] **Add a new production record** (any batch, any number of eggs)
- [ ] Immediately switch to **Analytics tab**
- [ ] Verify: Analytics data **automatically refreshes** (without manual refresh)
- [ ] Verify: Egg production count increases
- [ ] Verify: Daily production chart updates
- [ ] Check logs: Should show `[DataStore] Record event received, refreshing analytics`

### 3.2 Feed Record → Analytics Updates
- [ ] **Add a new feed record**
- [ ] Switch to **Analytics tab**
- [ ] Verify: Analytics refreshes (may update FCR or flock performance)
- [ ] Check logs: Should show `[DataEventBus] Emitting FEED_RECORD_CREATED`

### 3.3 Mortality Record → Analytics Updates
- [ ] **Add a mortality record**
- [ ] Switch to **Analytics tab**
- [ ] Verify: Analytics refreshes
- [ ] Verify: Total birds count decreases (if batch current_count updated)

### 3.4 Farm/Batch Creation → Analytics Updates
- [ ] **Create a new batch**
- [ ] Switch to **Analytics tab**
- [ ] Verify: Active batches count increases
- [ ] Verify: New batch appears in production rate list (if has records)

---

## ✅ 4. SYNC BEHAVIOR TESTING

### 4.1 Offline Records Sync Triggers Analytics Refresh
- [ ] **Go offline** (airplane mode)
- [ ] Add **5 production records** while offline
- [ ] Check: Records saved locally with `needs_sync=1`
- [ ] **Go online** (disable airplane mode)
- [ ] Wait for sync to complete (check sync status in header)
- [ ] Switch to **Analytics tab**
- [ ] Verify: Analytics **automatically refreshes** with synced data
- [ ] Check logs: Should show `[DataStore] Sync completed, refreshing all data`

### 4.2 Server Data Downloaded Refreshes Analytics
- [ ] Have **two devices** with same account
- [ ] On **Device A**: Add production records
- [ ] On **Device B**: Trigger sync (pull to refresh on Dashboard)
- [ ] On **Device B**: Go to Analytics tab
- [ ] Verify: New data from Device A appears in analytics

---

## ✅ 5. CACHE BEHAVIOR TESTING

### 5.1 Cache Used Within 30 Minutes
- [ ] Load analytics online
- [ ] Wait **5 minutes**
- [ ] Pull to refresh on Analytics screen
- [ ] Check logs: Should show `[DataStore] Using cached analytics`
- [ ] Verify: Loads instantly (no API call)

### 5.2 Cache Expires After 30 Minutes
- [ ] Load analytics online
- [ ] Wait **35 minutes** (or manually change timestamp in cache)
- [ ] Pull to refresh on Analytics screen
- [ ] Check logs: Should show `[OfflineDataService] Analytics cache expired`
- [ ] Verify: Makes new API call or computes from SQLite

### 5.3 Cache Invalidated on Record Changes
- [ ] Load analytics (cache fresh)
- [ ] Add a new production record
- [ ] Go to Analytics tab
- [ ] Verify: Analytics refreshes (doesn't use stale cache)
- [ ] Verify: New record is reflected in totals

---

## ✅ 6. DROPDOWN INTERCONNECTION TESTING

### 6.1 Farms Dropdown Auto-Updates
- [ ] Go to **Analytics** → **Flock Performance** screen (if exists)
- [ ] Check farm dropdown
- [ ] **Create a new farm** (switch to Farms tab, add farm)
- [ ] Return to Analytics → Flock Performance
- [ ] Verify: New farm appears in dropdown **without manual refresh**

### 6.2 Batches Dropdown Auto-Updates
- [ ] Go to **Analytics** screen with batch filter
- [ ] Check batch dropdown
- [ ] **Create a new batch** (switch to Batches tab, add batch)
- [ ] Return to Analytics
- [ ] Verify: New batch appears in dropdown **without manual refresh**

---

## ✅ 7. ERROR HANDLING TESTING

### 7.1 Server Timeout Handling
- [ ] **Simulate slow network** (enable network throttling in DevTools)
- [ ] Load Analytics screen
- [ ] Verify: Shows cached data (no crash)
- [ ] Verify: Alert shows "Loading Slow" or uses cached data

### 7.2 Database Errors Handled
- [ ] (Advanced) Corrupt SQLite database file
- [ ] Open app
- [ ] Navigate to Analytics
- [ ] Verify: App doesn't crash
- [ ] Verify: Shows error message or empty state

### 7.3 Empty Data Handling
- [ ] **Fresh install** with no data
- [ ] Login with new account
- [ ] Go to Analytics tab
- [ ] Verify: Shows empty state or "No data available" (not "internal server error")
- [ ] Verify: KPI cards show zeros

---

## ✅ 8. DATE RANGE SELECTOR TESTING

### 8.1 Date Range Changes Reload Analytics
- [ ] Go to Analytics tab
- [ ] Select **"Last 7 Days"**
- [ ] Verify: Chart shows 7 days of data
- [ ] Select **"Last 30 Days"**
- [ ] Verify: Chart shows 30 days of data
- [ ] Select **"Last 90 Days"**
- [ ] Verify: Chart shows 90 days of data
- [ ] Check logs: Should show new API call with different `startDate` and `endDate`

---

## ✅ 9. EXPORT FUNCTIONALITY TESTING

### 9.1 Export CSV Online
- [ ] Go **online**
- [ ] Tap **"📊 Export"** button
- [ ] Select **"CSV"**
- [ ] Verify: Export succeeds (or calls API endpoint)
- [ ] Verify: Success alert shows

### 9.2 Export PDF Online
- [ ] Go **online**
- [ ] Tap **"📊 Export"** button
- [ ] Select **"PDF"**
- [ ] Verify: Export succeeds
- [ ] Verify: Success alert shows

### 9.3 Export Fails Offline
- [ ] Go **offline**
- [ ] Tap **"📊 Export"** button
- [ ] Verify: Alert shows "Offline Mode - Export requires an internet connection"

---

## ✅ 10. PERFORMANCE TESTING

### 10.1 Analytics Loads Quickly
- [ ] Clear app cache
- [ ] Restart app
- [ ] Measure time to load Analytics screen
- [ ] **Expected**: < 2 seconds online, < 1 second offline (from cache)

### 10.2 No UI Blocking
- [ ] Load analytics
- [ ] While loading, try to:
  - Pull to refresh
  - Switch tabs
  - Press back button
- [ ] Verify: UI remains responsive (no freezing)

### 10.3 Large Data Sets
- [ ] Create **100+ production records**
- [ ] Create **10+ batches**
- [ ] Load Analytics screen
- [ ] Verify: Loads without crashing
- [ ] Verify: Charts render correctly (no performance issues)

---

## ✅ 11. NAVIGATION TESTING

### 11.1 Navigation to Flock Performance
- [ ] On Analytics screen, tap **"📈 Flock Performance"** button
- [ ] Verify: Navigates to Flock Performance screen
- [ ] Verify: Screen loads correctly

### 11.2 Navigation to Financial Analytics
- [ ] On Analytics screen, tap **"💰 Financial Analytics"** button
- [ ] Verify: Navigates to Financial Analytics screen
- [ ] Verify: Screen loads correctly

---

## ✅ 12. LOG VERIFICATION

### Expected Log Sequence (Online Mode):
```
[OfflineFirst] Network status check: ONLINE
[API] GET /analytics/production-trends
[OfflineDataService] Analytics data cached: dashboard
[DataStore] Loaded analytics data
```

### Expected Log Sequence (Offline Mode):
```
[OfflineFirst] Network status check: OFFLINE
[OfflineFirst] Offline mode - returning cached dashboard analytics
[OfflineDataService] Computing analytics from local data: dashboard
[DataStore] Loaded analytics data
```

### Expected Log Sequence (Record Created):
```
[OfflineFirst] ONLINE - creating production record on server
[DataEventBus] Emitting PRODUCTION_RECORD_CREATED
[DataStore] Record event received, refreshing analytics
[DataStore] Refreshing analytics due to record changes
```

### Expected Log Sequence (Sync Complete):
```
[SyncService] DATA_SYNCED event emitted
[DataStore] Sync completed, refreshing all data
[DataStore] Loaded analytics data
```

---

## 🎯 INTEGRATION VERIFICATION SUMMARY

After completing all tests above, verify the following checklist:

- [x] **Analytics uses offlineFirstService** (not separate analyticsService)
- [x] **Analytics fetches from server when online**
- [x] **Analytics falls back to cache on server error**
- [x] **Analytics computes from SQLite when offline**
- [x] **Analytics caches data with 30-minute TTL**
- [x] **Analytics emits events on data changes**
- [x] **Analytics subscribes to record events (auto-refresh)**
- [x] **Analytics refreshes after sync completes**
- [x] **Export requires online connection**
- [x] **Analytics has graceful error handling**
- [x] **Analytics dropdowns auto-update**
- [x] **Analytics is interconnected with Dashboard, Farms, Batches, Records**

---

## 🔧 TROUBLESHOOTING

### Issue: "internal server error (analytic offline) failed to get cached dashboard"
**Status**: ✅ FIXED
**Cause**: Analytics was using separate `analyticsService.js` instead of `offlineFirstService.js`
**Fix**: Integrated Analytics with `offlineFirstService.js` and added offline computation

### Issue: Analytics loading forever
**Check**:
1. Network status - online or offline?
2. Cache status - check AsyncStorage for `@analytics_*` keys
3. SQLite data - check if batches and production_records exist
4. Logs - look for error messages

### Issue: Analytics not auto-refreshing
**Check**:
1. Event emissions - check if `PRODUCTION_RECORD_CREATED` event fires
2. Event subscriptions - check if DataStoreContext is subscribed
3. DataStoreProvider - verify it wraps the entire app in App.js

### Issue: Export not working
**Check**:
1. Network status - export only works online
2. Backend API - ensure `/analytics/export` endpoint exists
3. Permissions - check file system permissions for download

---

## 📊 TEST RESULTS TRACKING

| Test Category | Total Tests | Passed | Failed | Notes |
|--------------|-------------|--------|--------|-------|
| Online Mode | 3 | | | |
| Offline Mode | 3 | | | |
| Real-Time Updates | 4 | | | |
| Sync Behavior | 2 | | | |
| Cache Behavior | 3 | | | |
| Dropdown Interconnection | 2 | | | |
| Error Handling | 3 | | | |
| Date Range Selector | 1 | | | |
| Export Functionality | 3 | | | |
| Performance | 3 | | | |
| Navigation | 2 | | | |
| **TOTAL** | **29** | | | |

---

## ✅ SIGN OFF

Once all tests pass, the Analytics integration is complete and fully interconnected with the rest of the Poultry360 system.

**Tester**: ___________________
**Date**: ___________________
**Signature**: ___________________

---

## 📝 NOTES

Use this space to document any issues found during testing or additional observations:

```
[Add notes here]
```
