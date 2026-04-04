#!/bin/bash
set -e

echo "=== PhoneControl Development Container Post-Start Setup ==="

# Update Rust if needed
echo "🔄 Checking Rust updates..."
rustup update --self || true

# Verify npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

bash .devcontainer/install-novnc-desktop.sh

echo "✅ Post-start setup completed!"
