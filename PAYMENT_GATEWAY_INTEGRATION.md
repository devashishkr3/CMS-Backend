# GetEpay Payment Gateway Integration Guide

## Overview
This document describes the complete integration of GetEpay payment gateway with the CMS Backend for handling student payments, admissions, and fee collections.

## Architecture

### Payment Flow Architecture
```
┌─────────────────┐
│   Student/Web   │ (1) Initiate Payment
└────────┬────────┘
         │
         ↓
┌──────────────────────┐
│   CMS Backend API    │ (2) Generate Payment Link
│  /api/v1/payments    │    via GetEpay
└────────┬─────────────┘
         │
         ↓
┌──────────────────────┐
│   GetEpay Gateway    │ (3) Show Payment Options
│   (Payment Page)     │
└────────┬─────────────┘
         │
         ├─→ (4a) Return URL (Browser Redirect)
         │        /api/v1/payments/return
         │
         └─→ (4b) Callback URL (Server-to-Server)
              /api/v1/payments/callback
                  (5) Update Payment Status
                  (6) Generate Receipt/Certificate
                  (7) Update Admission Status
```

## Endpoints

### 1. **Generate Payment Link**
**Admin/Accountant initiated payment**

**Endpoint:** `POST /api/v1/payments/:paymentId/generate-link`

**Authentication:** Required (ADMIN, ACCOUNTANT)

**Description:** Creates an encrypted payment request to sends to GetEpay and retrieves payment URL

**Response:**
```json
{
  "status": "success",
  "message": "Payment link generated successfully",
  "data": {
    "paymentUrl": "https://portal.getepay.in/...",
    "paymentId": "uuid-payment-id"
  }
}
```

---

### 2. **Student Generate Payment Link**
**Student initiated payment**

**Endpoint:** `POST /api/v1/students/:id/payments/:paymentId/generate-link`

**Authentication:** Required (STUDENT - own payments only)

**Description:** Allows students to generate payment link for their own pending payments

**Response:**
```json
{
  "status": "success",
  "message": "Payment link generated successfully",
  "data": {
    "paymentUrl": "https://portal.getepay.in/...",
    "paymentId": "uuid-payment-id",
    "amount": 15000
  }
}
```

---

