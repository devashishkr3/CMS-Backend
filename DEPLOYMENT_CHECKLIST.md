# 🚀 Deployment Checklist - GetEpay Payment Gateway

## Pre-Deployment Phase (Development)

### ✅ Code Quality
- [ ] No JavaScript console errors
- [ ] No linting errors
- [ ] All imports resolved
- [ ] No syntax errors
- [ ] Review error logs: `src/utils/error.js`

**Verify:**
```bash
npm run lint  # if available
npm test     # if tests exist
```

### ✅ Environment Setup
- [ ] `.env` file exists with all required variables
- [ ] All GETEPAY_* variables set
- [ ] Database URL configured
- [ ] JWT secrets configured
- [ ] No hardcoded credentials

**Check:**
```bash
grep -E "GETEPAY|JWT|DATABASE" .env | grep -v "^#"
```

### ✅ Database
- [ ] Prisma migrations run: `npx prisma migrate deploy`
- [ ] Database connected: `npx prisma db push`
- [ ] Payment tables visible: `npx prisma studio`
- [ ] All models present in schema

```bash
npx prisma migrate status
```

### ✅ Code Review
- [ ] `src/controllers/payment.controller.js` reviewed
- [ ] `src/routes/payment.routes.js` reviewed
- [ ] `src/routes/student.routes.js` reviewed
- [ ] `.env` configuration reviewed
- [ ] Error handling verified

---

## Testing Phase

### ✅ Unit Testing
- [ ] Create payment endpoint works
- [ ] Generate link endpoint works
- [ ] Callback endpoint works
- [ ] Return endpoint works
- [ ] All status transitions valid

**Follow:** [TESTING_VERIFICATION_GUIDE.md - Phase 1-3](./TESTING_VERIFICATION_GUIDE.md)

### ✅ Integration Testing
- [ ] Complete payment flow works end-to-end
- [ ] Admission status updates on success
- [ ] Receipt generated correctly
- [ ] Audit logs created
- [ ] Email notifications sent (if configured)

**Follow:** [TESTING_VERIFICATION_GUIDE.md - Phase 4-9](./TESTING_VERIFICATION_GUIDE.md)

### ✅ Security Testing
- [ ] Encryption/decryption works
- [ ] Unauthorized access blocked (401)
- [ ] Permission denied works (403)
- [ ] Student can't access others' payments
- [ ] Rate limiting active

**Follow:** [TESTING_VERIFICATION_GUIDE.md - Phase 10](./TESTING_VERIFICATION_GUIDE.md)

### ✅ Error Scenario Testing
- [ ] Invalid payment ID handled
- [ ] Missing authentication handled
- [ ] Invalid status transitions handled
- [ ] GetEpay API errors handled
- [ ] Callback decryption errors handled

---

## Staging Deployment

### ✅ Pre-Deployment
- [ ] All tests passed in development
- [ ] Code reviewed and approved
- [ ] Documentation verified
- [ ] No pending issues

### ✅ Staging Environment Setup
```bash
# Update staging .env
FRONTEND_URL=https://staging.yourdomain.com
GETEPAY_RETURN_URL=https://staging-api.yourdomain.com/api/v1/payments/return
GETEPAY_CALLBACK_URL=https://staging-api.yourdomain.com/api/v1/payments/callback
NODE_ENV=staging
```

- [ ] Database migrated: `npx prisma migrate deploy`
- [ ] Environment variables set
- [ ] HTTPS/SSL configured
- [ ] API accessible from internet
- [ ] Callback URL publicly reachable

### ✅ Staging Testing
- [ ] Full test suite runs
- [ ] All endpoints responding
- [ ] Payment flow works end-to-end
- [ ] Callback received successfully
- [ ] Logs written to staging database

**Use:** [TESTING_VERIFICATION_GUIDE.md](./TESTING_VERIFICATION_GUIDE.md)

### ✅ Staging Security Hardening
- [ ] HTTPS enabled
- [ ] CORS configured correctly
- [ ] Rate limiting active
- [ ] Database backups configured
- [ ] Error logs monitored
- [ ] Monitoring/alerting set up

---

## Production Deployment

### ✅ Production Environment Preparation
- [ ] Production database created and secured
- [ ] Staging approval received
- [ ] GetEpay production credentials obtained
- [ ] SSL certificates installed
- [ ] Domain DNS configured
- [ ] Firewall rules configured
- [ ] Load balancer configured (if needed)

### ✅ Production Secrets Configuration

