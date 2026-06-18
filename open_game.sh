#!/bin/bash
set -e

echo "============================================"
echo "  Luminine CLI - Launching..."
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$SCRIPT_DIR/dist/index.js" ]; then
    node "$SCRIPT_DIR/dist/index.js"
else
    echo "[!] Build not found. Running npm build first..."
    cd "$SCRIPT_DIR"
    npm run build 2>/dev/null
    node dist/index.js
fi
