#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const cliPath = path.join(__dirname, '../dist/index.js');
const args = process.argv.slice(2);

const child = spawn('node', [cliPath, ...args], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});