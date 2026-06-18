@echo off
chcp 65001 >nul 2>&1
title Luminine CLI - Cleanup
set /p confirm="Delete all build files? (Y/N): "
if /i not "%confirm%"=="Y" (echo Cancelled. & pause & exit /b)
cd "%~dp0"
if exist "node_modules" rd /s /q "node_modules" 2>nul
if exist "dist" rd /s /q "dist" 2>nul
npm cache clean --force 2>nul
echo Cleanup done!
pause
