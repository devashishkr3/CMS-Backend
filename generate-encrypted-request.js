/**
 * Generate Encrypted Request for GetEpay
 * 
 * This script generates the exact encrypted payload that will be sent to GetEpay
 * Use this to verify encryption is working correctly or to share with developer
 * 
 * Usage: node generate-encrypted-request.js <paymentId>
 */

require('dotenv').config();
const GetEpayEncryption = require('./src/utils/getepayEncryptProduction');
const moment = require('moment');

// Sample payment data (Replace with actual payment details)
const paymentData = {
  id: 'bbd54ecd-e1ff-4e1b-ab43-a3832b55eef5',
  receiptNo: 'RCT-1773297962305-737',
  totalAmount: 4050,
  student: {
    name: 'Student Name',
    phone: '9876543210',
    email: 'student@example.com'
  }
};

console.log('🔐 GetEpay Encrypted Request Generator\n');
console.log('=' .repeat(60));

// Show configuration
console.log('\n📋 Configuration:');
console.log(`MID: ${process.env.GETEPAY_MID}`);
console.log(`Terminal ID: ${process.env.GETEPAY_TERMINAL_ID}`);
console.log(`URL: ${process.env.GETEPAY_URL}`);
console.log(`IV: ${process.env.GETEPAY_IV ? 'Set' : 'NOT SET'}`);
console.log(`KEY: ${process.env.GETEPAY_KEY ? 'Set' : 'NOT SET'}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Build payload exactly like payment.controller.js
const baseUrl = process.env.API_BASE_URL || 'https://api.santsandhyadasmahilacollege.org';
const returnUrl = `${baseUrl}/api/v1/payments/return?paymentId=${paymentData.id}`;
const callbackUrl = `${baseUrl}/api/v1/payments/callback?paymentId=${paymentData.id}`;

const payload = {
  mid: process.env.GETEPAY_MID,
  terminalId: process.env.GETEPAY_TERMINAL_ID,
  amount: paymentData.totalAmount.toString(),
  merchantTransactionId: paymentData.receiptNo,
  transactionDate: moment().format("DD-MM-YYYY HH:mm:ss"),
  ru: returnUrl,
  callbackUrl: callbackUrl,
  currency: "INR",
  paymentMode: "ALL",
  txnType: "single",
  productType: "PAYMENT",
  txnNote: `Payment for ${paymentData.student.name} - ${paymentData.receiptNo}`,
  udf1: paymentData.student.phone || "",
  udf2: paymentData.student.email || "",
  udf3: paymentData.student.name || "",
  udf4: "",
  udf5: "",
  udf6: "",
  udf7: "",
  udf8: "",
  udf9: "",
  udf10: "",
  vpa: process.env.GETEPAY_TERMINAL_ID
};

console.log('\n📦 Payload to Encrypt:');
console.log(JSON.stringify(payload, null, 2));

// Initialize encryption
const enc = new GetEpayEncryption(
  process.env.GETEPAY_IV,
  process.env.GETEPAY_KEY,
  process.env.NODE_ENV === 'production'
);

// Encrypt
async function generateEncryptedRequest() {
  try {
    console.log('\n🔐 Encrypting payload...');
    const encrypted = await enc.encrypt(JSON.stringify(payload));
    
    console.log(`✅ Encrypted successfully!`);
    console.log(`Length: ${encrypted.length} characters`);
    
    console.log('\n📤 ENCRYPTED REQUEST (First 200 chars):');
    console.log(encrypted.substring(0, 200) + '...');
    
    console.log('\n📤 FULL ENCRYPTED REQUEST:');
    console.log(encrypted);
    
    console.log('\n📄 Complete JSON to Send to GetEpay:');
    const requestData = {
      mid: process.env.GETEPAY_MID,
      terminalId: process.env.GETEPAY_TERMINAL_ID,
      req: encrypted
    };
    console.log(JSON.stringify(requestData, null, 2));
    
    // Test decryption
    console.log('\n🔍 Testing Decryption (Round-trip verification)...');
    const decrypted = await enc.decrypt(encrypted);
    const decryptedObj = JSON.parse(decrypted);
    
    const matches = JSON.stringify(decryptedObj) === JSON.stringify(payload);
    console.log(`${matches ? '✅' : '❌'} Decryption ${matches ? 'SUCCESSFUL' : 'FAILED'}`);
    
    if (!matches) {
      console.log('\n⚠️  WARNING: Decrypted data does not match original payload!');
      console.log('Original:', JSON.stringify(payload).substring(0, 100));
      console.log('Decrypted:', JSON.stringify(decryptedObj).substring(0, 100));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('💡 Share this output with your developer');
    console.log('=' .repeat(60) + '\n');
    
    return {
      encrypted,
      requestData,
      payload,
      decrypted
    };
  } catch (error) {
    console.error('\n❌ Encryption failed:', error.message);
    console.error('Stack:', error.stack);
    console.log('\n💡 Possible issues:');
    console.log('1. GETEPAY_KEY is invalid or wrong format');
    console.log('2. GETEPAY_IV is missing or incorrect');
    console.log('3. Encryption library issue');
    return null;
  }
}

// Run
generateEncryptedRequest();
