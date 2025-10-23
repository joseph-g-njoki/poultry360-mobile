# Sentry Error Tracking Setup Guide

## What is Sentry?

Sentry is a crash reporting and error tracking service that helps you:
- Get notified when your app crashes in production
- See detailed error logs with stack traces
- Track user sessions and breadcrumbs (what users were doing before the crash)
- Monitor app performance
- Fix bugs before users report them

**Free tier**: 5,000 errors/month (more than enough for most apps)

---

## Setup Steps (5 minutes)

### Step 1: Create Sentry Account

1. Go to **https://sentry.io**
2. Click "Get Started" (free tier, no credit card needed)
3. Sign up with GitHub or email

### Step 2: Create a New Project

1. After signing in, click "Create Project"
2. Select platform: **React Native**
3. Set Alert frequency: **Alert me on every new issue** (recommended for start)
4. Project name: **poultry360-mobile** (or whatever you prefer)
5. Team: Default team is fine
6. Click "Create Project"

### Step 3: Copy Your DSN

After creating the project, you'll see a setup page with your DSN (Data Source Name).

It looks like this:
```
https://abc123def456@o1234567.ingest.sentry.io/9876543
```

**Copy this entire URL!**

### Step 4: Add DSN to Your App

1. Open your `.env` file in the mobile app root folder:
   ```
   C:\Users\josep\OneDrive\Desktop\poultry360-app\mobile\poultry360-mobile\.env
   ```

2. Find this line:
   ```
   EXPO_PUBLIC_SENTRY_DSN=
   ```

3. Paste your DSN after the `=`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://abc123def456@o1234567.ingest.sentry.io/9876543
   ```

4. Save the file

### Step 5: Restart Expo

```bash
# Stop Expo (Ctrl+C in the terminal)
# Then restart with cache clear:
npx expo start -c
```

---

## Verifying Setup

### Test in Development

1. Open your app
2. Check the console/terminal for:
   ```
   ✅ Sentry initialized successfully
   ```

3. **Note**: In development mode (`__DEV__ = true`), errors are logged but NOT sent to Sentry.
   This is intentional to avoid cluttering your Sentry dashboard during development.

### Test in Production Build

When you build your APK for production, Sentry will automatically send errors.

To test it:
1. Build a production APK
2. Install on a test device
3. Trigger an error (or wait for a real crash)
4. Check your Sentry dashboard at https://sentry.io

---

## How It Works

### Automatic Error Capture

Sentry automatically captures:
- **Unhandled JavaScript exceptions** (app crashes)
- **Promise rejections** (async errors)
- **Console errors** (console.error calls)
- **Network errors** (failed API calls)

### Error Boundary

The app now includes an `ErrorBoundary` component that:
- Catches React component errors
- Sends error to Sentry with component stack trace
- Shows user-friendly error screen
- Allows user to retry without restarting app

### Manual Error Reporting

You can manually report errors in your code:

```javascript
import { captureException, captureMessage, addBreadcrumb } from '../sentry.config';

// Capture an exception
try {
  // risky operation
} catch (error) {
  captureException(error, {
    extra: {
      batchId: 123,
      operationType: 'mortality_record_creation'
    }
  });
}

// Capture a message (non-error event)
captureMessage('User completed onboarding', 'info');

// Add breadcrumb (user action tracking)
addBreadcrumb(
  'User created mortality record',
  'user_action',
  'info',
  { batchId: 123, deaths: 5 }
);
```

---

## Viewing Errors in Sentry Dashboard

### Dashboard Overview
https://sentry.io/organizations/YOUR_ORG/issues/

You'll see:
- List of all errors/crashes
- How many times each error occurred
- Which users were affected
- When it last happened

### Error Details

Click on any error to see:
- **Stack trace**: Exact line of code that caused the error
- **Breadcrumbs**: What the user did before the crash
- **Device info**: OS version, device model, app version
- **User info**: User ID, email, organization
- **Tags**: Environment (production/development)

### Email Alerts

Sentry will email you when:
- A new error occurs
- An error happens frequently
- An error affects many users

You can configure alert rules in Project Settings → Alerts.

---

## Best Practices

### 1. Set User Context After Login

Already implemented in your `AuthContext.js`. When user logs in, we call:
```javascript
setUser({
  id: user.id,
  email: user.email,
  organizationId: user.organizationId
});
```

This helps you know which users are affected by each error.

### 2. Add Context to Errors

When manually capturing exceptions, add context:
```javascript
captureException(error, {
  extra: {
    batchId: batch.id,
    farmId: farm.id,
    recordType: 'mortality',
    timestamp: new Date().toISOString()
  }
});
```

### 3. Monitor Performance

Sentry also tracks performance:
- Slow API calls
- Slow screen renders
- Database query times

Enable in Sentry dashboard: Performance → Settings

### 4. Create Releases

When you build a new version, create a release in Sentry:
```bash
sentry-cli releases new 1.0.0
sentry-cli releases set-commits 1.0.0 --auto
```

This helps track which app version has which bugs.

---

## Troubleshooting

### "Sentry DSN not configured" Warning

**Cause**: DSN not set in `.env` file

**Fix**: Follow Step 4 above to add your DSN

### Errors Not Appearing in Sentry

**Possible causes**:
1. **Development mode**: Errors are not sent in `__DEV__` mode
   - **Fix**: Build production APK to test

2. **Wrong DSN**: DSN is incorrect or missing
   - **Fix**: Double-check DSN in `.env` matches Sentry dashboard

3. **Network issues**: Device can't reach Sentry servers
   - **Fix**: Check internet connection

4. **Sentry quota exceeded**: Free tier limit reached
   - **Fix**: Upgrade plan or wait for quota reset

### Source Maps Not Working

If you see minified stack traces instead of readable code:

1. Run this after building:
   ```bash
   npx sentry-expo-upload-sourcemaps dist
   ```

2. Or enable automatic upload in `app.json`:
   ```json
   {
     "hooks": {
       "postPublish": [
         {
           "file": "sentry-expo/upload-sourcemaps",
           "config": {
             "organization": "YOUR_ORG",
             "project": "poultry360-mobile"
           }
         }
       ]
     }
   }
   ```

---

## Cost

**Free tier**: Perfect for starting out
- 5,000 errors/month
- 10,000 performance units/month
- 30 days data retention
- Unlimited team members

**Paid tiers**: Only needed if you exceed free limits
- Team: $29/month (50,000 errors)
- Business: $99/month (250,000 errors)

---

## Support

- **Sentry Docs**: https://docs.sentry.io/platforms/react-native/
- **Discord Community**: https://discord.gg/sentry
- **GitHub Issues**: https://github.com/getsentry/sentry-react-native

---

## Next Steps

After setup:
1. ✅ Build a test APK
2. ✅ Trigger a test error
3. ✅ Verify it appears in Sentry dashboard
4. ✅ Configure email alert preferences
5. ✅ Add team members (optional)

You're now protected against silent production crashes! 🎉
