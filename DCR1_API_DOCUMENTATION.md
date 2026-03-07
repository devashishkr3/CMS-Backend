# DCR1 (Daily Collection Report) API Documentation

## Overview
The DCR1 (Daily Collection Report) API provides comprehensive admission payment collection statistics and details. This report is essential for administrative and accounting purposes to track daily, monthly, and total admission fee collections.

---

## Endpoint Details

### **Get DCR1 Report**

**Endpoint:** `GET /api/v1/payments/dcr1-report`

**Authentication Required:** Yes  
**Authorization Roles:** ADMIN, ACCOUNTANT  
**HTTP Method:** GET

---

## Request

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Query Parameters
None (Returns current day's report by default)

---

## Response Structure

### Success Response (200 OK)

```json
{
  "status": "success",
  "message": "DCR1 report generated successfully",
  "data": {
    "report": {
      "reportDate": "2026-03-07T12:30:45.123Z",
      "reportType": "DCR1 - Daily Collection Report",
      "summary": {
        "totalCollection": {
          "amount": 1250000.00,
          "count": 150,
          "period": "All Time"
        },
        "monthCollection": {
          "amount": 450000.00,
          "count": 45,
          "period": "March 2026",
          "startDate": "2026-03-01T00:00:00.000Z",
          "endDate": "2026-03-07T12:30:45.123Z"
        },
        "todayCollection": {
          "amount": 75000.00,
          "count": 8,
          "period": "Today",
          "date": "2026-03-07T00:00:00.000Z"
        }
      },
      "details": {
        "todayPayments": [
          {
            "id": "payment-uuid-here",
            "studentId": "student-uuid-here",
            "admissionId": "admission-uuid-here",
            "totalAmount": 15000.00,
            "status": "SUCCESS",
            "gateway": "GETEPAY",
            "txnId": "TXN123456789",
            "referenceNo": "REF987654321",
            "bankTxnNo": "BANK123456",
            "receiptNo": "RCT-1234567890-123",
            "receiptUrl": "https://storage.example.com/receipts/...",
            "createdAt": "2026-03-07T10:15:30.000Z",
            "student": {
              "id": "student-uuid-here",
              "name": "John Doe",
              "reg_no": "REG-2026-001",
              "email": "john.doe@example.com"
            },
            "admission": {
              "id": "admission-uuid-here",
              "admissionNo": "ADM-2026-001",
              "course": {
                "id": "course-uuid-here",
                "name": "Bachelor of Science",
                "code": "BSC"
              }
            },
            "breakups": [
              {
                "id": "breakup-uuid-here",
                "paymentId": "payment-uuid-here",
                "head": "TUITION",
                "amount": 12000.00
              },
              {
                "id": "breakup-uuid-here",
                "paymentId": "payment-uuid-here",
                "head": "INFRASTRUCTURE",
                "amount": 2000.00
              },
              {
                "id": "breakup-uuid-here",
                "paymentId": "payment-uuid-here",
                "head": "MISC",
                "amount": 1000.00
              }
            ]
          }
        ],
        "monthPayments": [
          // Similar structure as todayPayments
          // Limited to recent 100 transactions
        ]
      }
    }
  }
}
```

---

## Response Fields Description

### Summary Section

#### totalCollection
- **amount** (Decimal): Total amount collected from all admission payments (all-time)
- **count** (Integer): Total number of successful admission payment transactions
- **period** (String): Always "All Time"

#### monthCollection
- **amount** (Decimal): Total amount collected in the current month
- **count** (Integer): Number of successful admission payment transactions in current month
- **period** (String): Current month and year (e.g., "March 2026")
- **startDate** (DateTime): ISO timestamp of the first day of current month
- **endDate** (DateTime): ISO timestamp of current date/time

#### todayCollection
- **amount** (Decimal): Total amount collected today (since midnight)
- **count** (Integer): Number of successful admission payment transactions today
- **period** (String): Always "Today"
- **date** (DateTime): ISO timestamp of today's date (midnight)

### Details Section

#### todayPayments
Array of all successful admission payment transactions made today with complete details including:
- Payment information (ID, amount, gateway, transaction IDs, etc.)
- Student details (name, registration number, email)
- Admission details (admission number, course information)
- Payment breakup (fee head-wise breakdown)

#### monthPayments
Array of recent successful admission payment transactions made in the current month (limited to 100 most recent):
- Same structure as todayPayments
- Ordered by creation date (descending)

---

## Key Features

### 1. **Time-Based Filtering**
- **Today**: From midnight of current day to current time
- **Month**: From 1st day of current month to current time
- **All Time**: All successful admission payments since inception

### 2. **Payment Status Filtering**
- Only includes payments with status = 'SUCCESS'
- Excludes PENDING, FAILED, INITIATED, and REFUNDED payments

### 3. **Admission-Linked Payments Only**
- Only counts payments where admissionId is not null
- Excludes standalone student payments (e.g., exam fees, certificate fees)

### 4. **Detailed Transaction Information**
- Complete payment details with gateway information
- Student identification and contact details
- Admission and course information
- Fee head-wise breakup (Tuition, Infrastructure, etc.)

### 5. **Performance Optimization**
- Month payments limited to 100 most recent transactions
- Efficient database queries using Prisma ORM aggregates

---

## Usage Examples

### cURL Example
```bash
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### JavaScript (Frontend) Example
```javascript
const getDCR1Report = async () => {
  try {
    const response = await fetch('http://localhost:8080/api/v1/payments/dcr1-report', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch DCR1 report');
    }
    
    const data = await response.json();
    console.log('DCR1 Report:', data.data.report);
    
    // Access summary data
    const summary = data.data.report.summary;
    console.log('Today Collection:', summary.todayCollection.amount);
    console.log('Month Collection:', summary.monthCollection.amount);
    console.log('Total Collection:', summary.totalCollection.amount);
    
  } catch (error) {
    console.error('Error fetching DCR1 report:', error);
  }
};
```

### Node.js (Backend) Example
```javascript
const axios = require('axios');

async function fetchDCR1Report() {
  try {
    const response = await axios.get(
      'http://localhost:8080/api/v1/payments/dcr1-report',
      {
        headers: {
          'Authorization': `Bearer ${process.env.JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const report = response.data.data.report;
    console.log('DCR1 Report Summary:');
    console.log('- Today: ₹', report.summary.todayCollection.amount);
    console.log('- This Month: ₹', report.summary.monthCollection.amount);
    console.log('- Total: ₹', report.summary.totalCollection.amount);
    
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
  }
}
```

---

## Error Responses

### 401 Unauthorized - Missing or Invalid Token
```json
{
  "status": "error",
  "message": "Not authenticated"
}
```

### 403 Forbidden - Insufficient Permissions
```json
{
  "status": "error",
  "message": "You do not have permission to access this resource"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Error message here"
}
```

---

## Implementation Details

### Database Queries

The endpoint uses Prisma ORM to perform aggregate queries on the Payment model:

1. **Total Collection Query**
   - Filters: status = 'SUCCESS', admissionId != null
   - Aggregates: SUM(totalAmount), COUNT(*)

2. **Month Collection Query**
   - Filters: status = 'SUCCESS', admissionId != null
   - Date range: 1st of current month to now
   - Aggregates: SUM(totalAmount), COUNT(*)

3. **Today Collection Query**
   - Filters: status = 'SUCCESS', admissionId != null
   - Date range: Midnight today to now
   - Aggregates: SUM(totalAmount), COUNT(*)

4. **Detail Queries**
   - Fetch complete payment records with related student, admission, course, and breakup data
   - Ordered by createdAt descending
   - Month details limited to 100 records for performance

### Time Zone Handling
- All date calculations use server's local timezone
- Start of day calculated as midnight (00:00:00)
- Timestamps returned in ISO 8601 format

---

## Security Considerations

1. **Role-Based Access Control**
   - Only ADMIN and ACCOUNTANT roles can access this endpoint
   - HOD role does not have access (financial data restriction)

2. **Authentication Required**
   - Valid JWT token must be provided in Authorization header
   - Token is validated and decoded by auth middleware

3. **Data Sensitivity**
   - Contains financial transaction data
   - Includes student personal information
   - Should be transmitted over HTTPS only in production

---

## Performance Notes

- Aggregate queries are optimized using Prisma's native aggregation
- Indexes on Payment table recommended for:
  - status
  - admissionId
  - createdAt
- Response size may be large if many transactions occur in a day
- Month payments limited to 100 records to prevent excessive payload

---

## Testing

### Test Scenarios

1. **Empty Data Test**
   - No payments today
   - Should return zero amounts and empty arrays

2. **Single Transaction Test**
   - One successful admission payment today
   - Verify amount and count match

3. **Multiple Transactions Test**
   - Multiple successful payments
   - Verify aggregation accuracy

4. **Mixed Status Test**
   - Include SUCCESS, FAILED, PENDING payments
   - Only SUCCESS should be counted

5. **Non-Admission Payments Test**
   - Include payments without admissionId
   - Should be excluded from report

---

## Future Enhancements

Potential improvements for future versions:

1. **Date Range Selection**
   - Allow custom date ranges via query parameters
   - Example: ?from=2026-03-01&to=2026-03-31

2. **Course/Department Filtering**
   - Filter by specific courses or departments
   - Example: ?courseId=xxx&departmentId=yyy

3. **Export Functionality**
   - PDF export of DCR1 report
   - Excel/CSV export for accounting

4. **Historical Reports**
   - Generate reports for past dates
   - Compare day-over-day, month-over-month trends

5. **Real-time Updates**
   - WebSocket support for live collection updates
   - Dashboard integration

---

## Related Endpoints

- **Get Payment Stats**: `/api/v1/payments/stats` - General payment statistics
- **Get All Payments**: `/api/v1/payments/` - List all payments with filters
- **Get Payment By ID**: `/api/v1/payments/:id` - Specific payment details

---

## Support

For issues or questions regarding this API endpoint, contact the development team or refer to the main API documentation.
