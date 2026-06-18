#!/bin/bash
set -e
echo "Luminine CLI - Automatic Setup"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node &> /dev/null; then
    echo "[!] Installing Node.js..."
    if command -v pkg &> /dev/null; then
        pkg install -y nodejs 2>/dev/null
    elif command -v snap &> /dev/null; then
        sudo snap install node --classic 2>/dev/null
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null
        sudo apt-get install -y -qq nodejs 2>/dev/null
    fi
fi

echo "Installing dependencies..."
cd "$PROJECT_DIR"
npm install 2>/dev/null
npm run build 2>/dev/null

echo ""
echo "Build complete! Run ./open_game.sh"
