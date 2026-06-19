#!/bin/bash
set -e
echo "============================================"
echo "  Luminine CLI - Linux Installer"
echo "============================================"
echo ""

REPO="https://github.com/zelasip/luminine-cli.git"
DIR="$HOME/.luminine-cli"

echo "[1/4] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "[!] Node.js not found. Installing..."
    if command -v pkg &> /dev/null; then
        pkg install -y nodejs
    elif command -v snap &> /dev/null; then
        sudo snap install node --classic
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y -qq nodejs
    fi
    echo "[OK] Node.js installed."
else
    echo "[OK] Node.js already installed."
fi

echo "[2/4] Cloning repository..."
if [ -d "$DIR" ]; then
    cd "$DIR"
    git pull
else
    git clone "$REPO" "$DIR"
    cd "$DIR"
fi

echo "[3/4] Installing dependencies..."
npm install

echo "[4/4] Building..."
npm run build
npm link

echo ""
echo "============================================"
echo "  Installation complete!"
echo "  Run: luminine"
echo "============================================"
