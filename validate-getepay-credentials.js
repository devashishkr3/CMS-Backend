/**
 * Utility to validate and test GetEpay credentials
 * Run this to check if your .env has correct IV and Key format
 */

require('dotenv').config();
const crypto = require('crypto');

console.log('🔍 Validating GetEpay Credentials\n');
console.log('='.repeat(60));

// Test IV
console.log('\n📌 Testing IV:', process.env.GETEPAY_IV);
try {
  const ivBuffer = Buffer.from(process.env.GETEPAY_IV, 'base64');
  console.log('  ✅ Valid Base64');
  console.log('  Length (bytes):', ivBuffer.length);
  console.log('  Expected: 16 bytes for AES-CBC');
  console.log('  Status:', ivBuffer.length === 16 ? '✅ CORRECT' : '❌ WRONG - Must be 16 bytes');
  console.log('  Hex representation:', ivBuffer.toString('hex'));
} catch (error) {
  console.error('  ❌ Invalid Base64:', error.message);
}

// Test Key
console.log('\n📌 Testing KEY:', process.env.GETEPAY_KEY ? '***hidden***' : 'MISSING');
try {
  const keyBuffer = Buffer.from(process.env.GETEPAY_KEY, 'base64');
  console.log('  ✅ Valid Base64');
  console.log('  Length (bytes):', keyBuffer.length);
  console.log('  Expected: 32 bytes for AES-256-CBC');
  console.log('  Status:', keyBuffer.length === 32 ? '✅ CORRECT' : '❌ WRONG - Must be 32 bytes');
  console.log('  Hex representation:', keyBuffer.toString('hex'));
} catch (error) {
  console.error('  ❌ Invalid Base64:', error.message);
}

// Test encryption with current config
console.log('\n🧪 Testing Encryption with Current Config...');
try {
  const iv = Buffer.from(process.env.GETEPAY_IV, 'base64');
  const key = Buffer.from(process.env.GETEPAY_KEY, 'base64');
  
  if (iv.length !== 16) {
    throw new Error(`IV must be 16 bytes, got ${iv.length}`);
  }
  if (key.length !== 32) {
    throw new Error(`Key must be 32 bytes, got ${key.length}`);
  }
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const testData = JSON.stringify({ test: 'data' });
  let encrypted = cipher.update(testData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  console.log('  ✅ Encryption successful!');
  console.log('  Encrypted (hex):', encrypted.toUpperCase());
  
} catch (error) {
  console.error('  ❌ Encryption failed:', error.message);
  console.error('\n⚠️  YOUR CREDENTIALS ARE INCORRECT!');
  console.error('\n📋 SOLUTION:');
  console.error('  You need to get the correct IV and Key from GetEpay.');
  console.error('  They should be Base64-encoded strings that decode to:');
  console.error('    - IV: 16 bytes');
  console.error('    - Key: 32 bytes');
  console.error('\n💡 Example of CORRECT format:');
  console.error('  GETEPAY_IV=dGhpc2lzYXRlc3RpdmFiYzEyMzQ=');
  console.error('  GETEPAY_KEY=VGhpc2lzYXRlc3RrZXlmb3JBRVMyNTZDQkNFbmNyeXB0aW9u');
}

console.log('\n' + '='.repeat(60));
console.log('Current Environment:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  GETEPAY_MID:', process.env.GETEPAY_MID);
console.log('  GETEPAY_TERMINAL_ID:', process.env.GETEPAY_TERMINAL_ID);
console.log('  GETEPAY_URL:', process.env.GETEPAY_URL);
console.log('='.repeat(60));
