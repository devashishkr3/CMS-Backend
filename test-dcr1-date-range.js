/**
 * Test Script for DCR1 Date Range Report API
 * Tests all new endpoints including date range filtering and CSV export
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:8080';
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-jwt-token-here';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results tracking
let passedTests = 0;
let failedTests = 0;

/**
 * Helper function to make authenticated requests
 */
async function makeRequest(endpoint, params = {}) {
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      responseType: params.format === 'csv' ? 'arraybuffer' : 'json'
    });
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status 
    };
  }
}

/**
 * Test helper
 */
function runTest(name, condition, details = '') {
  if (condition) {
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    if (details) console.log(`  ${colors.cyan}${details}${colors.reset}`);
    passedTests++;
  } else {
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    if (details) console.log(`  ${colors.yellow}${details}${colors.reset}`);
    failedTests++;
  }
}

/**
 * Test 1: Get Today's Collection
 */
async function testTodayCollection() {
  console.log(`\n${colors.blue}=== Test 1: Today's Collection ===${colors.reset}`);
  
  const result = await makeRequest('/api/v1/payments/dcr1-report/today');
  
  if (result.success) {
    runTest('Status code is 200', result.status === 200);
    runTest('Response has success status', result.data.status === 'success');
    runTest('Today data exists', !!result.data.data.today);
    
    if (result.data.data.today) {
      const today = result.data.data.today;
      runTest('Amount is a number', typeof today.amount === 'number', `Amount: ₹${today.amount}`);
      runTest('Count is a number', typeof today.count === 'number', `Count: ${today.count}`);
      runTest('Date exists', !!today.date);
    }
  } else {
    runTest('Request failed', false, result.error?.message || JSON.stringify(result.error));
  }
}

/**
 * Test 2: Get Month's Collection
 */
async function testMonthCollection() {
  console.log(`\n${colors.blue}=== Test 2: Month's Collection ===${colors.reset}`);
  
  const result = await makeRequest('/api/v1/payments/dcr1-report/month');
  
  if (result.success) {
    runTest('Status code is 200', result.status === 200);
    runTest('Response has success status', result.data.status === 'success');
    runTest('Month data exists', !!result.data.data.month);
    
    if (result.data.data.month) {
      const month = result.data.data.month;
      runTest('Amount is a number', typeof month.amount === 'number', `Amount: ₹${month.amount}`);
      runTest('Count is a number', typeof month.count === 'number', `Count: ${month.count}`);
      runTest('Month name exists', !!month.monthName, `Month: ${month.monthName}`);
      runTest('Year exists', !!month.year, `Year: ${month.year}`);
    }
  } else {
    runTest('Request failed', false, result.error?.message || JSON.stringify(result.error));
  }
}

/**
 * Test 3: Date Range Report (JSON format)
 */
async function testDateRangeJSON() {
  console.log(`\n${colors.blue}=== Test 3: Date Range Report (JSON) ===${colors.reset}`);
  
  // Calculate last 7 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  const result = await makeRequest('/api/v1/payments/dcr1-report/date-range', {
    startDate: startStr,
    endDate: endStr
  });
  
  if (result.success) {
    runTest('Status code is 200', result.status === 200);
    runTest('Response has success status', result.data.status === 'success');
    runTest('Report data exists', !!result.data.data.report);
    
    if (result.data.data.report) {
      const report = result.data.data.report;
      runTest('Report type exists', report.reportType === 'DCR1 - Date Range Collection Report');
      runTest('Date range info exists', !!report.dateRange);
      runTest('Summary exists', !!report.summary);
      runTest('Statistics exist', !!report.statistics);
      runTest('Transactions array exists', Array.isArray(report.transactions));
      runTest('Download link exists', !!report.downloadLinks?.csv);
      
      if (report.statistics) {
        runTest('Total transactions is a number', typeof report.statistics.totalTransactions === 'number');
        runTest('Average transaction value exists', typeof report.statistics.averageTransactionValue === 'number');
      }
      
      console.log(`\n${colors.cyan}Report Summary:${colors.reset}`);
      console.log(`  Period: ${report.dateRange?.formattedRange}`);
      console.log(`  Total Transactions: ${report.statistics?.totalTransactions}`);
      console.log(`  Total Amount: ₹${report.summary?.totalCollection?.amount}`);
      console.log(`  Average Transaction: ₹${report.statistics?.averageTransactionValue}`);
    }
  } else {
    runTest('Request failed', false, result.error?.message || JSON.stringify(result.error));
  }
}

