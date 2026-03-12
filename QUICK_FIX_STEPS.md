# 🚀 Immediate Action Plan - Fix Production Payment Gateway

## ⏱️ Estimated Time: 10-15 minutes

---

## Step 1: SSH into Production Server (2 minutes)

```bash
# Connect to your production server
ssh user@api.santsandhyadasmahilacollege.org
# or whatever your production server SSH command is
```

---

## Step 2: Navigate to Project Directory (1 minute)

```bash
cd /Users/adityasuman2/Desktop/projects/CMS/CMS-Backend
# OR your actual production path
```

---

## Step 3: Update Environment Variables (3 minutes)

### Option A: Edit .env file directly

```bash
nano .env
# or vim .env
```

**Add or update these lines:**

```bash
# CRITICAL FIX - Update this URL:
GETEPAY_URL=https://portal.getepay.in:8443/getepayPortal/pg/v2/generateInvoice

# Verify these are correct:
GETEPAY_MID=1379045
GETEPAY_TERMINAL_ID=getepay.merchant989958@vvsbbank
GETEPAY_KEY=<YOUR_ACTUAL_PRODUCTION_KEY_HERE>
GETEPAY_IV=getepay.merchant989958@vvsbbank
GETEPAY_RETURN_URL=https://api.santsandhyadasmahilacollege.org/api/v1/payments/return
GETEPAY_CALLBACK_URL=https://api.santsandhyadasmahilacollege.org/api/v1/payments/callback
NODE_ENV=production
```

**Save and exit:**
- Nano: `Ctrl+O`, `Enter`, `Ctrl+X`
- Vim: `:wq`, `Enter`

### Option B: Use export commands (temporary until restart)

```bash
export GETEPAY_URL=https://portal.getepay.in:8443/getepayPortal/pg/v2/generateInvoice
```

---

## Step 4: Validate Configuration (2 minutes)

```bash
# Run the validation script
node validate-production-payment-config.js
```

**Expected output:**
```
✅ VALIDATION PASSED
Your GetEpay configuration appears to be correctly set up.
```

**If you see errors**, fix them before proceeding.

---

## Step 5: Restart Application (2 minutes)

```bash
# If using PM2
pm2 restart cms-back

# Check status
pm2 status

# Watch logs
pm2 logs cms-back --lines 50
```

---

## Step 6: Test Payment Link Generation (3 minutes)

### Method 1: Through Frontend
1. Open your application's admin panel
2. Navigate to payment section
3. Create a test payment (small amount like ₹10)
4. Click "Generate Payment Link"
5. Check if payment link is generated successfully

### Method 2: Using cURL (if API testing)

```bash
curl -X POST https://api.santsandhyadasmahilacollege.org/api/v1/payments/<PAYMENT_ID>/generate-link \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json"
```

### Check Logs:

```bash
pm2 logs cms-back --lines 100
```

**Look for success indicators:**
```
✅ Payment found: RCT-XXX, Amount: XXXX
🔐 Encrypting payload...
✅ Encrypted successfully
🚀 Calling GetEpay API at: https://portal.getepay.in:8443/...
✅ GetEpay API response status: 200
✅ Payment link generated successfully
```

**NOT this:**
```
❌ Received HTML response from GetEpay
❌ Gateway returned HTML error page
```

---

## Step 7: Verify Complete Flow (2 minutes)

1. **Payment link opens**: Click the generated link
2. **Gateway loads**: GetEpay payment page should appear
3. **Amount matches**: Verify displayed amount is correct
4. **Test transaction** (optional): Complete a small test payment

---

## ✅ Success Criteria

You'll know it's fixed when:

- ✅ No HTML error in logs
- ✅ Payment link generates successfully
- ✅ Response includes `paymentUrl` field
- ✅ Can access GetEpay payment page
- ✅ HTTP status 200 in logs

---

## ❌ If Still Failing

### Quick Diagnostics:

```bash
# 1. Verify URL is correct
echo $GETEPAY_URL
# Should show: https://portal.getepay.in:8443/getepayPortal/pg/v2/generateInvoice

# 2. Test network connectivity
curl -I https://portal.getepay.in:8443

# 3. Check PM2 environment variables
pm2 show cms-back | grep GETEPAY

# 4. View recent errors
pm2 logs cms-back --err --lines 50
```

### Common Issues:

1. **Still seeing HTML error**: 
   - Verify URL is EXACTLY: `https://portal.getepay.in:8443/getepayPortal/pg/v2/generateInvoice`
   - Check for typos in port number (:8443)

2. **Environment variables not loading**:
   - Restart PM2: `pm2 restart all`
   - Or reload: `pm2 reload cms-back`

3. **Connection timeout**:
   - Check firewall: `sudo ufw status`
   - Allow outbound: `sudo ufw allow out 8443/tcp`

---

## 📞 Emergency Contacts

If issues persist after following all steps:

**GetEpay Support:**
- Email: support@getepay.in
- Phone: [Check your merchant documentation]
- Provide: MID 1379045, Terminal ID, error logs

**Your Team:**
- Tag backend developer on call
- Share pm2 logs output
- Share validation script output

---

## 🔄 Rollback Plan

If the fix causes unexpected issues:

```bash
# 1. Revert to old URL (if it was working before)
export GETEPAY_URL=<PREVIOUS_WORKING_URL>
pm2 restart cms-back

# 2. Disable payment gateway temporarily
# Comment out payment routes in src/routes/payment.routes.js
# pm2 restart cms-back
```

---

## 📝 Post-Fix Verification

After successful deployment:

1. ✅ Document the change in your changelog
2. ✅ Update team about the fix
3. ✅ Monitor next 10-20 payment transactions
4. ✅ Keep validation script in repository
5. ✅ Add URL check to deployment checklist

---

## 🔧 Maintenance Commands

```bash
# View current config
pm2 show cms-back

# Watch live logs
pm2 logs cms-back

# Restart service
pm2 restart cms-back

# Check error logs only
pm2 logs cms-back --err

# Memory/CPU usage
pm2 monit
```

---

**Good luck! The fix is straightforward - just update the URL with correct port and path.** 🚀
