@echo off
chcp 65001 >nul 2>&1
title Luminine CLI - Windows Installer
echo ============================================
echo   Luminine CLI - Windows Installer
echo ============================================
echo.

set "REPO=https://github.com/zelasip/luminine-cli.git"
set "DIR=%USERPROFILE%\.luminine-cli"

echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js not found. Installing...
    winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements 2>nul
    if %errorlevel% neq 0 (
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.15.0/node-v20.15.0-x64.msi' -OutFile '$env:TEMP\node.msi'" 2>nul
        msiexec /i "%TEMP%\node.msi" /quiet /norestart 2>nul
        set "PATH=%PATH%;%ProgramFiles%\nodejs"
    )
    echo [OK] Node.js installed.
) else (
    echo [OK] Node.js already installed.
)

echo [2/4] Cloning repository...
if exist "%DIR%" (
    cd "%DIR%"
    git pull
) else (
    git clone "%REPO%" "%DIR%"
    cd "%DIR%"
)

echo [3/4] Installing dependencies...
call npm install

echo [4/4] Building...
call npm run build
call npm link

echo.
echo ============================================
echo   Installation complete!
echo   Run: luminine
echo ============================================
pause
