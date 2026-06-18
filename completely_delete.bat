@echo off
chcp 65001 >nul 2>&1
title Luminine CLI - Cleanup
echo ============================================
echo   Luminine CLI - Complete Cleanup
echo ============================================
echo.
echo This will remove node_modules, dist, and caches.
echo.

set /p confirm="Are you sure? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Cancelled.
    pause
    exit /b
)

cd "%~dp0"

echo [1/4] Cleaning node_modules...
if exist "node_modules" rd /s /q "node_modules" 2>nul

echo [2/4] Cleaning dist...
if exist "dist" rd /s /q "dist" 2>nul

echo [3/4] Cleaning npm cache...
npm cache clean --force 2>nul

echo [4/4] Cleaning logs...
del /q /s "*.log" 2>nul
del /q /s "package-lock.json" 2>nul

echo.
echo ============================================
echo   Cleanup complete!
echo ============================================
pause
