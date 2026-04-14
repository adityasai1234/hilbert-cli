#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// When installed globally, __dirname points to node_modules/hilbert/bin/
// When linked locally, __dirname points to <repo>/cli/bin/
let cliPath;

const distPath = path.join(__dirname, '..', 'dist', 'index.js');

// Check if running from node_modules (global install)
if (fs.existsSync(distPath)) {
  cliPath = distPath;
} else {
  // Local development - try relative to cli/bin
  cliPath = path.join(__dirname, '..', 'dist', 'index.js');
}

const args = process.argv.slice(2);

const child = spawn('node', [cliPath, ...args], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});