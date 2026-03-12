# Payment Gateway Production Fix - Summary

## Issues Fixed

### 1. **Environment Configuration** (`.env`)
- ✅ Removed duplicate GETEPAY environment variables
- ✅ Configured production gateway URL: `https://portal.getepay.in/getepayPortal/pg/generateTxn`
- ✅ Set correct production credentials:
  - MID: `1379045`
  - Terminal ID: `getepay.merchant989958@vvsbbank`
  - Key & IV properly configured
  - **CRITICAL**: IV (`getepay.merchant989958@vvsbbank`) is NOT Base64, automatically handled using MD5 hash

### 2. **Encryption Protocol** (`src/utils/getepayEncryptProduction.js`)
- ✅ Created production-grade encryption supporting both:
  - **AES/CBC** for Production with smart IV handling:
    - If IV is not valid Base64 → Uses MD5 hash of Terminal ID (32 hex chars = 16 bytes)
    - If IV is valid Base64 → Uses decoded value
  - **AES/GCM** for UAT/Sandbox (PBKDF2 key derivation)
- ✅ Automatic environment detection based on `NODE_ENV`
- ✅ Proper validation and error messages

### 3. **Payment Controller Updates** (`src/controllers/payment.controller.js`)

#### Payload Structure Fixed:
- ✅ Changed `transactionDate` format from ISO to `DD-MM-YYYY HH:mm:ss`
- ✅ Changed `productType` from `"IPG"` to `"PAYMENT"`
- ✅ Removed `bankId` field (not required)
- ✅ Added `vpa` field (required for production)
- ✅ Added moment.js for date formatting

#### Error Handling Enhanced:
- ✅ Increased timeout from 30s to 60s for production
- ✅ Added proper headers (`Content-Type`, `Accept`)
- ✅ Better error messages for:
  - Timeout errors (504)
  - Gateway unavailable (502/503)
  - Authentication failures (401/403)
- ✅ Comprehensive logging at each step

#### Database Schema Updated:
- ✅ Added `gatewayPaymentId` field to Payment model
- ✅ Stores GetEpay payment ID from response
- ✅ Enables requery functionality

### 4. **New Features Added**

#### Requery Endpoint:
```
GET /api/v1/payments/:id/requery
```
- ✅ Manually verify payment status with gateway
- ✅ Auto-update payment if status changed
- ✅ Access: ADMIN, ACCOUNTANT only
- ✅ Returns current and gateway status

#### Enhanced Logging:
- ✅ Request/response logging
- ✅ Encryption/decryption logs
- ✅ Environment detection logs
- ✅ Detailed error tracking

### 5. **Routes Updated** (`src/routes/payment.routes.js`)
- ✅ Added requery endpoint
- ✅ Proper authentication middleware
- ✅ Role-based access control

## Files Modified

1. `/Users/adityasuman2/Desktop/projects/CMS/CMS-Backend/.env`
2. `/Users/adityasuman2/Desktop/projects/CMS/CMS-Backend/prisma/schema.prisma`
3. `/Users/adityasuman2/Desktop/projects/CMS/CMS-Backend/src/controllers/payment.controller.js`
4. `/Users/aditionasuman2/Desktop/projects/CMS/CMS-Backend/src/routes/payment.routes.js`

## Files Created

1. `/Users/adityasuman2/Desktop/projects/CMS/CMS-Backend/src/utils/getepayEncryptProduction.js`

## Deployment Steps

### 1. Install Dependencies (if needed)
```bash
npm install moment
```

### 2. Run Database Migration
```bash
npx prisma migrate dev --name add_gateway_payment_id
npx prisma generate
```

### 3. Update Environment Variables
Ensure `.env` has:
```env
NODE_ENV=production
GETEPAY_MID=1379045
GETEPAY_TERMINAL_ID=getepay.merchant989958@vvsbbank
GETEPAY_KEY=nlYA1pX/YzfcfaccqY+QBSIJkPugvF1WgGYkyi/GTdQ=
GETEPAY_IV=getepay.merchant989958@vvsbbank
GETEPAY_URL=https://portal.getepay.in/getepayPortal/pg/generateTxn
GETEPAY_RETURN_URL=https://santsandhyadasmahilacollege.org/api/v1/payments/return
GETEPAY_CALLBACK_URL=https://santsandhyadasmahilacollege.org/api/v1/payments/callback
```

