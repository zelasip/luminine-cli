#!/bin/bash
set -e

echo "============================================"
echo "  Luminine CLI - Silent Dependency Installer"
echo "============================================"
echo ""

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

echo "[1/3] Checking Node.js..."
if ! command -v node &> /dev/null; then
    warn "Node.js not found. Installing..."
    if command -v snap &> /dev/null; then
        sudo snap install node --classic 2>/dev/null || {
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null
            sudo apt-get install -y -qq nodejs 2>/dev/null
        }
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null
        sudo apt-get install -y -qq nodejs 2>/dev/null
    fi
    ok "Node.js installed."
else
    ok "Node.js already installed."
fi

echo "[2/3] Installing dependencies..."
cd "$(dirname "$0")"
npm install 2>/dev/null

echo "[3/3] Building project..."
npm run build 2>/dev/null
npm link 2>/dev/null

echo ""
echo "============================================"
echo "  Luminine CLI installed successfully!"
echo "  Run: luminine"
echo "============================================"
