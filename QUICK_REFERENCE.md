# Payment Gateway API - Quick Reference Card

## 🎯 Quick Payment Lifecycle

```
Create Payment → Generate Link → Student Pays → Callback → Status Updated
     ↓              ↓                ↓             ↓           ↓
   INITIATED   Show GetEpay    Completes      Decrypts    SUCCESS/FAILED
   (DB Save)   Payment Page    Payment       Response    Auto Receipt
```

---

## 📌 Essential Endpoints

### CREATE PAYMENT (Admin Only)
```http
POST /api/v1/payments
Authorization: Bearer <admin_token>

{
  "studentId": "uuid",
  "admissionId": "uuid",
  "totalAmount": 5000,
  "gateway": "GETEPAY",
  "txnId": "TXN-" + Date.now(),
  "breakups": [{"head": "TUITION", "amount": 5000}]
}

→ 201 Created
→ Returns: {id, status: "INITIATED", receiptNo}
```

### GENERATE PAYMENT LINK (Admin or Student)
```http
# Admin generates link
POST /api/v1/payments/{paymentId}/generate-link
Authorization: Bearer <admin_token>

# Student generates own link
POST /api/v1/students/{studentId}/payments/{paymentId}/generate-link
Authorization: Bearer <student_token>

→ 200 OK
→ Returns: {paymentUrl: "https://portal.getepay.in/..."}
```

### CHECK PAYMENT STATUS
```http
GET /api/v1/payments/{paymentId}
Authorization: Bearer <token>

→ 200 OK
→ Returns: {id, status, amount, receiptUrl, bankTxnNo}
```

### UPDATE PAYMENT STATUS (Admin Only)
```http
PATCH /api/v1/payments/{paymentId}/status
Authorization: Bearer <admin_token>

{
  "status": "SUCCESS",
  "notes": "Verified"
}

→ 200 OK
→ Valid transitions: INITIATED→SUCCESS|FAILED → REFUNDED
```

### REFUND PAYMENT (Admin Only)
```http
POST /api/v1/payments/{paymentId}/refund
Authorization: Bearer <admin_token>

{
  "reason": "Withdrawal",
  "refundAmount": 5000
}

→ 200 OK
→ Status becomes: REFUNDED
```

### GET ALL PAYMENTS (Admin/Accountant/HOD)
```http
GET /api/v1/payments[?status=SUCCESS&studentId=uuid&admissionId=uuid]
Authorization: Bearer <token>

→ 200 OK
→ Returns: {results, data: {payments: [...]}}
```

### GET PAYMENT STATISTICS (Admin/Accountant/HOD)
```http
GET /api/v1/payments/stats
Authorization: Bearer <token>

→ 200 OK
→ Returns: {stats: [{status, _count, _sum}], recentPayments}
```

---

## 🔄 GetEpay Integration Points

### CALLBACK (No Auth Needed)
```http
POST /api/v1/payments/callback

{
  "response": "<encrypted-getepay-response>"
}

→ 200 OK (Auto-processes payment)
→ Auto-updates: payment status, admission status, receipt
```

### RETURN URL (No Auth Needed)
```http
GET /api/v1/payments/return?paymentId=uuid

→ 302 Redirect
→ Redirects to: {FRONTEND_URL}/payment-processing?paymentId={uuid}
```

---

## 🔐 Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Payment fetched |
| 201 | Created | Payment created |
| 400 | Bad Request | Invalid data |
| 401 | Unauthorized | No token |
| 403 | Forbidden | Insufficient role/permission |
| 404 | Not Found | Payment not found |
| 422 | Validation Error | Invalid input |

---

## 💾 Database Fields Reference

### Payment Model
```
id          → UUID (primary key)
studentId   → FK to Student
admissionId → FK to Admission (optional)
totalAmount → Decimal (5000.00)
status      → INITIATED | SUCCESS | FAILED | REFUNDED
gateway     → "GETEPAY"
txnId       → Unique transaction ID
bankTxnNo   → Bank transaction number
receiptNo   → Auto-generated receipt number
receiptUrl  → S3/R2 URL to PDF receipt
createdAt   → Timestamp
```

### PaymentBreakup Model
```
id        → UUID
paymentId → FK to Payment
head      → TUITION | EXAM | INFRASTRUCTURE | etc.
amount    → Decimal
```

---

## 🎓 Common Workflows

### WORKFLOW 1: Admin Creates & Shares Payment Link
```
1. Admin: POST /payments
   ← Payment ID: abc-123

2. Admin: POST /payments/abc-123/generate-link
   ← Payment URL: https://portal.getepay.in/...

3. Admin: Email link to student

4. Student: Clicks link → pays on GetEpay

5. GetEpay: Sends callback to /payments/callback
   ← Auto-updates status to SUCCESS

6. Student: Returns to payment-processing page
   ← Shows "Payment Success"
```

