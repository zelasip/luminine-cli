@echo off
chcp 65001 >nul 2>&1
title Luminine CLI - Launch
echo ============================================
echo   Luminine CLI - Starting...
echo ============================================
echo.

cd "%~dp0"
if exist "dist\index.js" (
    node dist\index.js
) else (
    echo [!] Build not found. Running npm build first...
    npm run build 2>nul
    node dist\index.js
)
