# DCR1 Date Range Report - Quick Reference Guide

## 📋 New Endpoints Summary

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/api/v1/payments/dcr1-report/date-range` | GET | Yes | ADMIN, ACCOUNTANT | Get report with custom date range + CSV export |
| `/api/v1/payments/dcr1-report/today` | GET | Yes | ADMIN, ACCOUNTANT | Quick today's collection summary |
| `/api/v1/payments/dcr1-report/month` | GET | Yes | ADMIN, ACCOUNTANT | Quick current month's collection summary |

---

## 🚀 Quick Start Examples

### 1. Today's Collection (Quick)
```bash
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/today" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "today": {
      "amount": 75000,
      "count": 8,
      "date": "2026-03-07T00:00:00.000Z"
    }
  }
}
```

---

### 2. Current Month Collection (Quick)
```bash
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/month" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "month": {
      "amount": 450000,
      "count": 45,
      "startDate": "2026-03-01T00:00:00.000Z",
      "endDate": "2026-03-31T23:59:59.999Z",
      "monthName": "March",
      "year": 2026
    }
  }
}
```

---

### 3. Custom Date Range (JSON)
```bash
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-03-01&endDate=2026-03-07" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Key Features:**
- ✅ Custom start and end dates
- ✅ Complete transaction details
- ✅ Statistics (avg, high, low)
- ✅ Download link for CSV

---

### 4. Download CSV Report
```bash
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-03-01&endDate=2026-03-31&format=csv" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o "March_2026_Report.csv"
```

**CSV Includes:**
- Transaction ID, Receipt No, Bank Txn No
- Student Name, Reg No, Email
- Admission No, Course Name, Course Code
- Total Amount, Payment Status, Gateway
- Fee Breakup (head-wise)
- Transaction Date (IST), Created At

---

## 📊 Response Structure (JSON)

```json
{
  "status": "success",
  "message": "DCR1 report generated for 7 days",
  "data": {
    "report": {
      "reportType": "DCR1 - Date Range Collection Report",
      "generatedAt": "2026-03-07T10:30:00.000Z",
      "dateRange": {
        "startDate": "2026-03-01T00:00:00.000Z",
        "endDate": "2026-03-07T23:59:59.999Z",
        "formattedRange": "01/03/2026 to 07/03/2026",
        "totalDays": 6
      },
      "summary": {
        "totalCollection": {
          "amount": 450000,
          "count": 45,
          "period": "01/03/2026 to 07/03/2026"
        },
        "averageTransaction": {
          "amount": 10000,
          "description": "Average per transaction"
        }
      },
      "statistics": {
        "totalTransactions": 45,
        "successfulAmount": 450000,
        "averageTransactionValue": 10000,
        "highestTransaction": 25000,
        "lowestTransaction": 5000
      },
      "transactions": [/* Array of payment details */],
      "downloadLinks": {
        "csv": "/api/v1/payments/dcr1-report/date-range?startDate=..."
      }
    }
  }
}
```

---

## ⚠️ Validation Rules

| Rule | Description | Error |
|------|-------------|-------|
| **Date Format** | Must be ISO format (YYYY-MM-DD) | "Invalid date format. Use ISO format (YYYY-MM-DD)" |
| **Date Order** | Start date ≤ End date | "Start date cannot be after end date" |
| **Max Range** | Maximum 365 days | "Date range cannot exceed 365 days" |
| **Authentication** | Valid JWT token required | 401 Unauthorized |
| **Authorization** | ADMIN or ACCOUNTANT role only | 403 Forbidden |

---

## 🔧 Common Use Cases

### Daily Report
```javascript
// Use quick endpoint
GET /api/v1/payments/dcr1-report/today
```

### Weekly Report
```javascript
// Last 7 days
const endDate = new Date().toISOString().split('T')[0];
const startDate = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];

GET /api/v1/payments/dcr1-report/date-range?startDate={startDate}&endDate={endDate}
```

### Monthly Report
```javascript
// Current month (1st to today)
const today = new Date();
const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
const endDate = today.toISOString().split('T')[0];

GET /api/v1/payments/dcr1-report/date-range?startDate={startDate}&endDate={endDate}&format=csv
```

### Academic Year Report
```javascript
// April 1 to March 31
GET /api/v1/payments/dcr1-report/date-range?startDate=2025-04-01&endDate=2026-03-31
```

### Admission Period Report
```javascript
// Specific admission window
GET /api/v1/payments/dcr1-report/date-range?startDate=2026-05-01&endDate=2026-06-15
```

---

## 💻 Frontend Integration

