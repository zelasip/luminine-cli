#!/bin/bash
# Luminine CLI - Termux Installation Script
# Works on Android via Termux

echo "============================================"
echo "  Luminine CLI - Termux Installer"
echo "============================================"
echo ""

# Check Termux
if [ -z "$TERMUX_VERSION" ] && [ ! -d "/data/data/com.termux" ]; then
    echo "[!!] This script is designed for Termux on Android."
    echo "[!!] Install Termux from F-Droid or GitHub."
    exit 1
fi

# Update packages
echo "[1/5] Updating Termux packages..."
pkg update -y 2>/dev/null

# Install Node.js
echo "[2/5] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "[!] Node.js not found. Installing..."
    pkg install -y nodejs 2>/dev/null
    echo "[OK] Node.js installed."
else
    echo "[OK] Node.js already installed."
fi

# Install npm
echo "[3/5] Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "[!] npm not found. Installing..."
    pkg install -y npm 2>/dev/null
    echo "[OK] npm installed."
else
    echo "[OK] npm already installed."
fi

# Install git
echo "[4/5] Checking git..."
if ! command -v git &> /dev/null; then
    pkg install -y git 2>/dev/null
fi

# Install dependencies and build
echo "[5/5] Installing Luminine CLI..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
npm install 2>/dev/null
npm run build 2>/dev/null

# Add to PATH
echo ""
echo "[+] Adding luminine to PATH..."
mkdir -p ~/.local/bin
ln -sf "$SCRIPT_DIR/dist/index.js" ~/.local/bin/luminine
chmod +x ~/.local/bin/luminine

# Check if PATH includes ~/.local/bin
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
    export PATH="$HOME/.local/bin:$PATH"
fi

echo ""
echo "============================================"
echo "  Luminine CLI installed on Termux!"
echo "  Run: luminine"
echo "  Or:  node $SCRIPT_DIR/dist/index.js"
echo "============================================"
