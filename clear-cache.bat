@echo off
echo ============================================
echo  Clearing ALL React Native / Expo Caches
echo ============================================
echo.

cd /d "%~dp0"

echo [1/6] Stopping Node processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo   - Node processes stopped
) else (
    echo   - No Node processes running
)
echo.

echo [2/6] Clearing Expo cache (.expo folder)...
if exist ".expo\" (
    rd /s /q .expo 2>nul
    echo   - .expo folder deleted
) else (
    echo   - .expo folder not found
)
echo.

echo [3/6] Clearing Node modules cache...
if exist "node_modules\.cache\" (
    rd /s /q node_modules\.cache 2>nul
    echo   - node_modules\.cache deleted
) else (
    echo   - node_modules\.cache not found
)
echo.

echo [4/6] Clearing Metro bundler cache...
rd /s /q %TEMP%\metro-* 2>nul
rd /s /q %TEMP%\haste-map-* 2>nul
echo   - Metro cache cleared from temp
echo.

echo [5/6] Clearing React Native cache...
rd /s /q %TEMP%\react-* 2>nul
echo   - React Native cache cleared from temp
echo.

echo [6/6] Clearing Watchman cache (if installed)...
watchman watch-del-all 2>nul
if %errorlevel% equ 0 (
    echo   - Watchman cache cleared
) else (
    echo   - Watchman not installed or not running
)
echo.

echo ============================================
echo  Cache Cleared Successfully!
echo ============================================
echo.
echo Starting Expo with clean cache...
echo.

npx expo start -c
