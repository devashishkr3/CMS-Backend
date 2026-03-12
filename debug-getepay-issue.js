/**
 * Debug GetEpay Production Issue
 * This script will help identify why GetEpay is returning "Unable to process payment request"
 */

require('dotenv').config();
const axios = require('axios');
const GetEpayEncryption = require('./src/utils/getepayEncryptProduction');

console.log('🔍 Debugging GetEpay Production Issue...\n');
console.log('=' .repeat(60));

// Show current configuration (masked)
console.log('\n📋 Current Configuration:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`GETEPAY_MID: ${process.env.GETEPAY_MID || 'NOT SET'}`);
console.log(`GETEPAY_TERMINAL_ID: ${process.env.GETEPAY_TERMINAL_ID || 'NOT SET'}`);
console.log(`GETEPAY_URL: ${process.env.GETEPAY_URL || 'NOT SET'}`);
console.log(`GETEPAY_KEY: ${process.env.GETEPAY_KEY ? process.env.GETEPAY_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
console.log(`GETEPAY_IV: ${process.env.GETEPAY_IV ? process.env.GETEPAY_IV.substring(0, 10) + '...' : 'NOT SET'}`);

// Test encryption
async function testEncryption() {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 Testing Encryption...');
  
  try {
    const enc = new GetEpayEncryption(
      process.env.GETEPAY_IV,
      process.env.GETEPAY_KEY,
      process.env.NODE_ENV === 'production'
    );
    
    const testData = {
      mid: process.env.GETEPAY_MID,
      terminalId: process.env.GETEPAY_TERMINAL_ID,
      amount: '1.00',
      merchantTransactionId: 'TEST-' + Date.now(),
      transactionDate: new Date().toLocaleString(),
      ru: 'https://example.com/return',
      callbackUrl: 'https://example.com/callback',
      currency: 'INR',
      paymentMode: 'ALL',
      txnType: 'single',
      productType: 'PAYMENT',
      txnNote: 'Test transaction',
      udf1: '9999999999',
      udf2: 'test@example.com',
      udf3: 'Test User',
      vpa: process.env.GETEPAY_TERMINAL_ID
    };
    
    console.log('✅ Test payload created');
    console.log('Sample payload:', JSON.stringify(testData, null, 2));
    
    const encrypted = await enc.encrypt(JSON.stringify(testData));
    console.log(`✅ Encrypted successfully (${encrypted.length} chars)`);
    console.log('Encrypted (first 100):', encrypted.substring(0, 100) + '...');
    
    // Test decryption
    const decrypted = await enc.decrypt(encrypted);
    const decryptedObj = JSON.parse(decrypted);
    console.log('✅ Decryption successful');
    console.log('Decrypted matches?', 
      decryptedObj.mid === testData.mid && 
      decryptedObj.terminalId === testData.terminalId
    );
    
    return { encrypted, testData };
  } catch (error) {
    console.error('❌ Encryption/Decryption failed:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

// Test direct API call
async function testAPICall(encryptedData) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Testing Direct API Call...');
  
  const requestData = {
    mid: process.env.GETEPAY_MID,
    terminalId: process.env.GETEPAY_TERMINAL_ID,
    req: encryptedData
  };
  
  console.log('\n📤 Request Data:');
  console.log('mid:', requestData.mid);
  console.log('terminalId:', requestData.terminalId);
  console.log('req (first 50):', requestData.req.substring(0, 50) + '...');
  
  try {
    const response = await axios.post(process.env.GETEPAY_URL, requestData, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      validateStatus: () => true // Accept all status codes
    });
    
    console.log('\n📥 Response Received:');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    
    console.log('\n📄 Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Analyze response
    if (response.data.status === 'FAILED') {
      console.log('\n❌ GetEpay returned FAILED status');
      console.log('Error Message:', response.data.message);
      
      if (response.data.terminalId === null) {
        console.log('\n⚠️  CRITICAL: terminalId is NULL in response');
        console.log('This means GetEpay is rejecting your Terminal ID');
        console.log('\nPossible reasons:');
        console.log('1. Terminal ID format is incorrect (check case sensitivity)');
        console.log('2. Terminal ID is not active in production');
        console.log('3. Terminal ID is not authorized for this endpoint');
        console.log('4. MID and Terminal ID mismatch');
      }
      
      if (response.data.response === null) {
        console.log('\n⚠️  Response field is NULL');
        console.log('GetEpay did not process the request');
      }
    } else if (response.data.status === 'SUCCESS') {
      console.log('\n✅ SUCCESS! Payment can be processed');
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ API Call Failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Network issue?');
    } else {
      console.error('Error:', error.message);
    }
    return null;
  }
}

// Main execution
async function main() {
  const encryptionResult = await testEncryption();
  
  if (!encryptionResult) {
    console.log('\n❌ Encryption failed. Cannot proceed with API test.');
    console.log('\n💡 Solution: Check your GETEPAY_KEY and GETEPAY_IV values');
    return;
  }
  
  const apiResponse = await testAPICall(encryptionResult.encrypted);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log('=' .repeat(60));
  
  if (apiResponse && apiResponse.status === 'FAILED') {
    console.log('❌ TEST FAILED');
    console.log('\n🎯 Next Steps:');
    console.log('1. Contact GetEpay support with these details:');
    console.log('   - MID:', process.env.GETEPAY_MID);
    console.log('   - Terminal ID:', process.env.GETEPAY_TERMINAL_ID);
    console.log('   - Error: "Unable to process payment request"');
    console.log('   - terminalId in response: NULL');
    console.log('\n2. Verify Terminal ID format with GetEpay');
    console.log('3. Confirm Terminal ID is active for production');
    console.log('4. Ask if Terminal ID needs to be uppercase');
    console.log('\n📞 GetEpay Support:');
    console.log('   Email: support@getepay.in');
    console.log('   Provide: MID, Terminal ID, error message, timestamp');
  } else if (apiResponse && apiResponse.status === 'SUCCESS') {
    console.log('✅ TEST PASSED - Your integration is working!');
  } else {
    console.log('⚠️  Test inconclusive. Check logs above.');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the test
main().catch(console.error);