Create production `.env`:
```env
# ===== PRODUCTION =====
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@prod-db.rds.amazonaws.com/cms_db

# GetEpay Production Credentials
GETEPAY_MID=<production-mid>
GETEPAY_TERMINAL_ID=<production-terminal-id>
GETEPAY_KEY=<production-key-from-getepay>
GETEPAY_IV=<production-iv-from-getepay>
GETEPAY_URL=https://portal.getepay.in:8443/getepayPortal/pg/v2/generateInvoice

# Production URLs
FRONTEND_URL=https://yourdomain.com
GETEPAY_RETURN_URL=https://api.yourdomain.com/api/v1/payments/return
GETEPAY_CALLBACK_URL=https://api.yourdomain.com/api/v1/payments/callback

# JWT Secrets (Change these!)
JWT_ACCESS_SECRET=your-super-secret-access-key-change-me
JWT_ACCESS_EXPIRES_IN=10d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-me
JWT_REFRESH_EXPIRES_IN=10d

# Email Configuration (If available)
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=<sendgrid-key>
EMAIL_FROM=noreply@yourdomain.com

# Logging
LOG_LEVEL=info

# AWS/R2 Configuration
R2_ENDPOINT=https://your-r2-endpoint.r2.cloudflarestorage.com
R2_BUCKET_NAME=your-bucket
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
```

- [ ] All production credentials set
- [ ] No staging credentials in production
- [ ] Secrets encrypted in vault
- [ ] Access logs enabled
- [ ] Error tracking enabled (Sentry, etc.)

### ✅ Production Code Deployment
```bash
# Pull latest code
git pull origin production

# Install dependencies
npm install --production

# Run migrations
npx prisma migrate deploy

# Start server
npm start
# or with PM2: pm2 start src/server.js --name cms-backend
```

- [ ] Code deployed successfully
- [ ] Migrations applied
- [ ] Server started
- [ ] No startup errors
- [ ] Health endpoint responding

### ✅ Production Verification
```bash
# Check health
curl https://api.yourdomain.com/health

# Get API status
curl https://api.yourdomain.com/

# Monitor logs
tail -f /var/log/cms-backend/error.log
tail -f /var/log/cms-backend/access.log
```

- [ ] Server responding to requests
- [ ] HTTPS working
- [ ] Health check passes
- [ ] Logs being written
- [ ] Database connected

### ✅ Payment Gateway Production Test

**Important:** Use test credentials first!

```
1. Create Test Payment
   POST /api/v1/payments
   Amount: 0.01 (minimal amount for testing)
   
2. Generate Payment Link
   POST /api/v1/payments/{id}/generate-link
   
3. Complete Test Transaction
   Use GetEpay test card: 4111 1111 1111 1111
   
4. Verify Status Updated
   GET /api/v1/payments/{id}
   Status should be: SUCCESS
   
5. Verify Receipt Generated
   receiptUrl should be populated
```

- [ ] Payment can be created
- [ ] Payment link generates
- [ ] Payment completes successfully
- [ ] Status updates to SUCCESS
- [ ] Receipt generated
- [ ] Admission updated (if linked)

### ✅ Production Monitoring Setup
- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Performance monitoring enabled (New Relic, etc.)
- [ ] Log aggregation configured (ELK, etc.)
- [ ] Uptime monitoring configured
- [ ] Alert notifications configured
- [ ] Database backups enabled
- [ ] Database monitoring enabled
- [ ] Security scanning enabled

### ✅ Backup & Recovery
- [ ] Database backup schedule configured
- [ ] Backup retention policy set
- [ ] Backup encryption enabled
- [ ] Recovery procedure tested
- [ ] Disaster recovery plan documented
- [ ] Runbook created for incidents

---

## Post-Deployment

### ✅ Immediate Post-Deployment (First 24 hours)
- [ ] Monitor error logs
- [ ] Monitor database performance
- [ ] Monitor API response times
- [ ] Check payment success rate
- [ ] Verify email notifications
- [ ] Check audit logs
- [ ] Monitor server resources
- [ ] Review GetEpay transaction reports

### ✅ UAT Sign-Off
- [ ] Admin team tests payment creation
- [ ] Admin team tests payment link generation
- [ ] Admin team tests refunds
- [ ] Student users test self-service payments
- [ ] Finance team verifies receipts
- [ ] HR/Admission team verifies status updates
- [ ] All teams sign off on deployment

### ✅ Production Stabilization (First Week)
- [ ] Monitor daily error logs
- [ ] Check payment success metrics
- [ ] Verify admission updates
- [ ] Monitor certificate generation
- [ ] Check for any performance issues
- [ ] Review audit trail for anomalies
- [ ] Check GetEpay transaction reports
- [ ] Gather user feedback