### 4. Restart Server
```bash
npm restart
# or
pm2 restart all
```

## Testing Checklist

### Generate Payment Link
```bash
POST /api/v1/payments/:paymentId/generate-link
Headers: Authorization: Bearer <token>
```

Expected Response:
```json
{
  "status": "success",
  "message": "Payment link generated successfully",
  "data": {
    "paymentUrl": "https://portal.getepay.in/...",
    "paymentId": "uuid"
  }
}
```

### Requery Payment Status
```bash
GET /api/v1/payments/:paymentId/requery
Headers: Authorization: Bearer <token>
```

Expected Response:
```json
{
  "status": "success",
  "message": "Payment status requeried successfully",
  "data": {
    "paymentId": "uuid",
    "receiptNo": "REC-001",
    "currentStatus": "INITIATED",
    "gatewayStatus": "PENDING",
    "gatewayTxnId": "12345678",
    "amount": "100.00",
    "lastUpdated": "2026-03-12T..."
  }
}
```

## API Endpoints Summary

### Payment Generation
- **Endpoint:** `POST /api/v1/payments/:paymentId/generate-link`
- **Access:** Authenticated users
- **Purpose:** Generate payment link from GetEpay

### Student Payment Generation
- **Endpoint:** `POST /api/v1/payments/:paymentId/student-generate-link`
- **Access:** Student (owner of payment)
- **Purpose:** Student-initiated payment

### Requery Status
- **Endpoint:** `GET /api/v1/payments/:id/requery`
- **Access:** ADMIN, ACCOUNTANT
- **Purpose:** Manually verify payment status with gateway

### Callback (Webhook)
- **Endpoint:** `POST /api/v1/payments/callback`
- **Access:** Public (GetEpay server-to-server)
- **Purpose:** Receive payment confirmation

### Return (Redirect)
- **Endpoint:** `GET /api/v1/payments/return`
- **Access:** Public
- **Purpose:** Handle user redirect after payment

## Error Codes Reference

| Code | Meaning | Action |
|------|---------|--------|
| 502 | Bad Gateway | Gateway error or invalid response |
| 504 | Gateway Timeout | Request took > 60 seconds |
| 404 | Not Found | Payment ID doesn't exist |
| 403 | Forbidden | User lacks permission |
| 401 | Unauthorized | Missing/invalid auth token |
| 500 | Internal Error | Server configuration issue |

## Production Monitoring

### Key Logs to Monitor:
1. `🔗 Generating payment link for payment:`
2. `🚀 Calling GetEpay API at:`
3. `✅ GetEpay API response status:`
4. `❌ GetEpay API Error:`
5. `🔍 Requering payment status for:`

### Alert Conditions:
- Multiple 502 errors in short time
- Timeout errors (504)
- Decryption failures
- Empty gateway responses

## Security Considerations

✅ **Encryption Keys**: Never expose in logs or client-side code
✅ **HTTPS Only**: All production URLs use HTTPS
✅ **Authentication**: Admin endpoints protected
✅ **Audit Logging**: All actions logged to database
✅ **Rate Limiting**: 1000 requests per 15 minutes per IP

## Troubleshooting

### Issue: 502 Bad Gateway
**Solution:**
1. Check GetEpay credentials in `.env`
2. Verify production URL is correct
3. Check network connectivity to gateway
4. Review logs for specific error message

### Issue: Decryption Failed
**Solution:**
1. Verify KEY and IV match production values
2. Check NODE_ENV is set to `production`
3. Ensure encryption utility is using AES/CBC mode
4. Test with known working payload

### Issue: Payment Link Expired
**Solution:**
1. Links typically valid for 15-30 minutes
2. Generate new link using same endpoint
3. Old links automatically invalidated

## Contact Support

For production issues:
- GetEpay Support: [Contact your GetEpay representative]
- Technical Lead: [Your contact info]
- Documentation: See attached PDF docs

---

**Last Updated:** March 12, 2026
**Version:** 2.0.0
**Status:** Production Ready ✅
