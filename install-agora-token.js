// Install Agora Token Package
// Run: node install-agora-token.js

import { execSync } from 'child_process';

console.log('🚀 Installing Agora Access Token package...');

try {
  // Try npm first
  console.log('📦 Running: npm install agora-access-token');
  execSync('npm install agora-access-token', { stdio: 'inherit' });
  console.log('✅ Successfully installed agora-access-token via npm');
} catch (error) {
  console.log('❌ npm install failed, trying yarn...');
  try {
    console.log('📦 Running: yarn add agora-access-token');
    execSync('yarn add agora-access-token', { stdio: 'inherit' });
    console.log('✅ Successfully installed agora-access-token via yarn');
  } catch (yarnError) {
    console.error('❌ Both npm and yarn failed. Please install manually:');
    console.error('   npm install agora-access-token');
    console.error('   OR');
    console.error('   yarn add agora-access-token');
    process.exit(1);
  }
}

console.log('\n🎉 Installation complete!');
console.log('📋 Next steps:');
console.log('1. Restart your development server');
console.log('2. Test video calls - they should now work with proper tokens');
console.log('3. Check console for "Token generated successfully" message');