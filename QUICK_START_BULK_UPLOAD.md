# Quick Start Guide - Bulk Student Upload

## Your Use Case: Chemistry Department 5th Semester Students

You have:
- **Course**: Chemistry
- **Department**: Chemistry  
- **Session**: 2022-2026
- **Semester**: 5th
- **Data Available**: name, fatherName, class_roll, university_roll only

## Fixed IDs (Use these in all requests)
```javascript
courseId = "56f51f44-5432-426d-aae0-a7718527e7ff"
departmentId = "b8266411-6f62-4207-8ce7-2200ffc7156c"
sessionId = "fcb62f6c-fc0d-4e3e-acd2-d1fdd919496d"
semesterId = "388669fd-2744-4a3e-8f86-5aaba712cb0e"
```

---

## Method 1: Upload Excel File (RECOMMENDED - Easiest!)

### Step 1: Prepare Your Excel File
Your Excel file should have these columns (first row = headers):

| name | fatherName | university_roll | class_roll |
|------|------------|-----------------|------------|
| EESHA KUMARI | RAMLAGAN PASWAN | 2443541190001 | 389 |
| HEMA KUMARI | RAKESH GIRI | 2443541190002 | 468 |

**Important**: 
- Column names must match exactly (case-sensitive)
- `name`, `fatherName`, `university_roll` are required
- `class_roll` is optional

### Step 2: Use Postman/cURL to Upload

#### Postman Steps:
1. **Method**: POST
2. **URL**: `http://localhost:3000/api/students/bulk/upload-excel`
3. **Headers** → Authorization → Type: Bearer Token → Enter your admin token
4. **Body** → form-data → Add these fields:
   - Key: `file` | Type: File | Value: Click "Select Files" and choose your Excel
   - Key: `courseId` | Type: Text | Value: `56f51f44-5432-426d-aae0-a7718527e7ff`
   - Key: `sessionId` | Type: Text | Value: `fcb62f6c-fc0d-4e3e-acd2-d1fdd919496d`
   - Key: `semesterId` | Type: Text | Value: `388669fd-2744-4a3e-8f86-5aaba712cb0e`
   - Key: `departmentId` | Type: Text | Value: `b8266411-6f62-4207-8ce7-2200ffc7156c`
   - Key: `academicYear` | Type: Text | Value: `2024-25`
   - Key: `admissionType` | Type: Text | Value: `NEW`

5. Click **Send**

#### cURL Command (Copy-Paste):
```bash
curl -X POST http://localhost:3000/api/students/bulk/upload-excel \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \
  -F "file=@/path/to/chemistry-45-sem-5.xlsx" \
  -F "courseId=56f51f44-5432-426d-aae0-a7718527e7ff" \
  -F "sessionId=fcb62f6c-fc0d-4e3e-acd2-d1fdd919496d" \
  -F "semesterId=388669fd-2744-4a3e-8f86-5aaba712cb0e" \
  -F "departmentId=b8266411-6f62-4207-8ce7-2200ffc7156c" \
  -F "academicYear=2024-25" \
  -F "admissionType=NEW"
```

### Expected Response:
```json
{
  "status": "success",
  "message": "Successfully created 45 out of 45 students",
  "data": {
    "totalRecords": 45,
    "successCount": 45,
    "failureCount": 0,
    "students": [...]
  }
}
```

---

## Method 2: Upload JSON File

### Step 1: Create JSON File
Save this as `students.json`:

```json
{
  "students": [
    {
      "name": "EESHA KUMARI",
      "fatherName": "RAMLAGAN PASWAN",
      "university_roll": "2443541190001",
      "class_roll": "389"
    },
    {
      "name": "HEMA KUMARI",
      "fatherName": "RAKESH GIRI",
      "university_roll": "2443541190002",
      "class_roll": "468"
    }
  ],
  "courseId": "56f51f44-5432-426d-aae0-a7718527e7ff",
  "sessionId": "fcb62f6c-fc0d-4e3e-acd2-d1fdd919496d",
  "semesterId": "388669fd-2744-4a3e-8f86-5aaba712cb0e",
  "departmentId": "b8266411-6f62-4207-8ce7-2200ffc7156c",
  "academicYear": "2024-25",
  "admissionType": "NEW"
}
```

### Step 2: Upload with Postman/cURL

#### Postman:
1. **Method**: POST
2. **URL**: `http://localhost:3000/api/students/bulk/create`
3. **Headers** → Authorization → Bearer Token
4. **Body** → raw → JSON → Paste your JSON
5. Click **Send**

#### cURL:
```bash
curl -X POST http://localhost:3000/api/students/bulk/create \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d @students.json
```

---

## Installation Steps (First Time Only)

1. **Install Dependencies**:
```bash
npm install
```

This will install the `xlsx` package needed for Excel parsing.

2. **Start Server**:
```bash
npm run dev
```

---

## Common Errors & Solutions

### Error: "Duplicate university rolls found"
**Reason**: A student with this university_roll already exists in database.
**Solution**: Remove duplicate entries from your Excel/JSON or use different university_roll numbers.

### Error: "Validation failed for X records"
**Reason**: Missing required fields (name, fatherName, university_roll).
**Solution**: Check the error response - it tells you which rows have issues. Fix those rows and re-upload.

### Error: "Course not found" / "Session not found"
**Reason**: Invalid UUID in courseId/sessionId/semesterId.
**Solution**: Copy-paste the exact IDs from above. Don't type manually.

### Error: "Please upload an Excel file"
**Reason**: File field is missing or empty.
**Solution**: Make sure you're using `form-data` and the key is exactly `file`.

### Error: "Invalid file type"
**Reason**: File is not .xlsx or .xls format.
**Solution**: Save your Excel file as `.xlsx` format.

---

## Testing with Sample Data

I've created a sample file `sample-chemistry-students.json` with 45 Chemistry students. You can test with this:

```bash
# Test JSON upload
curl -X POST http://localhost:3000/api/students/bulk/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @sample-chemistry-students.json
```

---

## What Happens Behind the Scenes?

When you upload:

1. **Validation**: Checks all data is valid (required fields, unique rolls, etc.)
2. **Duplicate Check**: Ensures no university_roll already exists in database
3. **Student Creation**: Creates each student with:
   - Auto-generated `reg_no` and `uan_no`
   - Auto-generated `class_roll` if not provided
   - Status: ACTIVE
4. **Semester Assignment**: Automatically assigns to 5th semester
5. **Admission Record**: Creates admission history
6. **Audit Log**: Logs the entire operation

All operations use **database transactions** - if any step fails, that student is rolled back but others continue.

---

## Batch Processing

- Processes **50 students at a time** (prevents memory overload)
- Each batch is independent
- Returns detailed success/failure report
- Can handle 1000+ students easily

---

## Next Steps After Upload

Once uploaded successfully:

1. Students can login with their credentials
2. They're enrolled in 5th semester
3. They can access their dashboard
4. Fee payment links can be generated
5. Marks can be entered
6. Certificates can be requested

---

## Pro Tips

1. **Test with small batch first** (5-10 students) before uploading all 950
2. **Keep Excel file under 5MB**
3. **Use exact column headers** in Excel
4. **Save your admin token** in Postman environment variables
5. **Check response carefully** - it tells you exactly which rows failed and why
6. **Backup your data** before bulk operations

---

## Need Help?

1. Read full documentation: `BULK_STUDENT_UPLOAD_GUIDE.md`
2. Check sample JSON: `sample-chemistry-students.json`
3. Look at error messages - they're very descriptive
4. Test with small batches first

---

**Remember**: University roll must be UNIQUE. No duplicates allowed!
