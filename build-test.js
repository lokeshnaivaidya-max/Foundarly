#!/usr/bin/env node
import { existsSync } from 'fs';
import { resolve } from 'path';

console.log('=== Build Environment Check ===');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);
console.log('');

const files = [
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'vite.config.ts',
  'package.json'
];

console.log('=== File Check ===');
files.forEach(file => {
  const exists = existsSync(resolve(process.cwd(), file));
  console.log(`${exists ? '✅' : '❌'} ${file}`);
});

console.log('');
console.log('If all files exist, the build should work.');
