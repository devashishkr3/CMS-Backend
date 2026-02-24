# Production Ready Payment Integration - GetEpay

## Your Current Setup Issues

❌ **Problem 1**: Trying to access `/api/v1/payments/return` on your domain
- Your nginx doesn't have this API endpoint configured
- Result: 405 Not Allowed

❌ **Problem 2**: Backend running on localhost, but endpoints need to be public
- GetEpay callback can't reach `http://localhost:8080`
- Your domain doesn't have backend deployed

## Production Architecture - 3 Options

### Option 1: Deploy Backend to Subdomain (RECOMMENDED)
```
User Payment Flow:
1. User completes payment on GetEpay
2. GetEpay redirects → https://api.santsandhyadasmahilacollege.org/api/v1/payments/return?paymentId=xxx
3. Backend processes and redirects → https://santsandhyadasmahilacollege.org/admin/students?paymentId=xxx
4. GetEpay callback → https://api.santsandhyadasmahilacollege.org/api/v1/payments/callback (updates status)
5. Admin page polls for status updates
```

**Steps:**
1. Deploy CMS-Backend to `api.yourdomain.com`
2. Update `.env`:
   ```
   GETEPAY_RETURN_URL=https://api.santsandhyadasmahilacollege.org/api/v1/payments/return
   GETEPAY_CALLBACK_URL=https://api.santsandhyadasmahilacollege.org/api/v1/payments/callback
   ```
3. Done!

### Option 2: Nginx Reverse Proxy (If Backend on Same Server)
```
User → nginx:443
        ↓
    ├─ /admin/* → Your CMS app
    ├─ /api/* → Proxy to backend :8080
    └─ /* → Static files
```

**Steps:**
1. Add to nginx:
```nginx
location /api/ {
    proxy_pass http://localhost:8080/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```
2. Update `.env`:
   ```
   GETEPAY_RETURN_URL=https://santsandhyadasmahilacollege.org/api/v1/payments/return
   GETEPAY_CALLBACK_URL=https://santsandhyadasmahilacollege.org/api/v1/payments/callback
   ```

### Option 3: Local Testing with ngrok (TEMPORARY - FOR TESTING ONLY)
```
Local Backend (8080) → ngrok tunnel → Public HTTPS URL
```

**Steps:**
1. Install ngrok: `brew install ngrok`
2. Run: `ngrok http 8080`
3. Get URL like: `https://abc-xyz-ngrok.io`
4. Update `.env`:
   ```
   GETEPAY_RETURN_URL=https://abc-xyz-ngrok.io/api/v1/payments/return
   GETEPAY_CALLBACK_URL=https://abc-xyz-ngrok.io/api/v1/payments/callback
   ```
5. Test payment and it will work!

## How Payment Status Updates (Real Production Flow)

```
┌─────────────────────────────────────────────────────────┐
│ Payment Status Update Flow                              │
└─────────────────────────────────────────────────────────┘

1. User Initiates Payment
   ↓
   Payment created with status: INITIATED

2. User Completes Payment on GetEpay
   ↓
   GetEpay Redirect → Return URL (BROWSER)
   ├─ Purpose: Tell browser payment is done
   ├─ Method: HTTP Redirect
   └─ Doesn't update status yet

3. GetEpay Server Sends Callback (SERVER-TO-SERVER)
   ↓
   GetEpay → Your Backend Callback URL (HTTPS POST)
   ├─ Contains encrypted payment response
   ├─ Backend decrypts and verifies
   └─ **STATUS UPDATES HERE: INITIATED → SUCCESS/FAILED**

4. Admin/Frontend Page
   ↓
   Polls every 2-3 seconds for updated status
   When callback completes, status shows SUCCESS ✅

┌─ Timeline ─────────────┐
│ T=0s  Payment Created  │
│ T=1s  User Pays        │
│ T=2s  Redirected Back  │
│ T=3-4s Callback Arrives│ ← STATUS UPDATES
│ T=5s  Admin Sees ✅    │
└────────────────────────┘
```

