# Payment Gateway Integration - Testing & Verification Guide

## 🧪 Complete Testing Guide

### Prerequisites
- Backend running on `http://localhost:8080`
- Admin user with valid JWT token
- Postman or similar API testing tool
- Test credentials from GetEpay

---

## Phase 1: Basic Setup Verification

### Test 1.1: Server Health Check
```
GET http://localhost:8080/health

Expected Response:
{
  "status": "ok",
  "timestamp": "2024-02-24T10:30:00Z"
}
```

### Test 1.2: API Root Endpoint
```
GET http://localhost:8080/

Expected Response:
{
  "status": "success",
  "message": "Welcome to College Management System",
  "version": "1.0.0"
}
```

### Test 1.3: Get Admin Token
```
POST http://localhost:8080/api/v1/auth/login

{
  "email": "admin@example.com",
  "password": "your_password"
}

Expected Response:
{
  "status": "success",
  "data": {
    "user": { ... },
    "accessToken": "token...",
    "refreshToken": "token..."
  }
}

Note: Save the accessToken for subsequent requests
```

---

## Phase 2: Student Setup

### Test 2.1: Get/Create Test Student
```
GET http://localhost:8080/api/v1/students

Headers:
Authorization: Bearer <admin_token>

Expected Response:
{
  "status": "success",
  "results": 5,
  "data": {
    "students": [
      {
        "id": "student-uuid-1",
        "name": "John Doe",
        "email": "john@example.com",
        "reg_no": "REG001"
      },
      ...
    ]
  }
}

Note: Save a student ID for payment creation
```

---

## Phase 3: Payment Creation (Admin Flow)

### Test 3.1: Create Payment Record
```
POST http://localhost:8080/api/v1/payments

Headers:
Authorization: Bearer <admin_token>
Content-Type: application/json

Body:
{
  "studentId": "student-uuid-1",
  "totalAmount": 1500,
  "gateway": "GETEPAY",
  "txnId": "TEST-" + Date.now(),
  "breakups": [
    {
      "head": "TUITION",
      "amount": 1000
    },
    {
      "head": "EXAM",
      "amount": 500
    }
  ]
}

Expected Response (201):
{
  "status": "success",
  "message": "Payment initiated successfully",
  "data": {
    "payment": {
      "id": "payment-uuid",
      "studentId": "student-uuid-1",
      "totalAmount": 1500,
      "status": "INITIATED",
      "gateway": "GETEPAY",
      "txnId": "TEST-1708768200000",
      "receiptNo": "RCT-1708768200000-123",
      "breakups": [
        {
          "head": "TUITION",
          "amount": 1000
        },
        {
          "head": "EXAM",
          "amount": 500
        }
      ]
    }
  }
}

Note: Save the payment ID for next steps
```

### Test 3.2: Verify Payment Created
```
GET http://localhost:8080/api/v1/payments/payment-uuid

Headers:
Authorization: Bearer <admin_token>

Expected Response (200):
{
  "status": "success",
  "data": {
    "payment": {
      "id": "payment-uuid",
      "status": "INITIATED",
      "totalAmount": 1500,
      "student": {
        "id": "student-uuid-1",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  }
}
```

---

## Phase 4: Payment Link Generation

### Test 4.1: Generate Payment Link (Admin)
```
POST http://localhost:8080/api/v1/payments/payment-uuid/generate-link

Headers:
Authorization: Bearer <admin_token>

Expected Response (200):
{
  "status": "success",
  "message": "Payment link generated successfully",
  "data": {
    "paymentUrl": "https://portal.getepay.in/getepayPortal/pg/v2/...encrypted...",
    "paymentId": "payment-uuid"
  }
}

✅ STEP 1: Copy paymentUrl to browser
✅ STEP 2: Complete payment on GetEpay
✅ STEP 3: Check status after payment
```

### Test 4.2: Verify Payment Status Updated
```
GET http://localhost:8080/api/v1/payments/payment-uuid

Headers:
Authorization: Bearer <admin_token>

Wait 5-10 seconds after payment completion for callback.

Expected Response (200):
{
  "status": "success",
  "data": {
    "payment": {
      "id": "payment-uuid",
      "status": "SUCCESS",  ← Changed from INITIATED
      "bankTxnNo": "12345678",  ← New field populated
      "receiptNo": "RCT-xxx",
      "receiptUrl": "https://r2-bucket.com/receipt-xxx.pdf"
    }
  }
}
```

---

## Phase 5: Student Self-Service Flow

### Test 5.1: Create Payment for Student
```
POST http://localhost:8080/api/v1/payments

Headers:
Authorization: Bearer <admin_token>
Content-Type: application/json

Body:
{
  "studentId": "student-uuid-2",
  "totalAmount": 2000,
  "gateway": "GETEPAY",
  "txnId": "STUDENT-" + Date.now(),
  "breakups": [
    {
      "head": "TUITION",
      "amount": 2000
    }
  ]
}

Expected Response (201):
Same as Test 3.1 but for different student
```

