# DCR1 Date Range Report & CSV Export API Documentation

## Overview
Enhanced DCR1 (Daily Collection Report) API with custom date range filtering and CSV export functionality. This allows administrators and accountants to generate detailed collection reports for any date range (up to 365 days) and download them in CSV format for further analysis.

---

## New Endpoints

### 1. **Get DCR1 Report with Date Range**
**Endpoint:** `GET /api/v1/payments/dcr1-report/date-range`

**Authentication Required:** Yes  
**Authorization Roles:** ADMIN, ACCOUNTANT  
**HTTP Method:** GET

#### Query Parameters
| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| startDate | String | Yes      | Start date in ISO format (YYYY-MM-DD)    |
| endDate   | String | Yes      | End date in ISO format (YYYY-MM-DD)      |
| format    | String | No       | Response format: 'json' or 'csv' (default: 'json') |

#### Validation Rules
- Both dates must be in ISO format (YYYY-MM-DD)
- Start date cannot be after end date
- Maximum date range: 365 days (1 year)
- Dates are inclusive (include transactions on both start and end dates)

---

## Usage Examples

### Example 1: Get Report for Last 7 Days (JSON)
```bash
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-03-01&endDate=2026-03-07" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example 2: Download CSV Report for Last Month
```bash
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-02-01&endDate=2026-02-28&format=csv" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o "DCR1_February_2026.csv"
```

### Example 3: Get Yearly Report
```bash
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2025-04-01&endDate=2026-03-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Response Format (JSON)

