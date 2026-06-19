#!/bin/bash
set -e
echo "============================================"
echo "  Luminine CLI - Termux Installer"
echo "============================================"
echo ""

REPO="https://github.com/zelasip/luminine-cli.git"
DIR="$HOME/.luminine-cli"

echo "[1/4] Installing Termux dependencies..."
pkg update -y
pkg install -y nodejs git

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
