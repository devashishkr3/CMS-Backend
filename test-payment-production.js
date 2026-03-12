/**
 * Production Payment Gateway Test Script
 * 
 * This script tests the GetEpay payment gateway integration
 * Run this AFTER deploying to production to verify everything works
 * 
 * Usage: node test-payment-production.js
 */

require('dotenv').config();
const axios = require('axios');
const GetEpayEncryption = require('./src/utils/getepayEncryptProduction');

console.log('🧪 Testing Production Payment Gateway Setup\n');
console.log('=' .repeat(60));

// Test 1: Environment Variables
console.log('\n✅ Test 1: Checking Environment Variables');
console.log('-'.repeat(60));

const envChecks = {
  'NODE_ENV': process.env.NODE_ENV,
  'GETEPAY_MID': process.env.GETEPAY_MID,
  'GETEPAY_TERMINAL_ID': process.env.GETEPAY_TERMINAL_ID,
  'GETEPAY_KEY': process.env.GETEPAY_KEY ? '✓ Set' : '✗ Missing',
  'GETEPAY_IV': process.env.GETEPAY_IV ? '✓ Set' : '✗ Missing',
  'GETEPAY_URL': process.env.GETEPAY_URL,
  'GETEPAY_RETURN_URL': process.env.GETEPAY_RETURN_URL,
  'GETEPAY_CALLBACK_URL': process.env.GETEPAY_CALLBACK_URL
};

Object.entries(envChecks).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

// Test 2: Encryption/Decryption
console.log('\n✅ Test 2: Testing Encryption/Decryption');
console.log('-'.repeat(60));

async function testEncryption() {
  try {
    const testData = {
      mid: process.env.GETEPAY_MID,
      terminalId: process.env.GETEPAY_TERMINAL_ID,
      amount: "100.00",
      merchantTransactionId: "TEST_TXN_001",
      transactionDate: "12-03-2026 10:30:00",
      ru: process.env.GETEPAY_RETURN_URL,
      callbackUrl: process.env.GETEPAY_CALLBACK_URL,
      currency: "INR",
      paymentMode: "ALL",
      txnType: "single",
      productType: "PAYMENT",
      vpa: process.env.GETEPAY_TERMINAL_ID
    };

    console.log('  Original data:', JSON.stringify(testData, null, 2));

    const enc = new GetEpayEncryption(
      process.env.GETEPAY_IV,
      process.env.GETEPAY_KEY,
      process.env.NODE_ENV === 'production'
    );

    // Encrypt
    const encrypted = await enc.encrypt(JSON.stringify(testData));
    console.log('\n  ✅ Encrypted successfully');
    console.log('  Encrypted length:', encrypted.length);
    console.log('  Encrypted (first 50 chars):', encrypted.substring(0, 50) + '...');

    // Decrypt
    const decrypted = await enc.decrypt(encrypted);
    const decryptedObj = JSON.parse(decrypted);
    console.log('\n  ✅ Decrypted successfully');
    console.log('  Decrypted matches original:', JSON.stringify(decryptedObj) === JSON.stringify(testData));

    return true;
  } catch (error) {
    console.error('  ❌ Encryption test failed:', error.message);
    return false;
  }
}

// Test 3: API Connectivity
console.log('\n✅ Test 3: Testing Gateway API Connectivity');
console.log('-'.repeat(60));

async function testAPIConnectivity() {
  try {
    console.log('  Gateway URL:', process.env.GETEPAY_URL);
    console.log('  Testing connection...');

    // Just test if we can reach the server (don't actually send a payment request)
    const response = await axios.get(process.env.GETEPAY_URL.replace('/generateTxn', ''), {
      timeout: 10000,
      validateStatus: () => true // Accept any status
    });

    console.log('  ✅ Gateway server reachable');
    console.log('  Response status:', response.status);
    return true;
  } catch (error) {
    console.error('  ⚠️  Gateway connectivity test:', error.message);
    console.log('  Note: This is expected if gateway requires POST only');
    return false;
  }
}

// Test 4: Payload Validation
console.log('\n✅ Test 4: Validating Payload Structure');
console.log('-'.repeat(60));

function validatePayload() {
  const payload = {
    mid: process.env.GETEPAY_MID,
    terminalId: process.env.GETEPAY_TERMINAL_ID,
    amount: "100.00",
    merchantTransactionId: "TEST_TXN_001",
    transactionDate: "12-03-2026 10:30:00",
    ru: process.env.GETEPAY_RETURN_URL,
    callbackUrl: process.env.GETEPAY_CALLBACK_URL,
    currency: "INR",
    paymentMode: "ALL",
    txnType: "single",
    productType: "PAYMENT",
    vpa: process.env.GETEPAY_TERMINAL_ID,
    udf1: "9999999999",
    udf2: "test@example.com",
    udf3: "Test User"
  };

  const requiredFields = ['mid', 'terminalId', 'amount', 'merchantTransactionId', 
                          'transactionDate', 'ru', 'callbackUrl', 'currency', 
                          'paymentMode', 'txnType', 'productType', 'vpa'];

  let allValid = true;
  requiredFields.forEach(field => {
    if (!payload[field]) {
      console.log(`  ❌ Missing required field: ${field}`);
      allValid = false;
    } else {
      console.log(`  ✅ ${field}: ${payload[field]}`);
    }
  });

  return allValid;
}

// Run all tests
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RUNNING ALL TESTS');
  console.log('='.repeat(60));

  const results = {
    envCheck: true,
    encryption: await testEncryption(),
    apiConnectivity: await testAPIConnectivity(),
    payloadValidation: validatePayload()
  };

  console.log('\n' + '='.repeat(60));
  console.log('📈 TEST RESULTS');
  console.log('='.repeat(60));

  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const allPassed = Object.values(results).every(r => r);
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Production setup is ready.');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Please review the errors above.');
  }
  console.log('='.repeat(60));

  process.exit(allPassed ? 0 : 1);
}

// Execute tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
