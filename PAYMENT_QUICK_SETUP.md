# Payment Gateway Integration - Quick Setup

## 🚀 Quick Start

### 1. Environment Variables
Your `.env` file has been updated with GetEpay configuration:

```env
# GetEpay Gateway
GETEPAY_MID=189
GETEPAY_TERMINAL_ID=getepay.merchant875943vvhm
GETEPAY_KEY=nlYA1pX/YzfcfakjahfflkckYY=
GETEPAY_IV=getepay.merchant984765@vvpm
GETEPAY_URL=https://portal.getepay.in:8443/getepayPortal/pg/v2/generateInvoice

# Callback URLs
GETEPAY_RETURN_URL=http://localhost:8080/api/v1/payments/return
GETEPAY_CALLBACK_URL=http://localhost:8080/api/v1/payments/callback

# Frontend
FRONTEND_URL=http://localhost:3000
```

### 2. Database Schema
All required models are already in your Prisma schema:
- ✅ Payment
- ✅ PaymentBreakup
- ✅ PaymentStatus enum
- ✅ FeeHead enum

### 3. API Endpoints Ready

#### Admin Endpoints
- `POST /api/v1/payments` - Create payment record
- `POST /api/v1/payments/:paymentId/generate-link` - Generate payment link
- `GET /api/v1/payments` - List all payments
- `GET /api/v1/payments/:id` - Get payment details
- `PATCH /api/v1/payments/:id/status` - Update payment status
- `POST /api/v1/payments/:id/refund` - Refund payment

#### Student Endpoints
- `POST /api/v1/students/:id/payments/:paymentId/generate-link` - Generate link for own payment
- `GET /api/v1/payments/:id` - Check own payment status

#### GetEpay Callbacks (Public)
- `GET /api/v1/payments/return` - Return URL (browser redirect)
- `POST /api/v1/payments/callback` - Callback URL (server-to-server)

### 4. Payment Flow

```
Admin/Student 
    ↓
Create Payment Record
    ↓
Generate Payment Link (via GetEpay)
    ↓
Student pays via GetEpay gateway
    ↓
GetEpay sends callback (encrypted)
    ↓
Backend processes & updates status
    ↓
Receipt & Certificate generated
    ↓
Admission status updated (if linked)
    ↓
Student redirected to frontend
```

## 📋 Key Features Implemented

✅ **Payment Creation**
- Create payment with student, amount, and fee breakups
- Automatic receipt number generation
- Support for admission linking

✅ **GetEpay Integration**  
- Encrypted payload generation
- AES-256-GCM encryption/decryption
- Payment link generation
- Bank transaction number tracking

✅ **Secure Callbacks**
- Encrypted server-to-server communication
- Payment status updates (SUCCESS/FAILED)
- Audit logging

✅ **Post-Payment Actions**
- Admission status confirmation
- Receipt generation
- Certificate generation (for eligible payments)
- Email notifications (when configured)

✅ **Student Features**
- Students can generate their own payment links
- Students can check payment status
- Per-payment authorization (students can't access others' payments)

✅ **Admin Features**
- Full payment management
- Refund processing
- Payment statistics and reporting
- Audit trail

## 🔄 Payment Statuses

```
INITIATED  →  SUCCESS  →  REFUNDED
     ↓
   FAILED
```

- **INITIATED:** Payment link generated
- **SUCCESS:** Payment completed, admission confirmed
- **FAILED:** Payment unsuccessful
- **REFUNDED:** Money returned to customer

## 🧪 Testing in Development

### 1. Create a Test Payment (via Admin)
```bash
POST http://localhost:8080/api/v1/payments
Headers: Authorization: Bearer <admin-token>

{
  "studentId": "student-uuid",
  "admissionId": "admission-uuid",
  "totalAmount": 1000,
  "gateway": "GETEPAY",
  "txnId": "TEST-" + Date.now(),
  "breakups": [
    {"head": "TUITION", "amount": 1000}
  ]
}
```

### 2. Generate Payment Link
```bash
POST http://localhost:8080/api/v1/payments/{paymentId}/generate-link
Headers: Authorization: Bearer <admin-token>
```

This returns a `paymentUrl` - open it in browser to see GetEpay payment page.

### 3. Use Test Credentials
- **Card:** 4111 1111 1111 1111 (Test Visa)
- **Expiry:** Any future date (MM/YY)
- **CVV:** Any 3 digits
- **OTP:** Use same as SMS (GetEpay test mode accepts any OTP)

### 4. Verify Payment Status
```bash
GET http://localhost:8080/api/v1/payments/{paymentId}
Headers: Authorization: Bearer <token>
```

Status should be **SUCCESS** and show:
- Receipt number
- Bank transaction number
- Receipt URL (if generated)

## 🔐 Security Features

✅ **Encryption:** AES-256-GCM for all GetEpay communication
✅ **JWT Auth:** Token-based API authentication
✅ **RBAC:** Role-based access control (ADMIN, ACCOUNTANT, HOD, STUDENT)
✅ **Rate Limiting:** 1000 requests per 15 minutes per IP
✅ **Audit Logging:** All payment operations logged
✅ **Input Validation:** Joi schema validation on all inputs
✅ **CORS:** Configured with allowlist

## 📄 Generated Documents

After successful payment, the system generates:
- **Receipt PDF** - Uploaded to Cloudflare R2
- **Certificate** - If eligible (configurable)

## 🚨 Common Issues & Solutions

**Issue:** `Payment not found`
- Verify paymentId is correct
- Ensure payment exists in database
- Check if student/admin ID matches

**Issue:** GetEpay connection error
- Verify API credentials in .env
- Check internet connectivity
- Verify GETEPAY_URL is correct

**Issue:** Decryption failed
- Verify GETEPAY_KEY and GETEPAY_IV are correct
- Ensure GetEpay request format is valid
- Check algorithm is AES-256-GCM

**Issue:** Payment callback not received
- Verify GETEPAY_CALLBACK_URL is publicly accessible
- Check firewall/router settings
- Enable HTTPS in production

## 📞 Support

For detailed documentation, see:
- [PAYMENT_GATEWAY_INTEGRATION.md](./PAYMENT_GATEWAY_INTEGRATION.md) - Complete integration guide
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
- [API_ENDPOINTS.md](./API_ENDPOINTS.md) - All endpoint details

---

**Status:** ✅ Ready for Production  
**Last Updated:** 2024-02-24
