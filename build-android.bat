@echo off
echo ==========================================================
echo    ITAMYA - Construction Application Android (APK / AAB)
echo ==========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\build-android.ps1"
pause
