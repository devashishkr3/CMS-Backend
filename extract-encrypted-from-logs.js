/**
 * Extract Encrypted Request from PM2 Logs
 * 
 * This script reads PM2 logs and extracts the encrypted request
 * Useful for debugging or sharing with developer
 * 
 * Usage: node extract-encrypted-from-logs.js [paymentId]
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Extracting Encrypted Request from PM2 Logs\n');
console.log('=' .repeat(60));

// PM2 log file path
const logFilePath = '/root/.pm2/logs/cms-backend-out.log';

// Check if running locally (for testing)
const testLogPath = './test-payment-log.txt';

let logFileToUse = logFilePath;
if (!fs.existsSync(logFilePath)) {
  console.log(`⚠️  Production log not found at ${logFilePath}`);
  
  if (fs.existsSync(testLogPath)) {
    console.log(`✅ Using test log file: ${testLogPath}`);
    logFileToUse = testLogPath;
  } else {
    console.log('\n❌ No log file found.');
    console.log('\n💡 Options:');
    console.log('1. Run on production server where PM2 logs exist');
    console.log('2. Create test-payment-log.txt with sample log data');
    console.log('3. Use generate-encrypted-request.js instead');
    process.exit(1);
  }
}

// Read log file
try {
  const logContent = fs.readFileSync(logFileToUse, 'utf8');
  const lines = logContent.split('\n');
  
  console.log(`📄 Read ${lines.length} lines from log file\n`);
  
  // Find recent payment generation attempts
  const paymentAttempts = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for "Generating payment link" marker
    if (line.includes('Generating payment link for payment:')) {
      const paymentIdMatch = line.match(/Generating payment link for payment: ([\w-]+)/);
      if (paymentIdMatch) {
        paymentAttempts.push({
          paymentId: paymentIdMatch[1],
          lineIndex: i,
          timestamp: line.match(/^\d+\|[\w-]+\|(.+)/)?.[1] || 'Unknown'
        });
      }
    }
  }
  
  console.log(`📊 Found ${paymentAttempts.length} payment generation attempt(s)\n`);
  
  if (paymentAttempts.length === 0) {
    console.log('❌ No payment generation attempts found in logs');
    console.log('\n💡 Try:');
    console.log('1. Generate a test payment first');
    console.log('2. Wait a few seconds for logs to be written');
    console.log('3. Check correct log file path');
    process.exit(1);
  }
  
  // Show recent attempts
  console.log('Recent payment attempts:');
  paymentAttempts.slice(-5).forEach((attempt, idx) => {
    console.log(`${idx + 1}. Payment ID: ${attempt.paymentId}`);
    console.log(`   At: ${attempt.timestamp}`);
  });
  console.log('');
  
  // Analyze the most recent attempt
  const latestAttempt = paymentAttempts[paymentAttempts.length - 1];
  console.log(`🔍 Analyzing latest attempt: ${latestAttempt.paymentId}\n`);
  
  // Extract relevant log lines
  const startIndex = latestAttempt.lineIndex;
  const endIndex = Math.min(startIndex + 50, lines.length);
  const relevantLines = lines.slice(startIndex, endIndex);
  
  let encryptedRequest = null;
  let fullJsonSent = null;
  let apiResponse = null;
  let errorFound = null;
  
  for (let i = 0; i < relevantLines.length; i++) {
    const line = relevantLines[i];
    
    // Look for FULL ENCRYPTED REQUEST marker
    if (line.includes('[DEBUG] FULL ENCRYPTED REQUEST')) {
      // Next line should have the encrypted string
      if (i + 1 < relevantLines.length) {
        encryptedRequest = relevantLines[i + 1].trim();
      }
    }
    
    // Look for Complete JSON to send
    if (line.includes('[DEBUG] Complete JSON to send:')) {
      // Parse multi-line JSON
      let jsonStr = '';
      let braceCount = 0;
      let started = false;
      
      for (let j = i; j < relevantLines.length; j++) {
        const jsonLine = relevantLines[j];
        jsonStr += jsonLine + '\n';
        
        if (jsonLine.includes('{')) started = true;
        if (started) {
          braceCount += (jsonLine.match(/{/g) || []).length;
          braceCount -= (jsonLine.match(/}/g) || []).length;
          
          if (braceCount === 0 && started) {
            break;
          }
        }
      }
      
      try {
        fullJsonSent = JSON.parse(jsonStr.substring(jsonStr.indexOf('{')));
      } catch (e) {
        // Failed to parse
      }
    }
    
    // Look for API response
    if (line.includes('GetEpay API response status:')) {
      const statusMatch = line.match(/status: (\d+)/);
      if (statusMatch) {
        apiResponse = apiResponse || {};
        apiResponse.status = statusMatch[1];
      }
    }
    
    if (line.includes('Complete Response data:')) {
      // Try to parse response
      let responseStr = '';
      let braceCount = 0;
      let started = false;
      
      for (let j = i; j < relevantLines.length; j++) {
        const respLine = relevantLines[j];
        responseStr += respLine + '\n';
        
        if (respLine.includes('{')) started = true;
        if (started) {
          braceCount += (respLine.match(/{/g) || []).length;
          braceCount -= (respLine.match(/}/g) || []).length;
          
          if (braceCount === 0 && started) {
            break;
          }
        }
      }
      
      try {
        apiResponse.data = JSON.parse(responseStr.substring(responseStr.indexOf('{')));
      } catch (e) {
        // Failed to parse
      }
    }
    
    // Look for errors
    if (line.includes('Error') || line.includes('FAILED')) {
      errorFound = line.trim();
    }
  }
  
  // Display results
  console.log('=' .repeat(60));
  console.log('📦 EXTRACTED DATA');
  console.log('=' .repeat(60));
  
  if (encryptedRequest) {
    console.log('\n✅ ENCRYPTED REQUEST FOUND:');
    console.log('Length:', encryptedRequest.length, 'characters');
    console.log('\nFirst 200 characters:');
    console.log(encryptedRequest.substring(0, 200) + '...');
    console.log('\nFull encrypted string saved to: ./extracted-encrypted-request.txt');
    
    // Save to file
    fs.writeFileSync('./extracted-encrypted-request.txt', encryptedRequest);
  } else {
    console.log('\n❌ Encrypted request not found in logs');
    console.log('Make sure debug logging is enabled in code');
  }
  
  if (fullJsonSent) {
    console.log('\n✅ COMPLETE JSON SENT:');
    console.log(JSON.stringify(fullJsonSent, null, 2));
    
    fs.writeFileSync(
      './extracted-full-json.json',
      JSON.stringify(fullJsonSent, null, 2)
    );
    console.log('Saved to: ./extracted-full-json.json');
  }
  
  if (apiResponse) {
    console.log('\n✅ API RESPONSE:');
    console.log('HTTP Status:', apiResponse.status || 'N/A');
    if (apiResponse.data) {
      console.log('Response Data:', JSON.stringify(apiResponse.data, null, 2));
    }
    
    fs.writeFileSync(
      './extracted-api-response.json',
      JSON.stringify(apiResponse, null, 2)
    );
    console.log('Saved to: ./extracted-api-response.json');
  }
  
  if (errorFound) {
    console.log('\n❌ ERROR FOUND:');
    console.log(errorFound);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📁 Files Created:');
  console.log('- extracted-encrypted-request.txt (Encrypted payload)');
  console.log('- extracted-full-json.json (Complete request JSON)');
  console.log('- extracted-api-response.json (API response)');
  console.log('=' .repeat(60));
  
  console.log('\n💡 Share these files with your developer!\n');
  
} catch (error) {
  console.error('❌ Error reading logs:', error.message);
  process.exit(1);
}