## Updated `.env` for Current Setup

For now, use this configuration for testing on your domain:

```env
# Direct redirect to admin page (no API call needed)
GETEPAY_RETURN_URL=https://santsandhyadasmahilacollege.org/admin/students
FRONTEND_URL=https://santsandhyadasmahilacollege.org/admin/students

# Callback URL - Need to configure properly!
# Option A: If using ngrok during testing:
#   GETEPAY_CALLBACK_URL=https://abc-xyz-ngrok.io/api/v1/payments/callback
# Option B: If deploying backend to subdomain:
#   GETEPAY_CALLBACK_URL=https://api.santsandhyadasmahilacollege.org/api/v1/payments/callback
# Option C: If using nginx reverse proxy:
#   GETEPAY_CALLBACK_URL=https://santsandhyadasmahilacollege.org/api/v1/payments/callback
GETEPAY_CALLBACK_URL=https://santsandhyadasmahilacollege.org/api/v1/payments/callback
```

## Quick Testing Setup (Using ngrok)

```bash
# Terminal 1: Start ngrok tunnel to backend
brew install ngrok
ngrok http 8080
# Copy the URL like: https://abc-xyz-ngrok.io

# Terminal 2: Update .env with ngrok URL
GETEPAY_CALLBACK_URL=https://abc-xyz-ngrok.io/api/v1/payments/callback
GETEPAY_RETURN_URL=https://abc-xyz-ngrok.io/api/v1/payments/return

# Terminal 3: Restart backend
cd CMS-Backend
npm run dev

# Terminal 4: Test
# Create payment → Complete on GetEpay
# Should see callback in backend logs
# Status should update to SUCCESS
```

## Integration Checklist

- [ ] Choose deployment option (1, 2, or 3)
- [ ] Configure backend accessibility
- [ ] Update `.env` with correct URLs
- [ ] Test payment creation
- [ ] Test payment completion on GetEpay
- [ ] Verify callback is received in backend
- [ ] Verify status updates in database
- [ ] Verify redirect to admin page works
- [ ] Add status polling to admin page JavaScript

## Status Polling JavaScript (For Admin Page)

Add this to your admin students page to show payment status:

```javascript
function checkPaymentStatus(paymentId) {
  if (!paymentId) return;
  
  fetch(`/api/v1/payments/${paymentId}`)
    .then(res => res.json())
    .then(data => {
      const payment = data.data.payment;
      
      if (payment.status === 'SUCCESS') {
        showNotification('✅ Payment Successful!', 'success');
        // Refresh student list to show updated payment status
        refreshStudentList();
      } else if (payment.status === 'FAILED') {
        showNotification('❌ Payment Failed', 'error');
      } else {
        // Still processing, check again in 2 seconds
        setTimeout(() => checkPaymentStatus(paymentId), 2000);
      }
    })
    .catch(err => console.error('Error checking status:', err));
}

// On page load, check if there's a paymentId in URL
const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get('paymentId');
if (paymentId) {
  checkPaymentStatus(paymentId);
}
```

## What's Happening Now (Your Current Setup)

```
1. Payment created ✅
2. Payment link generated ✅
3. User completes on GetEpay ✅
4. Redirect to api endpoint ❌ (404/405 - endpoint doesn't exist)
5. Callback never called ❌ (because return failed)
6. Status never updated ❌ (stuck at INITIATED)
```

## Next Steps

**Choose ONE:**

1. **Quick Fix (Testing)**: Use ngrok
   - Run: `ngrok http 8080`
   - Update CALLBACK_URL to ngrok URL
   - Test and verify callback works

2. **Production Fix**: Deploy backend to subdomain
   - Deploy CMS-Backend to api.yourdomain.com
   - Update URLs in .env
   - Configure GetEpay with production URLs

3. **Production Fix**: Use nginx reverse proxy
   - Add proxy rules to nginx
   - Update .env to use main domain
   - Restart nginx

All three approaches will make the callback work and status will update to SUCCESS!

