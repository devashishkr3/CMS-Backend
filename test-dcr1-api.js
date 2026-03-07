/**
 * DCR1 API Test Script
 * 
 * This script tests the DCR1 (Daily Collection Report) API endpoint.
 * It verifies that the endpoint returns the expected data structure.
 * 
 * Usage:
 *   node test-dcr1-api.js
 * 
 * Prerequisites:
 *   1. Backend server running on http://localhost:8080
 *   2. Valid ADMIN or ACCOUNTANT JWT token
 *   3. Some test payment data in the database
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const DCR1_ENDPOINT = '/api/v1/payments/dcr1-report';

// You need to replace this with a valid token from your system
// Get token by logging in as ADMIN or ACCOUNTANT
const TEST_TOKEN = process.env.TEST_TOKEN || 'YOUR_JWT_TOKEN_HERE';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Test DCR1 API endpoint
 */
async function testDCR1API() {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.cyan}🧪 DCR1 API Test Suite${colors.reset}`);
  console.log('='.repeat(80) + '\n');

  // Check if token is set
  if (!TEST_TOKEN || TEST_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.log(`${colors.red}❌ Error: No test token provided${colors.reset}`);
    console.log(`\nPlease set the TEST_TOKEN environment variable or update the script:`);
    console.log(`  export TEST_TOKEN="your.jwt.token.h"`);
    console.log(`\nOr run with:`);
    console.log(`  TEST_TOKEN="your.jwt.token.h" node test-dcr1-api.js\n`);
    return;
  }

  try {
    console.log(`${colors.blue}📡 Sending request to: ${BASE_URL}${DCR1_ENDPOINT}${colors.reset}\n`);

    const response = await axios.get(`${BASE_URL}${DCR1_ENDPOINT}`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Test 1: Status Code
    console.log(`${colors.yellow}Test 1: HTTP Status Code${colors.reset}`);
    if (response.status === 200) {
      console.log(`${colors.green}✅ PASS: Status code is 200${colors.reset}\n`);
    } else {
      console.log(`${colors.red}❌ FAIL: Expected 200, got ${response.status}${colors.reset}\n`);
    }

    // Test 2: Response Structure
    console.log(`${colors.yellow}Test 2: Response Structure${colors.reset}`);
    const hasStatus = response.data.status === 'success';
    const hasMessage = typeof response.data.message === 'string';
    const hasData = typeof response.data.data === 'object';
    
    if (hasStatus && hasMessage && hasData) {
      console.log(`${colors.green}✅ PASS: Response structure is correct${colors.reset}`);
      console.log(`   - status: "${response.data.status}"`);
      console.log(`   - message: "${response.data.message}"`);
      console.log(`   - data: [object]\n`);
    } else {
      console.log(`${colors.red}❌ FAIL: Response structure is incorrect${colors.reset}`);
      console.log(`   - has status? ${hasStatus}`);
      console.log(`   - has message? ${hasMessage}`);
      console.log(`   - has data? ${hasData}\n`);
    }

    // Test 3: Report Structure
    console.log(`${colors.yellow}Test 3: Report Data Structure${colors.reset}`);
    const report = response.data.data?.report;
    
    if (report) {
      console.log(`${colors.green}✅ PASS: Report object exists${colors.reset}`);
      
      // Check report metadata
      console.log(`\n   ${colors.cyan}Report Metadata:${colors.reset}`);
      console.log(`   - Report Date: ${report.reportDate}`);
      console.log(`   - Report Type: ${report.reportType}`);
      
      // Check summary section
      console.log(`\n   ${colors.cyan}Summary Section:${colors.reset}`);
      const summary = report.summary;
      
      if (summary) {
        console.log(`${colors.green}   ✅ Summary exists${colors.reset}`);
        
        // Total Collection
        console.log(`\n   ${colors.blue}Total Collection (All-Time):${colors.reset}`);
        console.log(`      Amount: ₹${summary.totalCollection?.amount || 0}`);
        console.log(`      Count: ${summary.totalCollection?.count || 0}`);
        console.log(`      Period: ${summary.totalCollection?.period || 'N/A'}`);
        
        // Month Collection
        console.log(`\n   ${colors.blue}Month Collection:${colors.reset}`);
        console.log(`      Amount: ₹${summary.monthCollection?.amount || 0}`);
        console.log(`      Count: ${summary.monthCollection?.count || 0}`);
        console.log(`      Period: ${summary.monthCollection?.period || 'N/A'}`);
        console.log(`      Start: ${summary.monthCollection?.startDate || 'N/A'}`);
        console.log(`      End: ${summary.monthCollection?.endDate || 'N/A'}`);
        
        // Today Collection
        console.log(`\n   ${colors.blue}Today Collection:${colors.reset}`);
        console.log(`      Amount: ₹${summary.todayCollection?.amount || 0}`);
        console.log(`      Count: ${summary.todayCollection?.count || 0}`);
        console.log(`      Period: ${summary.todayCollection?.period || 'N/A'}`);
        console.log(`      Date: ${summary.todayCollection?.date || 'N/A'}`);
        
        // Validate amounts are numbers
        const totalValid = typeof summary.totalCollection?.amount === 'number';
        const monthValid = typeof summary.monthCollection?.amount === 'number';
        const todayValid = typeof summary.todayCollection?.amount === 'number';
        
        console.log(`\n   ${colors.cyan}Amount Validation:${colors.reset}`);
        if (totalValid && monthValid && todayValid) {
          console.log(`${colors.green}   ✅ All amounts are valid numbers${colors.reset}`);
        } else {
          console.log(`${colors.red}   ❌ Some amounts are not valid numbers${colors.reset}`);
        }
        
        // Validate counts are numbers
        const totalCountValid = typeof summary.totalCollection?.count === 'number';
        const monthCountValid = typeof summary.monthCollection?.count === 'number';
        const todayCountValid = typeof summary.todayCollection?.count === 'number';
        
        console.log(`\n   ${colors.cyan}Count Validation:${colors.reset}`);
        if (totalCountValid && monthCountValid && todayCountValid) {
          console.log(`${colors.green}   ✅ All counts are valid numbers${colors.reset}`);
        } else {
          console.log(`${colors.red}   ❌ Some counts are not valid numbers${colors.reset}`);
        }
        
      } else {
        console.log(`${colors.red}   ❌ Summary is missing${colors.reset}`);
      }
      
      // Check details section
      console.log(`\n   ${colors.cyan}Details Section:${colors.reset}`);
      const details = report.details;
      
      if (details) {
        console.log(`${colors.green}   ✅ Details exist${colors.reset}`);
        
        // Today's payments
        const todayPayments = details.todayPayments || [];
        console.log(`\n   ${colors.blue}Today's Payments:${colors.reset}`);
        console.log(`      Count: ${todayPayments.length} transactions`);
        
        if (todayPayments.length > 0) {
          console.log(`${colors.green}      ✅ Has today's transactions${colors.reset}`);
          console.log(`      Sample transaction:`);
          const sample = todayPayments[0];
          console.log(`        - Receipt: ${sample.receiptNo}`);
          console.log(`        - Student: ${sample.student?.name}`);
          console.log(`        - Amount: ₹${sample.totalAmount}`);
          console.log(`        - Course: ${sample.admission?.course?.name}`);
          
          // Verify breakup exists
          if (sample.breakups && sample.breakups.length > 0) {
            console.log(`        - Breakups: ${sample.breakups.length} heads`);
          }
        } else {
          console.log(`${colors.yellow}      ℹ️  No transactions today${colors.reset}`);
        }
        
        // Month payments
        const monthPayments = details.monthPayments || [];
        console.log(`\n   ${colors.blue}Month's Payments:${colors.reset}`);
        console.log(`      Count: ${monthPayments.length} transactions (max 100)`);
        
        if (monthPayments.length > 0) {
          console.log(`${colors.green}      ✅ Has month's transactions${colors.reset}`);
        } else {
          console.log(`${colors.yellow}      ℹ️  No transactions this month${colors.reset}`);
        }
        
      } else {
        console.log(`${colors.red}   ❌ Details are missing${colors.reset}`);
      }
      
    } else {
      console.log(`${colors.red}❌ FAIL: Report object is missing${colors.reset}`);
    }

    // Final Summary
    console.log('\n' + '='.repeat(80));
    console.log(`${colors.cyan}📊 Test Summary${colors.reset}`);
    console.log('='.repeat(80));
    console.log(`${colors.green}✅ All structural tests completed${colors.reset}`);
    console.log(`\nResponse received successfully!`);
    console.log(`Full response saved to: ./dcr1-response-${Date.now()}.json`);
    
    // Save full response to file
    const fs = require('fs');
    const filename = `dcr1-response-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(response.data, null, 2));
    console.log(`\n${colors.green}📄 Full response written to: ${filename}${colors.reset}`);
    
  } catch (error) {
    console.log(`${colors.red}❌ ERROR: Request failed${colors.reset}`);
    
    if (error.response) {
      console.log(`\n${colors.yellow}Server responded with error:${colors.reset}`);
      console.log(`Status: ${error.response.status}`);
      console.log(`Data:`, error.response.data);
      
      if (error.response.status === 401) {
        console.log(`\n${colors.red}⚠️  Authentication failed. Check your JWT token.${colors.reset}`);
      } else if (error.response.status === 403) {
        console.log(`\n${colors.red}⚠️  Authorization failed. User must be ADMIN or ACCOUNTANT.${colors.reset}`);
      }
    } else if (error.request) {
      console.log(`\n${colors.red}⚠️  No response received. Is the server running?${colors.reset}`);
      console.log(`Expected server at: ${BASE_URL}`);
    } else {
      console.log(`\n${colors.red}Error: ${error.message}${colors.reset}`);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// Run the test
testDCR1API();
