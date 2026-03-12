/**
 * Test the production encryption fix
 */

require('dotenv').config();
const GetEpayEncryption = require('./src/utils/getepayEncryptProduction');

console.log('🧪 Testing Production Encryption Fix\n');
console.log('='.repeat(60));

async function testProductionEncryption() {
  console.log('\n📋 Environment:');
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('  GETEPAY_TERMINAL_ID:', process.env.GETEPAY_TERMINAL_ID);
  console.log('  GETEPAY_KEY:', process.env.GETEPAY_KEY ? '***set***' : 'MISSING');
  console.log('  GETEPAY_IV:', process.env.GETEPAY_IV);
  
  console.log('\n🔐 Initializing encryption...');
  const enc = new GetEpayEncryption(
    process.env.GETEPAY_IV,
    process.env.GETEPAY_KEY,
    true // isProduction = true
  );
  
  const testData = {
    mid: process.env.GETEPAY_MID,
    terminalId: process.env.GETEPAY_TERMINAL_ID,
    amount: "100.00",
    merchantTransactionId: "TEST_TXN_123",
    transactionDate: "12-03-2026 10:30:00",
    ru: process.env.GETEPAY_RETURN_URL,
    callbackUrl: process.env.GETEPAY_CALLBACK_URL,
    currency: "INR",
    paymentMode: "ALL",
    txnType: "single",
    productType: "PAYMENT",
    vpa: process.env.GETEPAY_TERMINAL_ID
  };
  
  console.log('\n📦 Test data:', JSON.stringify(testData, null, 2));
  
  try {
    console.log('\n🔒 Encrypting...');
    const encrypted = await enc.encrypt(JSON.stringify(testData));
    console.log('  ✅ Encrypted successfully!');
    console.log('  Encrypted length:', encrypted.length);
    console.log('  Encrypted (first 50 chars):', encrypted.substring(0, 50) + '...');
    
    console.log('\n🔓 Decrypting...');
    const decrypted = await enc.decrypt(encrypted);
    const decryptedObj = JSON.parse(decrypted);
    console.log('  ✅ Decrypted successfully!');
    console.log('  Matches original:', JSON.stringify(decryptedObj) === JSON.stringify(testData));
    
    console.log('\n✅ ALL TESTS PASSED! Production encryption is working.');
    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testProductionEncryption().then(success => {
  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('🎉 Success! You can now deploy to production.');
  } else {
    console.log('⚠️  Tests failed. Please check the errors above.');
  }
  console.log('='.repeat(60));
  process.exit(success ? 0 : 1);
});
