#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/dist/index.js" ]; then
    node "$SCRIPT_DIR/dist/index.js"
else
    echo "[!!] Build not found. Run ./install.sh first!"
    exit 1
fi