### WORKFLOW 2: Student Self-Service Payment
```
1. Student: Auth with token
   ← Gets student token

2. Student: POST /students/{id}/payments/{paymentId}/generate-link
   ← Payment URL

3. Student: Opens link & pays

4. GetEpay: Callback sent

5. Student: Checks status
   GET /payments/{paymentId}
   ← Status: SUCCESS
```

### WORKFLOW 3: Admin Refund
```
1. Admin: GET /payments/{paymentId}
   ← Check status is SUCCESS

2. Admin: POST /payments/{paymentId}/refund
   {reason: "...", refundAmount: 5000}
   ← Refund created

3. System: Updates status to REFUNDED
   ← Logs audit entry
```

---

## 🚨 Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Payment not found` | Invalid ID | Check payment ID exists |
| `Unauthorized` | No token | Add Authorization header |
| `Insufficient permissions` | Wrong role | Use correct user role |
| `Invalid status transition` | Bad state | Check current status first |
| `Only successful payments can be refunded` | Wrong status | Payment must be SUCCESS |

---

## 💡 Tips & Tricks

### Generate Test Transaction ID
```javascript
const txnId = "TEST-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
// Result: TEST-1708768200000-456
```

### Validate Amount Format
```javascript
const amount = parseFloat(totalAmount).toFixed(2);
// 1500 → "1500.00"
```

### Check Payment Status in Frontend
```javascript
const checkStatus = async (paymentId) => {
  const res = await fetch(`/api/v1/payments/${paymentId}`, {
    headers: {'Authorization': `Bearer ${token}`}
  });
  const data = await res.json();
  return data.data.payment.status; // SUCCESS, FAILED, etc.
};
```

---

## 📊 Performance Expectations

| Operation | Time | Notes |
|-----------|------|-------|
| Create Payment | ~50ms | Database write |
| Generate Link | 200-800ms | Includes GetEpay API call |
| Check Status | ~30ms | Database read |
| List Payments | 50-200ms | Depends on filters |
| Update Status | ~100ms | Database update + audit |

---

## 🔑 Environment Variables Needed

```env
# Required for GetEpay Integration
GETEPAY_MID=189
GETEPAY_TERMINAL_ID=getepay.merchant875943vvhm
GETEPAY_KEY=...base64...
GETEPAY_IV=...base64...
GETEPAY_URL=https://portal.getepay.in:8443/getepayPortal/pg/v2/generateInvoice

# Callback URLs
GETEPAY_RETURN_URL=http://localhost:8080/api/v1/payments/return
GETEPAY_CALLBACK_URL=http://localhost:8080/api/v1/payments/callback

# Frontend
FRONTEND_URL=http://localhost:3000
```

---

## 📱 Response Structure

### Success Response
```json
{
  "status": "success",
  "message": "Optional message",
  "data": {
    "payment": { /* payment object */ }
  }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description"
}
```

### List Response
```json
{
  "status": "success",
  "results": 10,
  "data": {
    "payments": [ /* array */ ]
  }
}
```

---

## ✅ Pre-Payment Checklist

- [ ] Student exists in system
- [ ] Student email/phone available
- [ ] Amount is positive number
- [ ] Transaction ID is unique
- [ ] Fee breakups sum to total amount
- [ ] Student active (not passed out/suspended)

---

## ⚡ Quick Debug Commands

```bash
# Check if server running
curl http://localhost:8080/health

# Get payment by ID
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8080/api/v1/payments/PAYMENT_ID

# List all payments
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8080/api/v1/payments

# Check logs
docker logs cms-backend  # if containerized
tail -f logs/error.log   # if local
```

---

## 📚 Full Documentation Files

| File | Purpose |
|------|---------|
| PAYMENT_GATEWAY_INTEGRATION.md | Complete technical guide |
| PAYMENT_QUICK_SETUP.md | Setup & configuration |
| TESTING_VERIFICATION_GUIDE.md | Test cases & verification |
| API_DOCUMENTATION.md | Full API reference |
| INTEGRATION_SUMMARY.md | Integration overview |

---

## 🎯 Next Steps

1. **Test Everything** → Follow TESTING_VERIFICATION_GUIDE.md
2. **Customize** → Update fee heads, email templates, etc.
3. **Deploy** → Update .env with production credentials
4. **Monitor** → Check logs and audit trails regularly

---

**Last Updated:** 2024-02-24  
**Version:** 1.0.0 - Production Ready ✅
