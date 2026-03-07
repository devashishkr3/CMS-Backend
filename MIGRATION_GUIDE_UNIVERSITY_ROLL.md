# University Roll Field - Migration & Deployment Guide

## 🚀 Quick Start

This guide will help you migrate and deploy the `university_roll` field integration safely.

---

## Prerequisites

- ✅ Backup your database before running migrations
- ✅ Ensure all team members have pulled the latest code
- ✅ Test environment should be updated first

---

## Step 1: Database Migration

### Development Environment
```bash
# Generate migration
npx prisma migrate dev --name add_university_roll_to_student

# This will:
# - Create a new migration file in prisma/migrations/
# - Apply migration to dev database
# - Regenerate Prisma Client
```

### Production Environment
```bash
# Apply existing migrations to production
npx prisma migrate deploy

# DO NOT use 'migrate dev' in production
```

---

## Step 2: Verify Migration

Check if the migration was successful:

```sql
-- Run this in your database client
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Student'
AND column_name = 'university_roll';
```

Expected output:
```
column_name     | data_type | is_nullable
university_roll | varchar   | YES
```

---

## Step 3: Update Existing Students (Optional)

If you want to populate `university_roll` for existing students:

```sql
-- Example: Set university_roll same as reg_no for existing students
UPDATE "Student"
SET university_roll = CONCAT('UNI_', reg_no)
WHERE university_roll IS NULL;
```

Or create a script:
```javascript
// scripts/populate-university-roll.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function populateUniversityRolls() {
  const students = await prisma.student.findMany({
    where: { university_roll: null }
  });

  console.log(`Updating ${students.length} students...`);

  for (const student of students) {
    await prisma.student.update({
      where: { id: student.id },
      data: {
        university_roll: `UNI_${student.reg_no || Date.now()}`
      }
    });
  }

  console.log('✅ University roll populated for all students');
  await prisma.$disconnect();
}

populateUniversityRolls().catch(console.error);
```

Run it:
```bash
node scripts/populate-university-roll.js
```

---

## Step 4: Deploy Application

### 1. Restart Application Server
```bash
# Stop current server
# Deploy new code
# Start server

# Example with PM2:
pm2 restart cms-backend
```

### 2. Verify Deployment
```bash
# Test creating a student with university_roll
curl -X POST http://localhost:8080/api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Student",
    "email": "test@example.com",
    "phone": "9876543210",
    "uan_no": "UAN_TEST_001",
    "university_roll": "UNI_TEST_001",
    "class_roll": "TEST-01",
    "departmentId": "YOUR_DEPT_ID",
    "courseId": "YOUR_COURSE_ID",
    "sessionId": "YOUR_SESSION_ID",
    "semesterId": "YOUR_SEMESTER_ID",
    "admissionType": "NEW",
    "academicYear": "2024-25"
  }'
```

---

## Step 5: Test All Endpoints

### Critical Endpoints Checklist

#### ✅ Student Management
- [ ] POST /api/students - Create student
- [ ] PATCH /api/students/:id - Update student
- [ ] GET /api/students/:id - Get single student
- [ ] GET /api/students - Get all students

#### ✅ Admissions
- [ ] POST /api/admissions - Create admission
- [ ] GET /api/admissions - Get all admissions
- [ ] GET /api/admissions/:id - Get admission by ID

#### ✅ Payments
- [ ] POST /api/payments - Create payment
- [ ] GET /api/payments/dcr1/range - Generate DCR1 report
- [ ] Check CSV has "Student University Roll" column

#### ✅ Certificates
- [ ] POST /api/certificates - Create certificate request
- [ ] GET /api/certificates - Get certificates

#### ✅ Verification
- [ ] POST /api/students/verify-student - Verify student for admission

---

## Step 6: Monitor Logs

Watch for any errors related to the new field:

```bash
# Example with PM2
pm2 logs cms-backend --lines 100

# Look for:
# - Prisma errors
# - Validation errors
# - Unique constraint violations
```

---

## Rollback Plan

If something goes wrong:

### 1. Rollback Migration
```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

### 2. Restore from Backup
```bash
# Restore database from backup created in prerequisites
psql -U username -d database_name < backup.sql
```

### 3. Revert Code
```bash
git revert HEAD
pm2 restart cms-backend
```

---

## Common Issues & Solutions

### Issue 1: Unique Constraint Violation
**Error:** `Unique constraint failed on the fields: (\`university_roll\`)`

**Solution:** 
- Ensure you're not trying to insert duplicate university rolls
- Populate existing students with unique values before enforcing uniqueness

### Issue 2: Migration Fails in Production
**Error:** Migration timeout or failure

**Solution:**
- Check database connection
- Ensure no long-running transactions are blocking
- Try running migration during low-traffic period

### Issue 3: API Returns Null for university_roll
**Cause:** Old cached Prisma Client

**Solution:**
```bash
# Regenerate Prisma Client
npx prisma generate

# Restart application
pm2 restart cms-backend
```

### Issue 4: CSV Reports Missing University Roll Column
**Cause:** Payment objects don't include university_roll

**Solution:**
- Verify all payment controller select statements include university_roll
- Check dcr1ReportGenerator.js has the new column mapping

---

## Performance Considerations

### Index Impact
The `@unique` decorator automatically creates an index on `university_roll`.

**Check index:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Student';
```

### Query Performance
No significant performance impact expected as:
- It's a simple string field
- Indexed via unique constraint
- No additional joins required

---

## Post-Migration Tasks

### 1. Update Documentation
- [ ] Update API documentation
- [ ] Update frontend integration guides
- [ ] Inform team about the new field

### 2. Frontend Updates
Coordinate with frontend team to:
- [ ] Add `university_roll` input field in student forms
- [ ] Display `university_roll` in student profiles
- [ ] Update validation rules in UI

### 3. Data Entry
Plan for data entry if migrating existing students:
- [ ] Bulk import university rolls from legacy system
- [ ] Manual entry process for missing data
- [ ] Validation and cleanup of imported data

---

## Success Criteria

Migration is successful when:

✅ All endpoints return `university_roll` in responses
✅ New students can be created with `university_roll`
✅ Existing students without `university_roll` still work
✅ DCR1 reports include "Student University Roll" column
✅ PDF receipts display university roll number
✅ No errors in application logs
✅ All automated tests pass

---

## Support Contacts

If you encounter issues:

1. **Database Issues:** Check with DBA team
2. **Application Errors:** Review logs and error messages
3. **Prisma Issues:** Check Prisma documentation
4. **Migration Problems:** Refer to rollback plan

---

## Timeline Recommendation

| Phase | Environment | When |
|-------|-------------|------|
| 1 | Development | Immediately |
| 2 | Staging/UAT | After dev testing |
| 3 | Production | During maintenance window |

**Recommended:** Deploy to production during low-traffic hours (e.g., late night or weekend)

---

## Final Checklist

Before marking migration complete:

- [ ] Database backup created
- [ ] Migration applied successfully
- [ ] Prisma Client regenerated
- [ ] All endpoints tested
- [ ] Logs monitored for errors
- [ ] Frontend team notified
- [ ] Documentation updated
- [ ] Rollback plan documented
- [ ] Team trained on new field

---

**Last Updated:** Saturday, March 7, 2026
**Version:** 1.0
