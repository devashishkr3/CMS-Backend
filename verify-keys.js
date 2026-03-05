require('dotenv').config();

console.log('🔑 GetEpay Configuration Verification');
console.log('=====================================');
console.log('');
console.log('MID:', process.env.GETEPAY_MID);
console.log('Terminal ID:', process.env.GETEPAY_TERMINAL_ID);
console.log('Key Set:', !!process.env.GETEPAY_KEY);
console.log('IV Set:', !!process.env.GETEPAY_IV);
console.log('URL:', process.env.GETEPAY_URL);
console.log('');

if (!process.env.GETEPAY_MID || !process.env.GETEPAY_KEY || !process.env.GETEPAY_IV) {
  console.log('❌ ERROR: Missing required GetEpay configuration!');
  console.log('Make sure .env file has:');
  console.log('  - GETEPAY_MID=108');
  console.log('  - GETEPAY_KEY=JoYPd+qso9s7T+Ebj8pi4Wl8i+AHLv+5UNJxA3JkDgY=');
  console.log('  - GETEPAY_IV=hlnuyA9b4YxDq6oJSZFl8g==');
  process.exit(1);
}

console.log('✅ All GetEpay keys are configured correctly!');
console.log('');

// Test encryption
const GcmPgEncryption = require('./src/utils/getepayEncrypt');

async function testEncryption() {
  const enc = new GcmPgEncryption(process.env.GETEPAY_IV, process.env.GETEPAY_KEY);
  
  const testData = JSON.stringify({
    mid: process.env.GETEPAY_MID,
    terminalId: process.env.GETEPAY_TERMINAL_ID,
    amount: '100'
  });

  try {
    console.log('🔐 Testing encryption...');
    const encrypted = await enc.encrypt(testData);
    console.log('✅ Encryption successful! Length:', encrypted.length);
    
    console.log('🔓 Testing decryption...');
    const decrypted = await enc.decrypt(encrypted);
    console.log('✅ Decryption successful!');
    console.log('Decrypted:', decrypted);
    
    console.log('');
    console.log('✅ All encryption tests passed! Ready to use GetEpay.');
  } catch (err) {
    console.log('❌ Encryption test failed:', err.message);
    process.exit(1);
  }
}

testEncryption();
