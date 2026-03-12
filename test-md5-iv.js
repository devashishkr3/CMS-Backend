/**
 * Test MD5 IV generation for GetEpay production
 */

require('dotenv').config();
const crypto = require('crypto');

const terminalId = process.env.GETEPAY_TERMINAL_ID;
console.log('Terminal ID:', terminalId);

// Generate MD5 hash and take first 16 characters (16 bytes = 128 bits)
const md5Hash = crypto.createHash('md5').update(terminalId).digest('hex');
console.log('Full MD5 hash (hex):', md5Hash);
console.log('MD5 hash length:', md5Hash.length);

// Take first 16 hex chars (which is 8 bytes = 64 bits) - WRONG!
// We need 16 BYTES, which is 32 hex chars
const ivFromMd5 = md5Hash.substring(0, 32); // 32 hex chars = 16 bytes
console.log('IV from MD5 (first 32 hex chars):', ivFromMd5);
console.log('IV length (bytes):', ivFromMd5.length / 2);

// Convert to buffer
const ivBuffer = Buffer.from(ivFromMd5, 'hex');
console.log('IV Buffer length:', ivBuffer.length);

// Test encryption
try {
  const key = Buffer.from(process.env.GETEPAY_KEY, 'base64');
  console.log('\nKey length:', key.length);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, ivBuffer);
  const testData = JSON.stringify({ test: 'production payment' });
  let encrypted = cipher.update(testData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  console.log('✅ Encryption successful with MD5-derived IV!');
  console.log('Encrypted:', encrypted.toUpperCase());
} catch (error) {
  console.error('❌ Error:', error.message);
}
