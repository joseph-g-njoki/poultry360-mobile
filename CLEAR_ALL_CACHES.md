# Complete Cache Clearing Guide for React Native / Expo

## The Problem
React Native and Expo use multiple layers of caching. When you fix code but still see old errors, it's because cached JavaScript bundles are being served instead of your new code.

## Complete Cache Clearing Steps

### Method 1: Nuclear Option (Clears Everything)

```bash
# Stop Metro bundler if running (Ctrl+C in the terminal)

# Navigate to project directory
cd C:\Users\josep\OneDrive\Desktop\poultry360-app\mobile\poultry360-mobile

# Clear Expo cache
npx expo start -c

# OR if that doesn't work, manually clear:
rd /s /q .expo
rd /s /q node_modules\.cache

# Clear Metro bundler cache
rd /s /q %TEMP%\metro-*
rd /s /q %TEMP%\haste-map-*

# Clear React Native cache
rd /s /q %TEMP%\react-native-*

# Clear Watchman cache (if installed)
watchman watch-del-all

# Restart with clean cache
npx expo start -c
```

### Method 2: Step-by-Step (Recommended)

1. **Stop all running processes**
   - Stop the Expo development server (Ctrl+C)
   - Close Expo Go app completely on your device/emulator
   - Close the terminal

2. **Clear project caches**
   ```bash
   cd C:\Users\josep\OneDrive\Desktop\poultry360-app\mobile\poultry360-mobile
   rd /s /q .expo
   rd /s /q node_modules\.cache
   ```

3. **Clear system temp caches**
   ```bash
   rd /s /q %TEMP%\metro-*
   rd /s /q %TEMP%\haste-map-*
   rd /s /q %TEMP%\react-*
   ```

4. **Force app reload on device**
   - Open Expo Go app
   - Shake device (or press Ctrl+M on Android emulator / Cmd+D on iOS simulator)
   - Press "Reload"
   - Then press "Clear cache and restart"

5. **Start fresh development server**
   ```bash
   npx expo start -c
   ```

### Method 3: Full Reset (When Nothing Else Works)

```bash
cd C:\Users\josep\OneDrive\Desktop\poultry360-app\mobile\poultry360-mobile

# Stop everything
taskkill /F /IM node.exe

# Delete all caches and dependencies
rd /s /q node_modules
rd /s /q .expo
rd /s /q %TEMP%\metro-*
rd /s /q %TEMP%\haste-map-*
rd /s /q %TEMP%\react-*
rd /s /q %APPDATA%\Expo

# Reinstall dependencies
npm install

# Start with clean slate
npx expo start -c
```

## On Your Device/Emulator

### Android (Physical Device or Emulator)
1. Open Expo Go
2. Shake the device OR press Ctrl+M in emulator
3. Select "Reload"
4. If error persists:
   - Press Ctrl+M again
   - Select "Debug"
   - Then "Disable Fast Refresh"
   - Reload again

### iOS (Physical Device or Simulator)
1. Open Expo Go
2. Shake the device OR press Cmd+D in simulator
3. Select "Reload"
4. If error persists:
   - Press Cmd+D again
   - Select "Toggle Element Inspector" (off if on)
   - Reload again

## Verification After Clearing Cache

1. Check the Metro bundler terminal output - it should say:
   ```
   Starting Metro Bundler
   Clearing Metro Bundler cache
   ```

2. Check your device/emulator - you should see:
   ```
   Downloading JavaScript bundle: 100.00%
   ```

3. If you see "Fast Refresh" warming or "Cached bundle", the cache is NOT cleared

## Why This Happens

- **Metro Bundler**: Caches JavaScript bundles in temp directories
- **Expo**: Caches compiled assets and transformations in `.expo` folder
- **Device/Emulator**: Keeps old bundles in memory until forced reload
- **Node Modules**: Sometimes cached transforms in `node_modules/.cache`

## Quick Command (Save This!)

Create a file `clear-cache.bat` in your project root:

```bat
@echo off
echo Clearing ALL React Native / Expo caches...
cd C:\Users\josep\OneDrive\Desktop\poultry360-app\mobile\poultry360-mobile
taskkill /F /IM node.exe 2>nul
rd /s /q .expo 2>nul
rd /s /q node_modules\.cache 2>nul
rd /s /q %TEMP%\metro-* 2>nul
rd /s /q %TEMP%\haste-map-* 2>nul
rd /s /q %TEMP%\react-* 2>nul
echo Cache cleared! Starting fresh...
npx expo start -c
```

Then just double-click `clear-cache.bat` whenever you need to clear everything.