### 3. **Payment Return URL**
**GetEpay Redirect (User's browser)**

**Endpoint:** `GET /api/v1/payments/return?paymentId=xxx`

**Authentication:** Not required

**Description:** Called by GetEpay after user completes/cancels payment. Redirects user to frontend payment processing page.

**Flow:**
- GetEpay → Redirect to Return URL → Frontend Payment Processing Page
- Frontend then queries payment status via `/api/v1/payments/:id`

---

### 4. **Payment Callback URL**
**GetEpay Server-to-Server Callback**

**Endpoint:** `POST /api/v1/payments/callback?paymentId=xxx`

**Authentication:** Not required (GetEpay encrypted payload)

**Description:** Secured server-to-server communication from GetEpay containing encrypted payment status

**Payload:**
```json
{
  "response": "encrypted-getepay-response"
}
```

**It handles:**
- Decrypting GetEpay response
- Updating payment status (SUCCESS/FAILED)
- Updating admission status (if linked)
- Generating receipt and certificate (on success)
- Logging audit entries

---

### 5. **Get Payment Details**
**Retrieve payment information**

**Endpoint:** `GET /api/v1/payments/:id`

**Authentication:** Required (ADMIN, ACCOUNTANT, HOD, Student for own payments)

**Response:**
```json
{
  "status": "success",
  "data": {
    "payment": {
      "id": "uuid",
      "studentId": "uuid",
      "admissionId": "uuid",
      "totalAmount": 15000,
      "status": "SUCCESS",
      "gateway": "GETEPAY",
      "txnId": "M155238885",
      "receiptNo": "RCT-1234567890-123",
      "receiptUrl": "s3://bucket/receipt.pdf",
      "createdAt": "2024-02-24T10:30:00Z",
      "student": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "reg_no": "REG001"
      },
      "breakups": [
        {
          "id": "uuid",
          "head": "TUITION",
          "amount": 10000
        },
        {
          "id": "uuid",
          "head": "EXAM",
          "amount": 5000
        }
      ]
    }
  }
}
```

---

## Database Schema

### Payment Model
```prisma
model Payment {
  id          String  @id @default(uuid())
  studentId   String
  admissionId String?

  totalAmount Decimal
  status      PaymentStatus    // INITIATED, SUCCESS, FAILED, REFUNDED
  gateway     String           // "GETEPAY"
  txnId       String  @unique  // Merchant Transaction ID
  referenceNo String?
  bankTxnNo   String?          // Bank's Transaction Number

  receiptNo   String  @unique
  receiptUrl  String?          // PDF Receipt URL

  createdAt   DateTime @default(now())

  student   Student          @relation(fields: [studentId], references: [id])
  admission Admission?       @relation(fields: [admissionId], references: [id])
  breakups  PaymentBreakup[]
  receipt   Receipt[]
  refund    Refund?

  @@index([status])
  @@index([studentId])
}

enum PaymentStatus {
  PENDING      // Not yet initiated
  INITIATED    // Payment link generated, awaiting user action
  SUCCESS      // Payment successful
  FAILED       // Payment failed
  REFUNDED     // Payment refunded
}
```

### Payment Breakup Model
```prisma
model PaymentBreakup {
  id        String  @id @default(uuid())
  paymentId String
  head      FeeHead
  amount    Decimal

  payment Payment @relation(fields: [paymentId], references: [id])

  @@index([head])
}

enum FeeHead {
  TUITION
  EXAM
  INFRASTRUCTURE
  DEVELOPMENT
  CERTIFICATE
  MISC
}
```

---

## Environment Variables Setup

Add these to your `.env` file:

```env
# GetEpay Configuration
GETEPAY_MID=189
GETEPAY_TERMINAL_ID=getepay.merchant875943vvhm
GETEPAY_KEY=nlYA1pX/YzfcfakjahfflkckYY=
GETEPAY_IV=getepay.merchant984765@vvpm
GETEPAY_URL=https://portal.getepay.in:8443/getepayPortal/pg/v2/generateInvoice

# Payment Gateway Callbacks
GETEPAY_RETURN_URL=http://localhost:8080/api/v1/payments/return
GETEPAY_CALLBACK_URL=http://localhost:8080/api/v1/payments/callback

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
```

---

## Payment Status Workflow

### Valid Status Transitions
```
INITIATED → SUCCESS → REFUNDED
       └─→ FAILED
```

### Status Meanings
- **INITIATED:** Payment link generated, awaiting customer action
- **SUCCESS:** Payment received by bank/gateway, admission confirmed
- **FAILED:** Payment not successful, user can retry
- **REFUNDED:** Payment amount refunded to customer

---

## Admission Integration

When a payment is linked to an admission:

### Before Payment (Admission Status)
```
INITIATED → PAYMENT_PENDING
```

### After Successful Payment
```
PAYMENT_PENDING → CONFIRMED
```

This allows tracking of admission progression through payment stages.

---

## Creating a Payment

### Step 1: Admin Creates Payment Record
```bash
POST /api/v1/payments
Authorization: Bearer <admin-token>

{
  "studentId": "uuid-student",
  "admissionId": "uuid-admission",
  "totalAmount": 15000,
  "gateway": "GETEPAY",
  "txnId": "M155238885",
  "breakups": [
    {
      "head": "TUITION",
      "amount": 10000
    },
    {
      "head": "EXAM",
      "amount": 5000
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Payment initiated successfully",
  "data": {
    "payment": {
      "id": "uuid",
      "status": "INITIATED",
      "totalAmount": 15000,
      "receiptNo": "RCT-xxx"
    }
  }
}
```

### Step 2: Generate Payment Link
```bash
POST /api/v1/payments/:paymentId/generate-link
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Payment link generated successfully",
  "data": {
    "paymentUrl": "https://portal.getepay.in/getepayPortal/...",
    "paymentId": "uuid"
  }
}
```

### Step 3: Share Payment Link with Student
- Admin shares the `paymentUrl` with student via email/SMS
- Student clicks the link and proceeds with payment

### Step 4: GetEpay Processes Payment
- GetEpay displays payment options
- Student selects payment method and completes payment
- GetEpay processes the payment

### Step 5: GetEpay Sends Callback
- GetEpay sends encrypted callback to server
- API decrypts and processes payment status
- Updates payment status and admission
- Generates receipt and certificate

### Step 6: GetEpay Redirects User
- Redirects user to return URL
- Frontend checks payment status and shows appropriate message

---

## Encryption/Decryption

GetEpay uses AES-256-GCM encryption for requests and responses.

### Implementation (included in utils/getepayEncrypt.js)

```javascript
const enc = new GcmPgEncryption(process.env.GETEPAY_IV, process.env.GETEPAY_KEY);

// Encrypt
const encrypted = await enc.encrypt(JSON.stringify(payload));

// Decrypt
const decrypted = JSON.parse(await enc.decrypt(encryptedResponse));
```

---

## Error Handling

### Common Errors

**1. Payment Not Found**
```json
{
  "status": "error",
  "message": "Payment not found"
}
```

**2. Unauthorized Student**
```json
{
  "status": "error",
  "message": "Unauthorized: Payment does not belong to this student"
}
```

**3. Invalid Status Transition**
```json
{
  "status": "error",
  "message": "Invalid status transition from SUCCESS to INITIATED"
}
```

**4. GetEpay Gateway Error**
```json
{
  "status": "error",
  "message": "Error communicating with payment gateway"
}
```

---

## Testing Payment Flow

### Test Credentials (GetEpay Sandbox)
- Use test card numbers provided by GetEpay
- Test OTP: Any valid OTP (check GetEpay docs)
- Use amount format: XX.XX (e.g., 15.00 for ₹15)

### Test Flow Steps

1. **Create Payment:**
```bash
curl -X POST http://localhost:8080/api/v1/payments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student-uuid",
    "totalAmount": 100,
    "gateway": "GETEPAY",
    "txnId": "TEST-'$(date +%s)'",
    "breakups": [{"head": "TUITION", "amount": 100}]
  }'
```

2. **Generate Link:**
```bash
curl -X POST http://localhost:8080/api/v1/payments/uuid/generate-link \
  -H "Authorization: Bearer <token>"
```

3. **Complete Payment:** Click the paymentUrl in response

4. **Check Status:**
```bash
curl -X GET http://localhost:8080/api/v1/payments/payment-uuid \
  -H "Authorization: Bearer <token>"
```

---

## Audit Logging

All payment operations are logged:

```javascript
// Logged Events
- GENERATE_PAYMENT_LINK
- PAYMENT_SUCCESS
- PAYMENT_FAILED
- UPDATE_PAYMENT_STATUS
- REFUND_PAYMENT
```

Check audit logs:
```bash
GET /api/v1/audit?entityId=payment-uuid
```

---

## Security Considerations

1. **Encryption:** All GetEpay communication is encrypted with AES-256-GCM
2. **Signature Verification:** Implement signature verification from GetEpay (if available)
3. **HTTPS Only:** Always use HTTPS in production
4. **Token Expiry:** JWT tokens expire after set time
5. **Rate Limiting:** Payment endpoints have rate limiting enabled
6. **Audit Trail:** All operations logged for compliance

---

## Production Deployment

### Pre-Production Checklist

- [ ] Update environment variables with production credentials
- [ ] Change FRONTEND_URL to production domain
- [ ] Update GETEPAY_RETURN_URL to production URL
- [ ] Update GETEPAY_CALLBACK_URL to production URL
- [ ] Enable HTTPS
- [ ] Test complete payment flow in staging
- [ ] Verify SSL certificate
- [ ] Set up monitoring and alerts
- [ ] Test refund process
- [ ] Validate receipt generation

### Production Variables
```env
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
GETEPAY_RETURN_URL=https://yourdomain.com/api/v1/payments/return
GETEPAY_CALLBACK_URL=https://yourdomain.com/api/v1/payments/callback
```

---

## Troubleshooting

### "Payment not found" error
- Verify paymentId format (should be UUID)
- Check if payment exists in database
- Verify student ID matches

### "Invalid status transition" error
- Check current payment status
- Ensure valid transition path
- Refer to status workflow above

### GetEpay Gateway timeout
- Check internet connectivity
- Verify API credentials
- Check GetEpay service status

### Decryption errors
- Verify GETEPAY_KEY and GETEPAY_IV environment variables
- Ensure GetEpay response format is valid
- Check encryption algorithm compatibility

---

## Support & Documentation

- **GetEpay Docs:** https://portal.getepay.in (as per your instance)
- **Payment System Docs:** See API_DOCUMENTATION.md
- **Error Handling:** See ERROR_HANDLING.md

---

## Version History

- **v1.0** - Initial GetEpay integration
  - Payment creation and management
  - Payment link generation
  - Callback handling
  - Receipt generation
  - Student payment initiation