### Success Response (200 OK)
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
          "amount": 450000.00,
          "count": 45,
          "period": "01/03/2026 to 07/03/2026",
          "startDate": "2026-03-01T00:00:00.000Z",
          "endDate": "2026-03-07T23:59:59.999Z"
        },
        "averageTransaction": {
          "amount": 10000.00,
          "description": "Average per transaction"
        }
      },
      "statistics": {
        "totalTransactions": 45,
        "successfulAmount": 450000.00,
        "averageTransactionValue": 10000.00,
        "highestTransaction": 25000.00,
        "lowestTransaction": 5000.00
      },
      "transactions": [
        {
          "id": "uuid",
          "txnId": "TXN123456",
          "receiptNo": "RCP2026001",
          "bankTxnNo": "BANK789",
          "totalAmount": 15000.00,
          "status": "SUCCESS",
          "gateway": "ePay",
          "student": {
            "id": "uuid",
            "name": "John Doe",
            "reg_no": "REG2025001",
            "email": "john@example.com"
          },
          "admission": {
            "id": "uuid",
            "admissionNo": "ADM2025001",
            "course": {
              "id": "uuid",
              "name": "BSc Computer Science",
              "code": "BSC-CS"
            }
          },
          "breakups": [
            {
              "head": "TUITION",
              "amount": 12000.00
            },
            {
              "head": "EXAM",
              "amount": 3000.00
            }
          ],
          "createdAt": "2026-03-05T14:30:00.000Z"
        }
      ],
      "downloadLinks": {
        "csv": "/api/v1/payments/dcr1-report/date-range?startDate=2026-03-01&endDate=2026-03-07&format=csv"
      }
    }
  }
}
```

---

## CSV Format

When `format=csv` is specified, the response is a downloadable CSV file with the following structure:

### CSV Columns
1. **Transaction ID** - Unique transaction identifier from payment gateway
2. **Receipt No** - College receipt number
3. **Bank Txn No** - Bank reference number (if available)
4. **Student Name** - Student's full name
5. **Student Reg No** - Student registration number
6. **Student Email** - Student email address
7. **Admission No** - Admission number
8. **Course Name** - Course name
9. **Course Code** - Course code
10. **Total Amount** - Transaction amount (₹)
11. **Payment Status** - Payment status
12. **Payment Gateway** - Payment gateway name
13. **Fee Breakup** - Fee head-wise breakdown
14. **Transaction Date** - Date and time of transaction (IST)
15. **Created At** - ISO timestamp

### Sample CSV Content
```csv
Transaction ID,Receipt No,Bank Txn No,Student Name,Student Reg No,Student Email,Admission No,Course Name,Course Code,Total Amount,Payment Status,Payment Gateway,Fee Breakup,Transaction Date,Created At
TXN123456,RCP2026001,BANK789,John Doe,REG2025001,john@example.com,ADM2025001,BSc Computer Science,BSC-CS,₹15000,SUCCESS,ePay,"TUITION: ₹12000 | EXAM: ₹3000",05/03/2026, 02:30:00 PM,2026-03-05T14:30:00.000Z
TXN123457,RCP2026002,BANK790,Jane Smith,REG2025002,jane@example.com,ADM2025002,BA Economics,BA-ECO,₹12000,SUCCESS,ePay,"TUITION: ₹10000 | EXAM: ₹2000",04/03/2026, 11:15:00 AM,2026-03-04T11:15:00.000Z
```

---

## Quick Collection Endpoints

### 2. **Get Today's Collection Summary**
**Endpoint:** `GET /api/v1/payments/dcr1-report/today`

**Authentication Required:** Yes  
**Authorization Roles:** ADMIN, ACCOUNTANT

#### Response
```json
{
  "status": "success",
  "data": {
    "today": {
      "amount": 75000.00,
      "count": 8,
      "date": "2026-03-07T00:00:00.000Z"
    }
  }
}
```

---

### 3. **Get Current Month's Collection Summary**
**Endpoint:** `GET /api/v1/payments/dcr1-report/month`

**Authentication Required:** Yes  
**Authorization Roles:** ADMIN, ACCOUNTANT

#### Response
```json
{
  "status": "success",
  "data": {
    "month": {
      "amount": 450000.00,
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

## Error Responses

### Invalid Date Format (400 Bad Request)
```json
{
  "status": "error",
  "message": "Invalid date format. Use ISO format (YYYY-MM-DD)"
}
```

### Start Date After End Date (400 Bad Request)
```json
{
  "status": "error",
  "message": "Start date cannot be after end date"
}
```

### Date Range Exceeds 365 Days (400 Bad Request)
```json
{
  "status": "error",
  "message": "Date range cannot exceed 365 days"
}
```

### Unauthorized Access (403 Forbidden)
```json
{
  "status": "error",
  "message": "You do not have permission to access this resource"
}
```

---

## Features

### 1. **Date Range Filtering**
- Custom start and end dates
- Flexible reporting periods (daily, weekly, monthly, yearly)
- Maximum 365 days per request for performance

### 2. **CSV Export**
- Downloadable CSV files with complete transaction details
- Includes all payment metadata, student info, and course details
- Fee breakup column shows head-wise breakdown
- Formatted timestamps in Indian Standard Time (IST)

### 3. **Comprehensive Statistics**
- Total collection amount and count
- Average transaction value
- Highest and lowest transaction amounts
- Complete transaction list with details

### 4. **Quick Endpoints**
- Today's collection summary
- Current month's collection summary
- Fast access to common metrics

---

## Use Cases

### Scenario 1: Daily Report
```bash
# Get today's report
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/today" \
  -H "Authorization: Bearer TOKEN"
```

### Scenario 2: Monthly Report with CSV Download
```bash
# Download monthly CSV
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-03-01&endDate=2026-03-31&format=csv" \
  -H "Authorization: Bearer TOKEN" \
  -o "March_2026_DCR1.csv"
```

### Scenario 3: Academic Year Report
```bash
# Get full academic year report
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2025-04-01&endDate=2026-03-31" \
  -H "Authorization: Bearer TOKEN"
```

### Scenario 4: Custom Period Analysis
```bash
# Get report for specific period (e.g., admission window)
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-05-01&endDate=2026-06-15" \
  -H "Authorization: Bearer TOKEN"
```

---

## Integration Examples

### Frontend (React/Vue/Angular)
```javascript
// Fetch date range report
const fetchDCR1Report = async (startDate, endDate, format = 'json') => {
  const response = await fetch(
    `/api/v1/payments/dcr1-report/date-range?startDate=${startDate}&endDate=${endDate}&format=${format}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  
  if (format === 'csv') {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DCR1_${startDate}_to_${endDate}.csv`;
    a.click();
  } else {
    const data = await response.json();
    return data.data.report;
  }
};

// Usage
fetchDCR1Report('2026-03-01', '2026-03-31', 'csv');
```

### Node.js Backend
```javascript
const axios = require('axios');

// Generate monthly report
async function generateMonthlyReport(year, month) {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
  
  try {
    const response = await axios.get(
      `${process.env.API_URL}/api/v1/payments/dcr1-report/date-range`,
      {
        params: { startDate, endDate },
        headers: {
          'Authorization': `Bearer ${process.env.JWT_TOKEN}`
        }
      }
    );
    
    console.log('Report:', response.data.data.report);
    return response.data.data.report;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
```

---

## Performance Considerations

### Database Optimization
- Queries use indexed fields (status, admissionId, createdAt)
- Aggregate queries for fast statistics
- Recommended index: `(status, admissionId, createdAt)`

### Response Time
- JSON responses: ~100-500ms for up to 1000 transactions
- CSV generation: ~200-800ms depending on data size
- Large date ranges (>6 months) may take 1-2 seconds

### Best Practices
1. **Use Quick Endpoints** for dashboard widgets (today, month)
2. **Cache Frequently Accessed Reports** (e.g., current month)
3. **Download CSV for Large Datasets** instead of viewing JSON
4. **Limit Date Ranges** to necessary periods only

---

## Security

### Access Control
- Only ADMIN and ACCOUNTANT roles can access
- JWT token required in Authorization header
- All requests are authenticated and authorized

### Data Protection
- Sensitive student data included only for authorized users
- CSV files are generated on-the-fly (not stored)
- No caching of financial data

---

## Testing

### Test Scenarios
1. **Valid date range (7 days)**
   ```bash
   curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-03-01&endDate=2026-03-07" \
     -H "Authorization: Bearer TOKEN"
   ```

2. **Invalid date format**
   ```bash
   curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=01-03-2026&endDate=07-03-2026" \
     -H "Authorization: Bearer TOKEN"
   # Expected: 400 Bad Request
   ```

3. **Start date after end date**
   ```bash
   curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-03-07&endDate=2026-03-01" \
     -H "Authorization: Bearer TOKEN"
   # Expected: 400 Bad Request
   ```

4. **Date range exceeds 365 days**
   ```bash
   curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2025-01-01&endDate=2026-12-31" \
     -H "Authorization: Bearer TOKEN"
   # Expected: 400 Bad Request
   ```

5. **CSV download**
   ```bash
   curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report/date-range?startDate=2026-03-01&endDate=2026-03-07&format=csv" \
     -H "Authorization: Bearer TOKEN" \
     -o "test.csv"
   # Expected: CSV file download
   ```

---

## Migration from Old DCR1

### Old Endpoint (Still Available)
```
GET /api/v1/payments/dcr1-report
```
- Returns current day's report only
- Fixed format (JSON only)

### New Endpoint (Recommended)
```
GET /api/v1/payments/dcr1-report/date-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```
- Custom date range
- CSV export option
- Enhanced statistics
- More flexible and powerful

---

## Support

For issues or questions:
1. Check date format (must be YYYY-MM-DD)
2. Verify user role (ADMIN or ACCOUNTANT)
3. Ensure date range ≤ 365 days
4. Review server logs for detailed errors

---

**Version**: 2.0  
**Last Updated**: March 7, 2026  
**Status**: Production Ready ✅