### React Example
```jsx
import React, { useState } from 'react';

function DCR1Report() {
  const [startDate, setStartDate] = useState('2026-03-01');
  const [endDate, setEndDate] = useState('2026-03-07');
  
  const downloadCSV = async () => {
    const token = localStorage.getItem('token');
    const url = `${API_URL}/api/v1/payments/dcr1-report/date-range?startDate=${startDate}&endDate=${endDate}&format=csv`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `DCR1_${startDate}_to_${endDate}.csv`;
    a.click();
  };
  
  return (
    <div>
      <input 
        type="date" 
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />
      <input 
        type="date" 
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
      />
      <button onClick={downloadCSV}>Download CSV</button>
    </div>
  );
}
```

### Vue.js Example
```vue
<template>
  <div>
    <input v-model="startDate" type="date" />
    <input v-model="endDate" type="date" />
    <button @click="downloadCSV">Download CSV</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      startDate: '2026-03-01',
      endDate: '2026-03-07'
    };
  },
  methods: {
    async downloadCSV() {
      const token = localStorage.getItem('token');
      const url = `${process.env.VUE_APP_API_URL}/api/v1/payments/dcr1-report/date-range?startDate=${this.startDate}&endDate=${this.endDate}&format=csv`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `DCR1_${this.startDate}_to_${this.endDate}.csv`;
      link.click();
    }
  }
};
</script>
```

---

## 🎯 Key Features

### ✨ Date Range Filtering
- **Flexible**: Any custom date range
- **Validated**: Ensures logical date order
- **Limited**: Max 365 days for performance
- **Inclusive**: Includes both start and end dates

### 📥 CSV Export
- **Complete**: All transaction details
- **Formatted**: Indian currency (₹), IST timestamps
- **Structured**: Organized columns for easy analysis
- **Downloadable**: Direct browser download

### 📈 Statistics
- **Total Collection**: Amount and count
- **Average Transaction**: Per-transaction average
- **Highest/Lowest**: Transaction extremes
- **Period Info**: Formatted date range

### ⚡ Quick Endpoints
- **Today**: Fast access to daily collection
- **Month**: Current month summary
- **Optimized**: Pre-calculated aggregates

---

## 🔍 Testing

### Run Test Suite
```bash
# Set your test token
export TEST_TOKEN="your-jwt-token-here"

# Run tests
node test-dcr1-date-range.js
```

### Manual Testing
```bash
# 1. Today's collection
curl http://localhost:8080/api/v1/payments/dcr1-report/today \
  -H "Authorization: Bearer TOKEN"

# 2. Month collection
curl http://localhost:8080/api/v1/payments/dcr1-report/month \
  -H "Authorization: Bearer TOKEN"

# 3. Date range (JSON)
curl "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-03-01&endDate=2026-03-07" \
  -H "Authorization: Bearer TOKEN"

# 4. Date range (CSV download)
curl "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-03-01&endDate=2026-03-07&format=csv" \
  -H "Authorization: Bearer TOKEN" \
  -o report.csv
```

---

## 🛠️ Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 400 Bad Request | Invalid date format | Use YYYY-MM-DD format |
| 400 Bad Request | Start > End date | Ensure start ≤ end |
| 400 Bad Request | Range > 365 days | Reduce date range |
| 401 Unauthorized | Missing/invalid token | Check Authorization header |
| 403 Forbidden | Wrong user role | Use ADMIN or ACCOUNTANT token |
| Empty results | No transactions in range | Try different date range |
| Slow response | Large date range | Use CSV format, reduce range |

---

## 📝 Files Modified/Created

### Created Files
1. `src/utils/dcr1ReportGenerator.js` - CSV generation utilities
2. `DCR1_DATE_RANGE_API.md` - Complete API documentation
3. `DCR1_QUICK_REFERENCE.md` - This quick reference
4. `test-dcr1-date-range.js` - Test suite

### Modified Files
1. `src/controllers/payment.controller.js` - Added 3 new controller functions
2. `src/routes/payment.routes.js` - Added 3 new routes
3. `src/validation/payment.validation.js` - Added date range validation schema

---

## 🎉 Success Criteria

✅ Can get today's collection with one click  
✅ Can get current month's collection instantly  
✅ Can generate reports for any custom date range  
✅ Can download CSV with all transaction details  
✅ Validates date formats and ranges properly  
✅ Returns comprehensive statistics  
✅ Works with ADMIN and ACCOUNTANT roles only  

---

**Version**: 2.0  
**Created**: March 7, 2026  
**Status**: Production Ready ✅  
**Test Coverage**: 8 test scenarios
