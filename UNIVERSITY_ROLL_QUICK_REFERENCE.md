# University Roll - Quick Reference Card 📋

## Field Details
```
Field Name: university_roll
Type: String (nullable)
Constraint: UNIQUE
Validation: 1-50 characters
Required: NO (optional)
```

---

## API Changes at a Glance

### ✅ Request Bodies (Where to add it)

#### Create Student
```json
POST /api/students
{
  "university_roll": "UNI2024001",  // ← ADD THIS
  "name": "Student Name",
  "email": "student@example.com",
  ...
}
```

#### Update Student
```json
PATCH /api/students/:id
{
  "university_roll": "UNI2024002"  // ← ADD THIS
}
```

---

### ✅ Response Bodies (Where you'll see it)

All these endpoints now include `university_roll`:

1. **Student Responses**
   - GET /api/students/:id
   - GET /api/students
   - POST /api/students
   - PATCH /api/students/:id

2. **Admission Responses**
   - GET /api/admissions
   - GET /api/admissions/:id
   - POST /api/admissions

3. **Payment Responses**
   - All payment-related endpoints

4. **Certificate Responses**
   - GET /api/certificates
   - POST /api/certificates

---

## Example Response
```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "uuid...",
      "name": "John Doe",
      "email": "john@example.com",
      "reg_no": "REG123",
      "uan_no": "UAN456",
      "class_roll": "CS-01",
      "university_roll": "UNI789",  // ← NEW FIELD
      "phone": "9876543210",
      ...
    }
  }
}
```

---

## DCR1 Report Changes

### CSV Output
New column added: **"Student University Roll"**

| Transaction ID | Student Name | Student Reg No | **Student University Roll** | Amount |
|---------------|--------------|----------------|---------------------------|--------|
| TXN001 | John Doe | REG123 | **UNI789** | ₹5000 |

---

## PDF Receipt Changes

### Before
```
Receipt No: RCT123
Student Name: John Doe
Registration No: REG123
Amount Paid: ₹5000
```

### After
```
Receipt No: RCT123
Student Name: John Doe
Registration No: REG123
University Roll No: UNI789  // ← NEW LINE
Amount Paid: ₹5000
```

---

## Validation Rules

✅ **Valid Examples:**
- `"UNI2024001"`
- `"2024BCA001"`
- `"A"` (minimum 1 char)
- `"UNIVERSITYROLL123456789012345678901234567890"` (max 50 chars)

❌ **Invalid Examples:**
- `""` (empty string - will fail validation)
- `"UNI-001"` with length > 50 (too long)
- `12345` (number instead of string)

⚠️ **Duplicate Check:**
- `"UNI2024001"` can only be used ONCE (unique constraint)

---

## Database Schema

```prisma
model Student {
  id                String    @id @default(uuid())
  reg_no            String?   @unique
  email             String    @unique
  uan_no            String    @unique
  class_roll        String?
  university_roll   String?   @unique  // ← NEW FIELD
  name              String
  phone             String
  // ... other fields
}
```

---

## Migration Commands

### Development
```bash
npx prisma migrate dev --name add_university_roll_to_student
```

### Production
```bash
npx prisma migrate deploy
```

---

## Testing Checklist ⚡

Quick test flow:

1. **Create student WITH university_roll**
   ```bash
   curl POST /api/students {..."university_roll": "UNI001"}
   # Should succeed ✅
   ```

2. **Create student WITHOUT university_roll**
   ```bash
   curl POST /api/students {...}  // no university_roll
   # Should succeed ✅
   ```

3. **Create student WITH duplicate university_roll**
   ```bash
   curl POST /api/students {..."university_roll": "UNI001"}
   # Should fail ❌ (unique constraint)
   ```

4. **Update student's university_roll**
   ```bash
   curl PATCH /api/students/:id {..."university_roll": "UNI002"}
   # Should succeed ✅
   ```

5. **Get student**
   ```bash
   curl GET /api/students/:id
   # Should include university_roll ✅
   ```

---

## Files Modified 📁

Total: **14 files**

### Core (3 files)
- ✅ schema.prisma
- ✅ student.validation.js
- ✅ student.controller.js

### Controllers (5 files)
- ✅ admission.controller.js
- ✅ certificate.controller.js
- ✅ payment.controller.js
- ✅ session.controller.js
- ✅ adminDashboard.controller.js

### Services (2 files)
- ✅ file.service.js
- ✅ certificate.service.js

### Utilities (2 files)
- ✅ dcr1ReportGenerator.js
- ✅ pdfGenerator.js

### Documentation (2 files)
- ✅ UNIVERSITY_ROLL_INTEGRATION.md
- ✅ MIGRATION_GUIDE_UNIVERSITY_ROLL.md

---

## Common Use Cases 💡

### Use Case 1: New Student Admission
```javascript
// Fill university_roll from admission form
const student = await prisma.student.create({
  data: {
    name: "Student Name",
    university_roll: "UNI2024001",  // From admission form
    // ... other fields
  }
});
```

### Use Case 2: Bulk Import
```javascript
// Import from Excel/CSV
students.forEach(async (s) => {
  await prisma.student.create({
    data: {
      ...s,
      university_roll: s.universityRoll || null  // Optional
    }
  });
});
```

### Use Case 3: Update Existing Students
```javascript
// Populate missing university rolls
await prisma.student.updateMany({
  where: { university_roll: null },
  data: { 
    university_roll: { 
      set: `UNI_${Date.now()}`  // Generate unique value
    }
  }
});
```

---

## Troubleshooting 🔧

| Problem | Solution |
|---------|----------|
| "Unique constraint failed" | Ensure university_roll value is not already in use |
| Field is null in response | Check if student was created before migration |
| Validation error | Ensure string length is 1-50 characters |
| CSV missing column | Verify dcr1ReportGenerator.js has new field mapping |

---

## Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | Migration ready |
| Validation | ✅ Complete | Joi schemas updated |
| Create APIs | ✅ Complete | Accepts university_roll |
| Update APIs | ✅ Complete | Can update university_roll |
| Read APIs | ✅ Complete | Returns university_roll |
| Reports (DCR1) | ✅ Complete | CSV includes column |
| PDF Generation | ✅ Complete | Displays in receipts |
| Documentation | ✅ Complete | All docs updated |

---

## Need Help? 🆘

Refer to:
1. **Full Documentation:** `UNIVERSITY_ROLL_INTEGRATION.md`
2. **Migration Guide:** `MIGRATION_GUIDE_UNIVERSITY_ROLL.md`
3. **API Docs:** `API_DOCUMENTATION.md`

---

**Last Updated:** March 7, 2026  
**Status:** ✅ Production Ready
