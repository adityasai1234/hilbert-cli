#!/bin/bash
# Hilbert Installer - curl -fsSL https://raw.githubusercontent.com/adityasai1234/hilbert-cli/main/install.sh | bash

set -e

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "🔬 Installing Hilbert..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js required. Install from nodejs.org"
    exit 1
fi

# Create temp dir
TEMP=$(mktemp -d)
trap "rm -rf $TEMP" EXIT

# Clone repo
echo "📦 Fetching Hilbert..."
git clone --depth 1 https://github.com/adityasai1234/hilbert-cli.git "$TEMP/hilbert" 2>/dev/null

# Install Python backend
cd "$TEMP/hilbert"
pip install -e . 2>/dev/null || true

# Build CLI
cd cli
npm install --silent 2>/dev/null || npm install
npm run build

# Install
mkdir -p "$HOME/.hilbert"
cp -r . "$HOME/.hilbert/"
mkdir -p "$HOME/.local/bin"
ln -sf "$HOME/.hilbert/bin/hilbert.js" "$HOME/.local/bin/hilbert"

echo "✅ Installed! Run: hilbert --help"