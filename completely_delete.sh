#!/bin/bash
set -e

echo "============================================"
echo "  Luminine CLI - Complete Cleanup"
echo "============================================"
echo ""
echo "This will remove node_modules, dist, and caches."
echo ""

read -p "Are you sure? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/4] Cleaning node_modules..."
rm -rf node_modules 2>/dev/null

echo "[2/4] Cleaning dist..."
rm -rf dist 2>/dev/null

echo "[3/4] Cleaning npm cache..."
npm cache clean --force 2>/dev/null

echo "[4/4] Cleaning logs..."
find . -name "*.log" -delete 2>/dev/null
rm -f package-lock.json 2>/dev/null

echo ""
echo "============================================"
echo "  Cleanup complete!"
echo "============================================"
