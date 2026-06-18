#!/bin/bash
read -p "Delete all build files? (y/N): " confirm
[[ ! "$confirm" =~ ^[Yy]$ ]] && echo "Cancelled." && exit 0
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$SCRIPT_DIR/node_modules" "$SCRIPT_DIR/dist" 2>/dev/null
npm cache clean --force 2>/dev/null
echo "Cleanup done!"