### ✅ Documentation Updates
- [ ] Update API documentation with production URLs
- [ ] Update support docs with production procedures
- [ ] Update runbook with production settings
- [ ] Create incident response procedures
- [ ] Train support team
- [ ] Train admin team
- [ ] Update deployment docs

---

## Ongoing Maintenance

### ✅ Daily Tasks
- [ ] Monitor error logs
- [ ] Check payment success rate
- [ ] Verify GetEpay connectivity
- [ ] Check database health
- [ ] Monitor disk space

### ✅ Weekly Tasks
- [ ] Review payment statistics
- [ ] Verify backup completion
- [ ] Check security alerts
- [ ] Review user feedback
- [ ] Check GetEpay transaction reports

### ✅ Monthly Tasks
- [ ] Audit payment records
- [ ] Review access logs
- [ ] Update security patches
- [ ] Verify disaster recovery
- [ ] Optimize database performance
- [ ] Security audit
- [ ] Compliance review

### ✅ Quarterly Tasks
- [ ] Security penetration testing
- [ ] Database re-indexing
- [ ] Update GetEpay integration
- [ ] Compliance audit
- [ ] Disaster recovery drill
- [ ] Capacity planning review

---

## Rollback Plan (If Issues Occur)

### Immediate Actions
```bash
# Stop current deployment
pm2 stop cms-backend

# Check what to rollback to
git log --oneline | head -5

# Rollback to previous version
git checkout previous-version-hash

# Revert database changes (if needed)
npx prisma migrate resolve --rolled-back <migration-name>

# Restart server
npm install --production
npx prisma migrate deploy
pm2 start src/server.js --name cms-backend
```

- [ ] Previous version deployed
- [ ] Database consistency verified
- [ ] Services functional
- [ ] Users notified
- [ ] Root cause analysis started
- [ ] Fix developed
- [ ] Re-deployment scheduled

---

## Incident Response

### Payment Processing Down
1. [ ] Notify finance and admin teams
2. [ ] Check GetEpay status: https://portal.getepay.in
3. [ ] Check server logs for errors
4. [ ] Verify database connectivity
5. [ ] Check API response times
6. [ ] If GetEpay down: Direct students to account transfer
7. [ ] If server down: Restart service
8. [ ] Notify users of resolution
9. [ ] Post-incident review

### Data Corruption
1. [ ] Stop all payment operations
2. [ ] Restore from last known good backup
3. [ ] Verify data integrity
4. [ ] Identify affected records
5. [ ] Notify affected users
6. [ ] Reprocess affected transactions
7. [ ] Post-incident review

### Security Incident
1. [ ] Isolate affected systems
2. [ ] Review access logs
3. [ ] Check for data exposure
4. [ ] Notify security team
5. [ ] Change all credentials
6. [ ] Audit all accounts
7. [ ] Implement fixes
8. [ ] Post-incident review

---

## Sign-Off

### Technical Team
- [ ] Code review completed
- [ ] All tests passed
- [ ] Deployment verified
- [ ] Production verified
- [ ] Monitoring configured
- [ ] Documentation complete

**Technical Lead:** _________________ **Date:** _________

### Business Team
- [ ] Functionality verified
- [ ] UAT completed
- [ ] Payments processed correctly
- [ ] All stakeholders informed
- [ ] Support team trained
- [ ] Admin team trained

**Product Manager:** _________________ **Date:** _________

### Finance Team
- [ ] Receipt format correct
- [ ] Payment amounts accurate
- [ ] Ledger entries correct
- [ ] Reports working
- [ ] Audit trail complete

**Finance Manager:** _________________ **Date:** _________

---

## Emergency Contact List

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Technical Lead | | | |
| DevOps Lead | | | |
| DBA | | | |
| Finance Manager | | | |
| GetEpay Support | | +91-XXX-XXXXX | support@getepay.in |

---

## Useful Links

- **GetEpay Portal:** https://portal.getepay.in
- **GetEpay Support:** support@getepay.in
- **API Status:** https://api.yourdomain.com/health
- **Database Admin:** [Your DB Tool URL]
- **Monitoring Dashboard:** [Your Monitoring Tool URL]
- **Log Aggregation:** [Your Log Tool URL]

---

## Completion Summary

### Development ✅
- Code complete
- Tests complete
- Documentation complete

### Staging ✅
- Tests passed
- Security verified
- Performance verified

### Production ✅
- Deployment successful
- Monitoring active
- Team trained

**Deployment Date:** _______________  
**Go-Live Confirmed:** ✅ Yes ☐ No  

---

**Template Version:** 1.0  
**Last Updated:** 2024-02-24  
**Status:** Ready for Use

