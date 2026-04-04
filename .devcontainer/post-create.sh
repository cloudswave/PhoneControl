#!/bin/bash
set -e

echo "=== PhoneControl Development Container Post-Create Setup ==="

# Install system packages required for Tauri
echo "📦 Installing Tauri system dependencies..."
apt-get update
apt-get install -y --no-install-recommends \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    pkg-config \
    libpng-dev \
    libjpeg-dev \
    libgtk-3-dev \
    libgdk-pixbuf2.0-dev \
    libatk1.0-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libxrandr-dev \
    libglib2.0-dev \
    xdg-utils \
    android-tools-adb \
    android-tools-fastboot
rm -rf /var/lib/apt/lists/*

# Update Rust toolchain
echo "📦 Updating Rust toolchain..."
rustup update
rustup component add rust-analyzer clippy
rustup target add wasm32-unknown-unknown

# Install npm dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Verify installations
echo ""
echo "=== Verifying Installation ==="
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Rust version: $(rustc --version)"
echo "Cargo version: $(cargo --version)"

echo ""
echo "✅ Post-create setup completed!"
echo ""
echo "Available commands:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build the project"
echo "  npm run test         - Run tests"
echo "  npm run tauri dev    - Start Tauri development"
echo "  npm run tauri build  - Build Tauri application"
