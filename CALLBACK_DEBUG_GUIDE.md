# Payment Status Update Guide - GetEpay vs Razorpay

## Understanding the Flow

### How Payment Status Updates Work

There are **3 key steps** in the payment flow:

```
Step 1: User Creates Payment
  ↓
  Backend creates INITIATED payment
  ↓
Step 2: User Completes Payment on GetEpay
  ↓
  User redirects back to your app (Return URL)
  ↓
  BUT: Status is still INITIATED at this point!
  ↓
Step 3: GetEpay Sends Callback (Server-to-Server)
  ↓
  Backend receives encrypted callback
  ↓
  Decrypts & updates status to SUCCESS/FAILED
  ↓
  Frontend auto-refreshes and shows updated status
```

## Why Your Status Is Stuck

**Common Cause**: GetEpay callback is not reaching your backend

### Reasons This Happens:

1. **Callback URL not configured in GetEpay Dashboard**
   - Check your merchant settings at GetEpay
   - Make sure callback URL is registered
   - Callback URL should be: `https://yourdomain.com/api/v1/payments/callback` (production)

2. **Testing on localhost**
   - GetEpay servers can't reach `http://localhost:8080`
   - You need to use ngrok or similar to expose localhost to the internet
   - OR test using the test callback script

3. **Database Connection Failed**
   - Even if callback is received, if database is down, update fails silently
   - Check backend logs for [CALLBACK] messages

4. **Wrong Callback URL in .env**
   - Check: `GETEPAY_CALLBACK_URL=http://localhost:8080/api/v1/payments/callback`

## How to Debug This

### Step 1: Check if Callback is Configured

Run this command in your backend directory:
```bash
grep GETEPAY_CALLBACK_URL .env
```

You should see:
```
GETEPAY_CALLBACK_URL=http://localhost:8080/api/v1/payments/callback
```

### Step 2: Test the Callback Manually

Use the test callback script to simulate what GetEpay does:

```bash
# First, get a payment ID from your database or API response
# Then run:

node test-callback.js <PAYMENT_ID> SUCCESS
# Example:
node test-callback.js 8d3fb02b-9fe0-4c8d-93d9-a7640e867202 SUCCESS
```

This will:
- ✅ Encrypt a mock response like GetEpay does
- ✅ Send it to your callback endpoint
- ✅ Check if payment status updates
- ✅ Verify the database update worked

### Step 3: Check Backend Logs

When you run the test-callback script, look for these logs in your backend terminal:

```
🧪 [TEST CALLBACK] Received test callback
🔔 [CALLBACK] Received callback from GetEpay
📦 [CALLBACK] Body: {...}
🔐 [CALLBACK] Decrypting response...
✅ [CALLBACK] Decrypted response: {...}
💰 [CALLBACK] Payment successful! Updating status to SUCCESS
```

**If you DON'T see these messages**, the callback endpoint isn't being called.

### Step 4: Check Payment Status Is Updating

```bash
curl 'http://localhost:8080/api/v1/payments/{PAYMENT_ID}' \
  -H 'Content-Type: application/json'
```

Look for the `"status"` field:
- If it changed from `INITIATED` to `SUCCESS` → ✅ Callback worked
- If it's still `INITIATED` → ❌ Callback didn't run or failed

## For Production

When you deploy to production:

1. **Update .env with production URLs**
   ```
   GETEPAY_CALLBACK_URL=https://yourdomain.com/api/v1/payments/callback
   ```

2. **Register callback URL in GetEpay Dashboard**
   - Log in to your GetEpay merchant account
   - Go to Settings / Configuration
   - Set the callback/webhook URL
   - You should get a confirmation

3. **Make sure HTTPS is configured**
   - GetEpay requires HTTPS in production
   - Self-signed certificates won't work

4. **Test end-to-end**
   - Create a payment
   - Complete it on GetEpay
   - Wait ~10 seconds for callback
   - Refresh the payment-processing page
   - Status should be updated

## Comparison: Razorpay vs GetEpay

| Feature | Razorpay | GetEpay |
|---------|----------|---------|
| **Return URL** | Shows when user closes payment modal | Redirect when payment completes |
| **Callback** | Webhook called after payment | Server-to-server callback with encryption |
| **Status Update** | Can use either return or webhook | Must use callback/webhook |
| **Authentication** | Uses signature verification | Uses AES-256-GCM encryption |
| **Auto-Redirect** | No (must handle manually) | Yes (redirects to return URL) |
| **Callback Content** | Plain JSON | AES-256-GCM encrypted JSON |

**Key Difference**: Razorpay can use the return URL to update status, but GetEpay requires the encrypted callback for security.

## Quick Fix Checklist

- [ ] Make sure both backend AND frontend servers are running
- [ ] Run `npm run dev` in CMS-Backend to start backend
- [ ] Run `npm start` in frontend directory to start frontend
- [ ] Test callback manually: `node test-callback.js <PAYMENT_ID> SUCCESS`
- [ ] Check backend logs for `[CALLBACK]` messages
- [ ] Verify payment status with: `curl http://localhost:8080/api/v1/payments/<ID>`
- [ ] If status updates in test, problem is with GetEpay's callback URL config
- [ ] If status doesn't update in test, there's a database/decryption issue

## Still Stuck?

Share these logs with your support:
1. Output from `node test-callback.js` command
2. Backend console output showing [CALLBACK] messages
3. Your payment ID and status
