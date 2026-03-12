/**
 * Production Payment Gateway Configuration Validator
 * 
 * This script validates that all GetEpay payment gateway environment variables
 * are correctly configured for production deployment.
 * 
 * Usage: node validate-production-payment-config.js
 */

require('dotenv').config();
const crypto = require('crypto');

console.log('🔍 Validating GetEpay Payment Gateway Configuration...\n');

let hasErrors = false;
let warnings = [];

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function logSuccess(message) {
  console.log(`${colors.green}✅${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`${colors.red}❌${colors.reset} ${message}`);
  hasErrors = true;
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️${colors.reset} ${message}`);
  warnings.push(message);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️${colors.reset} ${message}`);
}

function logSection(message) {
  console.log(`\n${colors.cyan}${message}${colors.reset}`);
  console.log('='.repeat(message.length));
}

// ============================================
// 1. Validate Required Environment Variables
// ============================================
logSection('1. Checking Required Variables');

const requiredVars = [
  'GETEPAY_MID',
  'GETEPAY_TERMINAL_ID',
  'GETEPAY_KEY',
  'GETEPAY_IV',
  'GETEPAY_URL',
  'GETEPAY_RETURN_URL',
  'GETEPAY_CALLBACK_URL'
];

requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    logError(`${varName} is not set`);
  } else {
    logSuccess(`${varName} is set`);
  }
});

// ============================================
// 2. Validate URL Format
// ============================================
logSection('2. Validating URL Configuration');

const urlPattern = /^https:\/\/[^\/]+:\d+\/.+$/;
if (process.env.GETEPAY_URL) {
  if (urlPattern.test(process.env.GETEPAY_URL)) {
    logSuccess(`GETEPAY_URL format is valid: ${process.env.GETEPAY_URL}`);
    
    // Check for correct port
    if (process.env.GETEPAY_URL.includes(':8443')) {
      logSuccess('GETEPAY_URL includes correct port (:8443)');
    } else {
      logError('GETEPAY_URL should include port :8443');
    }
    
    // Check for correct path
    if (process.env.GETEPAY_URL.includes('/pg/v2/generateInvoice')) {
      logSuccess('GETEPAY_URL uses correct endpoint path (/pg/v2/generateInvoice)');
    } else if (process.env.GETEPAY_URL.includes('/pg/generateTxn')) {
      logError('GETEPAY_URL uses deprecated endpoint (/pg/generateTxn). Should be /pg/v2/generateInvoice');
    } else {
      logWarning('GETEPAY_URL path might be incorrect. Expected: /pg/v2/generateInvoice');
    }
  } else {
    logError(`GETEPAY_URL format is invalid: ${process.env.GETEPAY_URL}`);
    logInfo('Expected format: https://portal.getepay.in:8443/getepayPortal/pg/v2/generateInvoice');
  }
}

// Validate return and callback URLs
['GETEPAY_RETURN_URL', 'GETEPAY_CALLBACK_URL'].forEach(urlName => {
  const url = process.env[urlName];
  if (url && url.startsWith('http')) {
    logSuccess(`${urlName} is a valid HTTP(S) URL`);
  } else if (url) {
    logWarning(`${urlName} should start with http:// or https://`);
  }
});

// ============================================
// 3. Validate Credentials Format
// ============================================
logSection('3. Validating Credential Formats');

// MID validation
if (process.env.GETEPAY_MID) {
  if (/^\d+$/.test(process.env.GETEPAY_MID)) {
    logSuccess(`GETEPAY_MID is a valid number: ${process.env.GETEPAY_MID}`);
  } else {
    logWarning('GETEPAY_MID should typically be a numeric value');
  }
}

// Terminal ID validation
if (process.env.GETEPAY_TERMINAL_ID) {
  if (process.env.GETEPAY_TERMINAL_ID.includes('getepay.merchant')) {
    logSuccess(`GETEPAY_TERMINAL_ID format looks correct`);
  } else {
    logWarning('GETEPAY_TERMINAL_ID format might be incorrect. Expected pattern: getepay.merchantXXXXXX@bank');
  }
}

// Key validation (should be Base64)
if (process.env.GETEPAY_KEY) {
  try {
    const keyBuffer = Buffer.from(process.env.GETEPAY_KEY, 'base64');
    if (keyBuffer.length === 32) {
      logSuccess('GETEPAY_KEY is valid Base64 (32 bytes when decoded - AES-256)');
    } else if (keyBuffer.length > 0) {
      logWarning(`GETEPAY_KEY decodes to ${keyBuffer.length} bytes. Expected 32 bytes for AES-256`);
    } else {
      logError('GETEPAY_KEY is not valid Base64');
    }
  } catch (e) {
    logError('GETEPAY_KEY is not valid Base64 encoding');
  }
}