### Test 5.2: Student Generates Own Payment Link
```
POST http://localhost:8080/api/v1/students/student-uuid-2/payments/payment-uuid/generate-link

Headers:
Authorization: Bearer <student_token>

Expected Response (200):
{
  "status": "success",
  "message": "Payment link generated successfully",
  "data": {
    "paymentUrl": "https://portal.getepay.in/...",
    "paymentId": "payment-uuid",
    "amount": 2000
  }
}
```

### Test 5.3: Student Cannot Access Others' Payments
```
POST http://localhost:8080/api/v1/students/student-uuid-2/payments/other-payment-uuid/generate-link

Headers:
Authorization: Bearer <student-token-for-different-student>

Expected Response (403):
{
  "status": "error",
  "message": "Unauthorized: Payment does not belong to this student"
}
```

---

## Phase 6: Payment Statistics (Admin)

### Test 6.1: Get Payment Stats
```
GET http://localhost:8080/api/v1/payments/stats

Headers:
Authorization: Bearer <admin_token>

Expected Response (200):
{
  "status": "success",
  "data": {
    "stats": [
      {
        "status": "SUCCESS",
        "_count": 1,
        "_sum": {
          "totalAmount": 1500
        }
      },
      {
        "status": "INITIATED",
        "_count": 2,
        "_sum": {
          "totalAmount": 5000
        }
      }
    ],
    "recentPayments": [
      {
        "id": "payment-uuid-1",
        "status": "SUCCESS",
        "totalAmount": 1500,
        "student": {
          "id": "student-uuid-1",
          "name": "John Doe",
          "reg_no": "REG001"
        }
      }
    ]
  }
}
```

---

## Phase 7: Payment Management (Admin)

### Test 7.1: List All Payments
```
GET http://localhost:8080/api/v1/payments

Headers:
Authorization: Bearer <admin_token>

Optional Query Parameters:
?status=SUCCESS
?status=FAILED
?studentId=student-uuid
?admissionId=admission-uuid

Expected Response (200):
{
  "status": "success",
  "results": 5,
  "data": {
    "payments": [ ... ]
  }
}
```

### Test 7.2: Filter Payments by Status
```
GET http://localhost:8080/api/v1/payments?status=SUCCESS

Headers:
Authorization: Bearer <admin_token>

Expected Response (200):
Returns only SUCCESS payments
```

### Test 7.3: Update Payment Status (Manual)
```
PATCH http://localhost:8080/api/v1/payments/payment-uuid/status

Headers:
Authorization: Bearer <admin_token>
Content-Type: application/json

Body:
{
  "status": "SUCCESS",
  "notes": "Payment verified manually"
}

Expected Response (200):
{
  "status": "success",
  "message": "Payment status updated successfully",
  "data": {
    "payment": {
      "id": "payment-uuid",
      "status": "SUCCESS",
      "updatedAt": "2024-02-24T..."
    }
  }
}
```

---

## Phase 8: Refund Processing

### Test 8.1: Refund Successful Payment
```
POST http://localhost:8080/api/v1/payments/payment-uuid/refund

Headers:
Authorization: Bearer <admin_token>
Content-Type: application/json

Body:
{
  "reason": "Student requested refund due to withdrawal",
  "refundAmount": 1500
}

Expected Response (200):
{
  "status": "success",
  "message": "Payment refunded successfully",
  "data": {
    "payment": {
      "id": "payment-uuid",
      "status": "REFUNDED",
      "totalAmount": 1500
    },
    "refund": {
      "id": "refund-uuid",
      "amount": 1500,
      "reason": "Student requested refund due to withdrawal",
      "refundedAt": "2024-02-24T..."
    }
  }
}
```

### Test 8.2: Try to Refund Failed Payment (Should Fail)
```
POST http://localhost:8080/api/v1/payments/failed-payment-uuid/refund

Headers:
Authorization: Bearer <admin_token>

Expected Response (400):
{
  "status": "error",
  "message": "Only successful payments can be refunded"
}
```

---

## Phase 9: Admission Integration

### Test 9.1: Create Payment Linked to Admission
```
POST http://localhost:8080/api/v1/payments

Headers:
Authorization: Bearer <admin_token>

Body:
{
  "studentId": "student-uuid",
  "admissionId": "admission-uuid",  ← Include admission
  "totalAmount": 5000,
  "gateway": "GETEPAY",
  "txnId": "ADM-" + Date.now(),
  "breakups": [
    {
      "head": "TUITION",
      "amount": 5000
    }
  ]
}

Note: Verify admission status is PAYMENT_PENDING
```

### Test 9.2: Verify Admission Updated on Success
```
After successful payment completion:

GET http://localhost:8080/api/v1/admissions/admission-uuid

Expected Response:
{
  "status": "success",
  "data": {
    "admission": {
      "id": "admission-uuid",
      "status": "CONFIRMED",  ← Updated from PAYMENT_PENDING
      "studentId": "student-uuid",
      "paymentId": "payment-uuid"
    }
  }
}
```

