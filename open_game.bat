@echo off
chcp 65001 >nul 2>&1
title Luminine CLI - Launch
cd "%~dp0"
if exist "dist\index.js" (
    node dist\index.js
) else (
    echo [!!] Build not found. Run install.bat first!
    pause
    exit /b
)