// IV validation (can be Base64 or Terminal ID)
if (process.env.GETEPAY_IV) {
  const ivValue = process.env.GETEPAY_IV;
  
  // Check if it's Base64
  let isValidBase64 = false;
  try {
    const ivBuffer = Buffer.from(ivValue, 'base64');
    if (Buffer.from(ivBuffer).toString('base64') === ivValue && ivBuffer.length === 16) {
      isValidBase64 = true;
      logSuccess('GETEPAY_IV is valid Base64 (16 bytes - perfect for AES-CBC)');
    }
  } catch (e) {
    // Not Base64
  }
  
  // If not Base64, check if it looks like Terminal ID (acceptable fallback)
  if (!isValidBase64) {
    if (ivValue.includes('getepay.merchant')) {
      logWarning('GETEPAY_IV appears to be a Terminal ID (not Base64)');
      logInfo('System will use MD5 hash of Terminal ID as IV (acceptable fallback)');
      
      // Show what the MD5 hash would be
      const md5Iv = crypto.createHash('md5').update(ivValue).digest('hex');
      console.log(`   MD5 hash of Terminal ID: ${md5Iv}`);
    } else {
      logError('GETEPAY_IV is neither valid Base64 nor a Terminal ID format');
    }
  }
}

// ============================================
// 4. Test Encryption (Dry Run)
// ============================================
logSection('4. Testing Encryption Configuration');

try {
  const GetEpayEncryption = require('./src/utils/getepayEncryptProduction');
  
  const enc = new GetEpayEncryption(
    process.env.GETEPAY_IV,
    process.env.GETEPAY_KEY,
    process.env.NODE_ENV === 'production'
  );
  
  const testData = JSON.stringify({ test: 'data', amount: '100.00' });
  
  // Test encryption
  const encrypted = enc.encrypt(testData);
  logSuccess('Encryption test passed');
  console.log(`   Sample encrypted length: ${encrypted.length} chars`);
  
  // Test decryption
  const decrypted = enc.decrypt(encrypted);
  const decryptedObj = JSON.parse(decrypted);
  
  if (decryptedObj.test === 'data' && decryptedObj.amount === '100.00') {
    logSuccess('Decryption test passed - round-trip successful');
  } else {
    logError('Decryption produced unexpected data');
  }
  
} catch (error) {
  logError(`Encryption/Decryption test failed: ${error.message}`);
  logInfo('This usually means GETEPAY_KEY or GETEPAY_IV is incorrect');
}

// ============================================
// 5. Network Connectivity Test
// ============================================
logSection('5. Testing Network Connectivity');

const https = require('https');
const url = require('url');

if (process.env.GETEPAY_URL) {
  const parsedUrl = url.parse(process.env.GETEPAY_URL);
  
  console.log(`Testing connection to: ${parsedUrl.hostname}:${parsedUrl.port || 443}`);
  
  const req = https.request({
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: '/',
    method: 'HEAD',
    timeout: 10000
  }, (res) => {
    logSuccess(`Gateway server is reachable (${res.statusCode})`);
  });
  
  req.on('error', (error) => {
    if (error.code === 'ECONNREFUSED') {
      logError(`Cannot connect to gateway. Server may be down or firewall blocking.`);
    } else if (error.code === 'ETIMEDOUT') {
      logError(`Connection timed out. Check network/firewall settings.`);
    } else {
      logWarning(`Connection test failed: ${error.code} - ${error.message}`);
      logInfo('This may be normal if server requires specific request format');
    }
  });
  
  req.on('timeout', () => {
    req.destroy();
    logError('Connection test timed out after 10 seconds');
  });
  
  req.end();
}

// ============================================
// 6. Environment Summary
// ============================================
logSection('6. Environment Summary');

logInfo(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
logInfo(`Current working directory: ${process.cwd()}`);

// Show masked credentials for verification
if (process.env.GETEPAY_MID) {
  console.log(`MID: ${process.env.GETEPAY_MID}`);
}
if (process.env.GETEPAY_TERMINAL_ID) {
  console.log(`Terminal ID: ${process.env.GETEPAY_TERMINAL_ID}`);
}
if (process.env.GETEPAY_KEY) {
  const key = process.env.GETEPAY_KEY;
  const masked = key.substring(0, 8) + '...' + key.substring(key.length - 4);
  console.log(`Key: ${masked}`);
}
if (process.env.GETEPAY_IV) {
  const iv = process.env.GETEPAY_IV;
  const masked = iv.length > 20 ? iv.substring(0, 10) + '...' + iv.substring(iv.length - 5) : '***';
  console.log(`IV: ${masked}`);
}
console.log(`URL: ${process.env.GETEPAY_URL || 'not set'}`);

// ============================================
// Final Report
// ============================================
setTimeout(() => {
  console.log('\n' + '='.repeat(60));
  logSection('Validation Report');
  
  if (hasErrors) {
    console.log(`${colors.red}❌ VALIDATION FAILED${colors.reset}`);
    console.log('\nPlease fix the errors above before deploying to production.');
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ VALIDATION PASSED${colors.reset}`);
    console.log('\nYour GetEpay configuration appears to be correctly set up.');
    
    if (warnings.length > 0) {
      console.log(`\n${colors.yellow}Warnings (${warnings.length}):${colors.reset}`);
      warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    console.log('\nNext steps:');
    console.log('1. Test with a small payment amount first');
    console.log('2. Monitor logs during payment generation');
    console.log('3. Verify callback and return URLs work correctly');
    console.log('4. Keep this validator updated as configuration changes');
  }
  
  console.log('='.repeat(60) + '\n');
}, 2000);
