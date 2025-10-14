@echo off
echo Building APK for Poultry360...
echo.

set JAVA_HOME=C:\Users\josep\OneDrive\Desktop\poultry360-app\jdk-17.0.2
set ANDROID_HOME=C:\Users\josep\OneDrive\Desktop\poultry360-app\android-sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%PATH%

cd /d "%~dp0android"

echo Cleaning previous builds...
call gradlew.bat clean

echo.
echo Building release APK...
call gradlew.bat assembleRelease

echo.
if exist "app\build\outputs\apk\release\app-release.apk" (
    echo.
    echo ============================================
    echo SUCCESS! APK built successfully!
    echo ============================================
    echo.
    echo APK location:
    echo %~dp0android\app\build\outputs\apk\release\app-release.apk
    echo.
) else (
    echo.
    echo ============================================
    echo ERROR: APK not found!
    echo ============================================
    echo.
)

pause
