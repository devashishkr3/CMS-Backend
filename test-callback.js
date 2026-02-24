/**
 * Manual Callback Tester
 * 
 * This script simulates what GetEpay does after payment completion.
 * Use this to test if your callback endpoint is working properly.
 * 
 * Usage:
 *   node test-callback.js <paymentId> <paymentStatus>
 * 
 * Example (Success):
 *   node test-callback.js 8d3fb02b-9fe0-4c8d-93d9-a7640e867202 SUCCESS
 * 
 * Example (Failed):
 *   node test-callback.js 8d3fb02b-9fe0-4c8d-93d9-a7640e867202 FAILED
 */

const fetch = require('node-fetch');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const GcmPgEncryption = require('./src/utils/gcmPgEncryption');

async function testCallback() {
  try {
    const paymentId = process.argv[2];
    const paymentStatus = process.argv[3] || 'SUCCESS';

    if (!paymentId) {
      console.error('❌ Usage: node test-callback.js <paymentId> [paymentStatus]');
      console.error('Example: node test-callback.js 8d3fb02b-9fe0-4c8d-93d9-a7640e867202 SUCCESS');
      process.exit(1);
    }

    console.log('🧪 [TEST CALLBACK] Starting callback simulation...');
    console.log(`📝 Payment ID: ${paymentId}`);
    console.log(`📝 Payment Status: ${paymentStatus}`);

    // Create mock response that GetEpay would send
    const mockResponse = {
      merchantId: process.env.GETEPAY_MID || '108',
      merchantTransactionId: `TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      paymentId: paymentId,
      paymentStatus: paymentStatus,
      paymentStatusMessage: paymentStatus === 'SUCCESS' ? 'Payment successful' : 'Payment failed',
      bankTransactionNo: paymentStatus === 'SUCCESS' ? `BANK-${Date.now()}` : null,
      bankTxnId: paymentStatus === 'SUCCESS' ? `BTXN-${Date.now()}` : null,
      amount: 1000,
      currency: 'INR',
      transactionDate: new Date().toISOString(),
      responseCode: paymentStatus === 'SUCCESS' ? '0000' : 'E001'
    };

    console.log('📦 Mock Response:', JSON.stringify(mockResponse, null, 2));

    // Encrypt the response like GetEpay would
    const enc = new GcmPgEncryption(
      process.env.GETEPAY_IV,
      process.env.GETEPAY_KEY
    );

    console.log('🔐 Encrypting response...');
    const encryptedResponse = await enc.encrypt(JSON.stringify(mockResponse));
    console.log('✅ Encrypted response generated');

    // Send to callback endpoint
    const callbackUrl = `http://localhost:8080/api/v1/payments/callback?paymentId=${paymentId}`;
    
    console.log(`📤 Sending callback to: ${callbackUrl}`);
    console.log('📤 Sending encrypted response...');

    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        response: encryptedResponse
      })
    });

    const data = await response.json();

    console.log('\n' + '='.repeat(60));
    if (response.ok) {
      console.log('✅ [SUCCESS] Callback processed successfully!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ [ERROR] Callback failed');
      console.log(`Status Code: ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    console.log('='.repeat(60));

    // Now check if payment status was updated
    console.log('\n🔍 Verifying payment status update...');
    
    const statusResponse = await fetch(`http://localhost:8080/api/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (statusResponse.ok) {
      const paymentData = await statusResponse.json();
      const payment = paymentData.data.payment;
      
      console.log('📊 Payment Status:', payment.status);
      console.log('📊 Bank Txn No:', payment.bankTxnNo || 'N/A');
      
      if (payment.status === paymentStatus) {
        console.log('✅ Status update verified! Payment status matches expected status.');
      } else {
        console.warn(`⚠️  Status mismatch! Expected: ${paymentStatus}, Got: ${payment.status}`);
      }
    } else {
      console.error('❌ Could not fetch payment status');
    }

  } catch (error) {
    console.error('❌ [ERROR]', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testCallback();
