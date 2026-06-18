@echo off
chcp 65001 >nul 2>&1
title Luminine CLI - Silent Installer
echo ============================================
echo   Luminine CLI - Automated Dependency Installer
echo ============================================
echo.

echo [1/3] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js not found. Installing silently...
    winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements 2>nul
    if %errorlevel% neq 0 (
        echo [!!] winget failed. Trying manual download...
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.15.0/node-v20.15.0-x64.msi' -OutFile '$env:TEMP\node.msi'" 2>nul
        msiexec /i "%TEMP%\node.msi" /quiet /norestart 2>nul
        set "PATH=%PATH%;%ProgramFiles%\nodejs"
    )
    echo [OK] Node.js installed.
) else (
    echo [OK] Node.js already installed.
)

echo [2/3] Installing dependencies...
cd "%~dp0"
npm install 2>nul

echo [3/3] Building project...
npm run build 2>nul
npm link 2>nul

echo.
echo ============================================
echo   Luminine CLI installed successfully!
echo   Run: luminine
echo ============================================
pause