---

## Phase 10: Error Scenarios

### Test 10.1: Invalid Payment ID
```
GET http://localhost:8080/api/v1/payments/invalid-uuid

Headers:
Authorization: Bearer <admin_token>

Expected Response (404):
{
  "status": "error",
  "message": "Payment not found"
}
```

### Test 10.2: Missing Authentication
```
POST http://localhost:8080/api/v1/payments/uuid/generate-link

(No Authorization header)

Expected Response (401):
{
  "status": "error",
  "message": "Not authenticated"
}
```

### Test 10.3: Insufficient Permissions
```
POST http://localhost:8080/api/v1/payments/uuid/generate-link

Headers:
Authorization: Bearer <student_token>

Expected Response (403):
{
  "status": "error",
  "message": "Insufficient permissions"
}
```

### Test 10.4: Invalid Transition
```
PATCH http://localhost:8080/api/v1/payments/uuid/status

Headers:
Authorization: Bearer <admin_token>

Body:
{
  "status": "INITIATED"  ← Invalid transition from SUCCESS
}

Expected Response (400):
{
  "status": "error",
  "message": "Invalid status transition from SUCCESS to INITIATED"
}
```

---

## Audit Logging Verification

### View Audit Logs
```
GET http://localhost:8080/api/v1/audit

Headers:
Authorization: Bearer <admin_token>

Optional:
?entityId=payment-uuid
?action=GENERATE_PAYMENT_LINK
?entity=Payment

Expected Response:
{
  "status": "success",
  "results": 10,
  "data": {
    "logs": [
      {
        "id": "log-uuid",
        "userId": "admin-uuid",
        "action": "GENERATE_PAYMENT_LINK",
        "entity": "Payment",
        "entityId": "payment-uuid",
        "payload": {...},
        "timestamp": "2024-02-24T..."
      }
    ]
  }
}
```

---

## Performance Testing

### Test 10+ Concurrent Payments
```bash
# Use Apache Bench or similar tool
ab -n 50 -c 10 -p payment.json \
  -H "Authorization: Bearer <token>" \
  http://localhost:8080/api/v1/payments
```

### Expected Performance
- Create Payment: < 100ms
- Generate Link: 200-500ms (includes GetEpay API call)
- Get Payment: < 50ms
- Update Status: < 100ms

---

## Integration Checklist

Use this checklist to verify complete integration:

```
Phase 1: Setup ✓
  ☐ Server running
  ☐ Database connected
  ☐ Health check passes
  ☐ Admin token obtained

Phase 2: Student Setup ✓
  ☐ Student exists
  ☐ Can retrieve student

Phase 3: Payment Creation ✓
  ☐ Payment created
  ☐ Receipt number generated
  ☐ Status is INITIATED
  ☐ Breakups created

Phase 4: Link Generation ✓
  ☐ Payment link generated
  ☐ Link opens in GetEpay
  ☐ Payment link valid

Phase 5: Payment Processing ✓
  ☐ Payment completed
  ☐ Status updated to SUCCESS
  ☐ Bank transaction number recorded
  ☐ Receipt URL populated

Phase 6: Self-Service ✓
  ☐ Student can generate link
  ☐ Student prevented from accessing others
  ☐ Student token validation works

Phase 7: Statistics ✓
  ☐ Stats endpoint returns data
  ☐ Correct totals calculated
  ☐ Recent payments listed

Phase 8: Refunds ✓
  ☐ Can refund payment
  ☐ Cannot refund failed
  ☐ Status updated to REFUNDED

Phase 9: Admission Integration ✓
  ☐ Admission status updated
  ☐ Receipt generated
  ☐ Audit logged

Phase 10: Error Handling ✓
  ☐ 404 for missing
  ☐ 401 for no auth
  ☐ 403 for no permission
  ☐ 400 for bad request

✅ All Tests Passed - Ready for Production!
```

---

## Troubleshooting Failed Tests

### Payment link returns 404
- Verify payment ID exists: `GET /api/v1/payments/{id}`
- Check if status is INITIATED
- Verify student exists

### GetEpay API Error
- Check GETEPAY_KEY and GETEPAY_IV in .env
- Verify GETEPAY_URL is correct
- Check internet connectivity
- Verify amount format (XX.XX)

### Callback not received
- Check GETEPAY_CALLBACK_URL is publicly accessible
- Verify firewall allows inbound from GetEpay IPs
- Check logs for decryption errors
- Verify response format

### Status not updating
- Wait 10-15 seconds after payment
- Check server logs for callback errors
- Verify database connection
- Check if callback was called

---

## Success Criteria

✅ **Test Passes When:**
- All endpoints return expected status codes
- All responses have correct data structure
- Audit logs created for operations
- Database updated correctly
- No JavaScript errors in console
- Payment status transitions properly
- Admission status updates on success
- Access control working (403 for unauthorized)

---

**Note:** Always use test credentials from GetEpay for testing. Never use production credentials in test environment.

Last Updated: 2024-02-24
