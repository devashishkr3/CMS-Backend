# DCR1 API Quick Reference Guide

## Endpoint Summary

```
GET /api/v1/payments/dcr1-report
```

## Authentication
- **Required**: Yes
- **Roles**: ADMIN, ACCOUNTANT only
- **Header**: `Authorization: Bearer <JWT_TOKEN>`

---

## What It Returns

The DCR1 report provides three key metrics:

### 1. Total Admission Payment Collection (All-Time)
- Sum of all SUCCESS payments linked to admissions
- Count of total admission payment transactions
- Period: Since inception to current date/time

### 2. This Month's Admission Payment Collection
- Sum of SUCCESS admission payments in current month
- Count of transactions in current month
- Period: 1st of current month to now

### 3. Today's Admission Payment Collection
- Sum of SUCCESS admission payments today
- Count of transactions today
- Period: Midnight today to current time

---

## Sample Response (Abbreviated)

```json
{
  "status": "success",
  "data": {
    "report": {
      "summary": {
        "totalCollection": {
          "amount": 1250000.00,
          "count": 150
        },
        "monthCollection": {
          "amount": 450000.00,
          "count": 45
        },
        "todayCollection": {
          "amount": 75000.00,
          "count": 8
        }
      },
      "details": {
        "todayPayments": [ ... ],
        "monthPayments": [ ... ]
      }
    }
  }
}
```

---

## Key Points

✅ Only counts SUCCESS payments  
✅ Only includes admission-linked payments (admissionId not null)  
✅ Today = midnight to now  
✅ Month = 1st to now  
✅ Month details limited to 100 recent transactions  

---

## Common Use Cases

### Dashboard Display
```javascript
// Fetch and display collection summary
const response = await fetch('/api/v1/payments/dcr1-report', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();

const today = data.data.report.summary.todayCollection;
const month = data.data.report.summary.monthCollection;
const total = data.data.report.summary.totalCollection;

console.log(`Today: ₹${today.amount} (${today.count} payments)`);
console.log(`Month: ₹${month.amount} (${month.count} payments)`);
console.log(`Total: ₹${total.amount} (${total.count} payments)`);
```

### Export to CSV
```javascript
// Convert today's payments to CSV
const payments = data.data.report.details.todayPayments;
const csv = payments.map(p => 
  `${p.receiptNo},${p.student.name},${p.totalAmount},${p.createdAt}`
).join('\n');
```

---

## Testing

### Quick Test (cURL)
```bash
curl -X GET "http://localhost:8080/api/v1/payments/dcr1-report" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Behavior
- ✅ Returns 200 with valid ADMIN/ACCOUNTANT token
- ❌ Returns 401 if token missing/invalid
- ❌ Returns 403 if user is HOD or other role
- ✅ Returns zero amounts if no payments exist
- ✅ Amounts are decimals (can be 0.00 or 15000.50)

---

## Troubleshooting

**Issue**: Getting 403 Forbidden  
**Solution**: Ensure user role is ADMIN or ACCOUNTANT

**Issue**: Empty arrays in details  
**Solution**: No successful admission payments today/month

**Issue**: Amount is 0 but expecting data  
**Solution**: Check that payments have status='SUCCESS' and admissionId set

**Issue**: Large response size  
**Solution**: Month payments limited to 100 by design - use summary for totals

---

## Related Files

- Controller: `src/controllers/payment.controller.js` (getDCR1Report function)
- Route: `src/routes/payment.routes.js` (/dcr1-report endpoint)
- Schema: `prisma/schema.prisma` (Payment model)

---

## Next Steps

1. Test the endpoint with sample data
2. Integrate into admin dashboard
3. Set up automated daily reports
4. Consider adding export functionality
