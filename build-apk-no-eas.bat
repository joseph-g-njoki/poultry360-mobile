@echo off
echo ============================================
echo Poultry360 APK Build Script (No EAS)
echo ============================================
echo.

REM Enable long path support (run as admin if this fails)
reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f 2>nul

REM Set Java and Android paths
set JAVA_HOME=C:\Users\josep\OneDrive\Desktop\poultry360-app\jdk-17.0.2
set ANDROID_HOME=C:\Users\josep\OneDrive\Desktop\poultry360-app\android-sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%

echo Checking Java installation...
"%JAVA_HOME%\bin\java.exe" -version
if errorlevel 1 (
    echo ERROR: Java not found!
    pause
    exit /b 1
)

echo.
echo Navigating to Android directory...
cd /d "%~dp0android"

echo.
echo Cleaning previous build...
call gradlew.bat clean --no-daemon

echo.
echo Building APK (this may take 10-15 minutes)...
call gradlew.bat assembleRelease --no-daemon --warning-mode all

echo.
if exist "app\build\outputs\apk\release\app-release.apk" (
    echo ============================================
    echo SUCCESS! APK Built Successfully!
    echo ============================================
    echo.
    echo APK Location:
    echo %~dp0android\app\build\outputs\apk\release\app-release.apk
    echo.
    echo File size:
    dir "app\build\outputs\apk\release\app-release.apk"
) else (
    echo ============================================
    echo ERROR: Build failed!
    echo ============================================
    echo Check the error messages above.
)

echo.
pause
