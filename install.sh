#!/bin/bash
# Hilbert One-Command Installer
# Run: curl -fsSL https://hilbert.ai/install | bash
# Or:   npm install -g hilbert

set -e

echo "Installing Hilbert..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js not found. Install from https://nodejs.org"
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 not found"
    exit 1
fi

# Install Python backend
echo "Installing Python backend..."
cd /Users/medow/Documents/hilbert 2>/dev/null || cd "$(dirname "$0")/.."
if [ -f "pyproject.toml" ]; then
    pip install -e . 2>/dev/null || pip3 install -e .
fi

# Install Node CLI
echo "Installing CLI..."
cd "$(dirname "$0")"
if [ -f "package.json" ]; then
    npm install
    npm run build
    
    # Link globally
    if command -v npm &> /dev/null; then
        npm link
    fi
fi

echo ""
echo "✓ Hilbert installed successfully!"
echo ""
echo "Usage:"
echo "  hilbert --help                    # Show help"
echo "  hilbert \"quantum computing\"      # One-shot research"
echo "  hilbert interactive               # Start REPL"
echo "  hilbert doctor                   # Check installation"
echo ""