/**
 * Test 4: Date Range Report (CSV format)
 */
async function testDateRangeCSV() {
  console.log(`\n${colors.blue}=== Test 4: Date Range Report (CSV) ===${colors.reset}`);
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  const result = await makeRequest('/api/v1/payments/dcr1-report/date-range', {
    startDate: startStr,
    endDate: endStr,
    format: 'csv'
  });
  
  if (result.success) {
    runTest('Status code is 200', result.status === 200);
    runTest('Response is buffer/arraybuffer', result.data instanceof ArrayBuffer || Buffer.isBuffer(result.data));
    
    // Try to convert to string and check CSV structure
    const csvString = Buffer.isBuffer(result.data) 
      ? result.data.toString('utf8') 
      : new TextDecoder().decode(result.data);
    
    runTest('CSV has content', csvString.length > 0, `CSV size: ${csvString.length} bytes`);
    runTest('CSV has headers', csvString.includes('Transaction ID'));
    runTest('CSV has data rows', csvString.split('\n').length > 1);
    
    console.log(`\n${colors.cyan}CSV Preview (first 500 chars):${colors.reset}`);
    console.log(csvString.substring(0, 500) + '...');
  } else {
    runTest('Request failed', false, result.error?.message || JSON.stringify(result.error));
  }
}

/**
 * Test 5: Invalid Date Format
 */
async function testInvalidDateFormat() {
  console.log(`\n${colors.blue}=== Test 5: Invalid Date Format ===${colors.reset}`);
  
  const result = await makeRequest('/api/v1/payments/dcr1-report/date-range', {
    startDate: '01-03-2026', // Wrong format
    endDate: '07-03-2026'
  });
  
  runTest('Should return 400 error', result.status === 400);
  runTest('Error message mentions date format', 
    result.error?.message?.includes('date') || result.error?.message?.includes('format'),
    result.error?.message || 'No error message'
  );
}

/**
 * Test 6: Start Date After End Date
 */
async function testInvalidDateRange() {
  console.log(`\n${colors.blue}=== Test 6: Start Date After End Date ===${colors.reset}`);
  
  const result = await makeRequest('/api/v1/payments/dcr1-report/date-range', {
    startDate: '2026-03-07',
    endDate: '2026-03-01'
  });
  
  runTest('Should return 400 error', result.status === 400);
  runTest('Error message mentions date order', 
    result.error?.message?.includes('after') || result.error?.message?.includes('before'),
    result.error?.message || 'No error message'
  );
}

/**
 * Test 7: Date Range Exceeds 365 Days
 */
async function testDateRangeTooLong() {
  console.log(`\n${colors.blue}=== Test 7: Date Range Exceeds 365 Days ===${colors.reset}`);
  
  const result = await makeRequest('/api/v1/payments/dcr1-report/date-range', {
    startDate: '2025-01-01',
    endDate: '2026-12-31'
  });
  
  runTest('Should return 400 error', result.status === 400);
  runTest('Error message mentions max range', 
    result.error?.message?.includes('365') || result.error?.message?.includes('exceed'),
    result.error?.message || 'No error message'
  );
}

/**
 * Test 8: Unauthorized Access
 */
async function testUnauthorized() {
  console.log(`\n${colors.blue}=== Test 8: Unauthorized Access ===${colors.reset}`);
  
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/payments/dcr1-report/today`, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });
    runTest('Should reject invalid token', false, 'Request succeeded with invalid token');
  } catch (error) {
    runTest('Should return 401/403 error', 
      error.response?.status === 401 || error.response?.status === 403);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║  DCR1 Date Range Report API - Test Suite          ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.yellow}Note: Set TEST_TOKEN environment variable with a valid JWT token${colors.reset}\n`);
  
  await testTodayCollection();
  await testMonthCollection();
  await testDateRangeJSON();
  await testDateRangeCSV();
  await testInvalidDateFormat();
  await testInvalidDateRange();
  await testDateRangeTooLong();
  await testUnauthorized();
  
  // Summary
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║  Test Summary                                       ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`Total:  ${passedTests + failedTests}\n`);
  
  if (failedTests === 0) {
    console.log(`${colors.green}🎉 All tests passed!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠️  Some tests failed. Please review the output above.${colors.reset}\n`);
  }
}

// Run tests
runAllTests().catch(console.error);
