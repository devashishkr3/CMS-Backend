# Bulk Student Upload API Documentation

## Overview
This API allows you to create, update, and upload students in bulk using either JSON or Excel files. Perfect for admitting large batches of students with minimal data entry.

---

## Table of Contents
1. [Bulk Create Students (JSON)](#1-bulk-create-students-json)
2. [Bulk Upload from Excel](#2-bulk-upload-from-excel-file)
3. [Bulk Update Students](#3-bulk-update-students)
4. [Sample Data Templates](#sample-data-templates)
5. [Error Handling](#error-handling)

---

## 1. Bulk Create Students (JSON)

### Endpoint
```
POST /api/students/bulk/create
```

### Authentication
- **Required**: Yes
- **Roles**: ADMIN, HOD

### Request Headers
```json
{
  "Authorization": "Bearer <your_token>",
  "Content-Type": "application/json"
}
```

### Request Body Schema
```json
{
  "students": [
    {
      "name": "Student Name",
      "fatherName": "Father Name",
      "university_roll": "2443551020001",
      "class_roll": "316", // Optional
      "email": "student@example.com", // Optional
      "phone": "9876543210", // Optional
      "dob": "2000-01-01", // Optional (ISO format)
      "gender": "MALE", // Optional: MALE, FEMALE, OTHER
      "category": "GENERAL", // Optional: GENERAL, BC_I, BC_II, SC, ST, EWS
      "address": "Student address" // Optional
    }
  ],
  "courseId": "56f51f44-5432-426d-aae0-a7718527e7ff",
  "sessionId": "fcb62f6c-fc0d-4e3e-acd2-d1fdd919496d",
  "semesterId": "388669fd-2744-4a3e-8f86-5aaba712cb0e",
  "departmentId": "b8266411-6f62-4207-8ce7-2200ffc7156c", // Optional
  "academicYear": "2024-25", // Optional, default: "2024-25"
  "admissionType": "NEW" // Optional: NEW, CONTINUATION
}
```

### Required Fields
- `students` (Array): Must contain at least 1 student
  - `name` (String, 2-100 chars)
  - `fatherName` (String, 2-100 chars)
  - `university_roll` (String, 5-50 chars) - **Must be unique**
- `courseId` (UUID)
- `sessionId` (UUID)
- `semesterId` (UUID)

### Success Response (201 Created)
```json
{
  "status": "success",
  "message": "Successfully created 950 out of 1000 students",
  "data": {
    "totalRecords": 1000,
    "successCount": 950,
    "failureCount": 50,
    "students": [
      {
        "id": "uuid",
        "name": "Student Name",
        "university_roll": "2443551020001",
        ...
      }
    ],
    "errors": [
      {
        "index": 5,
        "university_roll": "2443551020006",
        "error": "Duplicate university roll"
      }
    ]
  }
}
```

### Error Responses

#### 400 Bad Request - Validation Error
```json
{
  "status": "fail",
  "message": "Name should be at least 2 characters long"
}
```

#### 400 Bad Request - Duplicate University Roll
```json
{
  "status": "fail",
  "message": "Duplicate university rolls found: 2443551020001, 2443551020002"
}
```

#### 404 Not Found
```json
{
  "status": "fail",
  "message": "Course not found"
}
```

---

## 2. Bulk Upload from Excel File

### Endpoint
```
POST /api/students/bulk/upload-excel
```

### Authentication
- **Required**: Yes
- **Roles**: ADMIN, HOD

### Request Headers
```json
{
  "Authorization": "Bearer <your_token>",
  "Content-Type": "multipart/form-data"
}
```

### Form Data
- **file**: Excel file (.xlsx or .xls) - Required
- **courseId**: UUID - Required
- **sessionId**: UUID - Required
- **semesterId**: UUID - Required
- **departmentId**: UUID - Optional
- **academicYear**: String (format: YYYY-YY) - Optional, default: "2024-25"
- **admissionType**: String (NEW or CONTINUATION) - Optional, default: "NEW"

### Excel Format Requirements

#### Column Headers (Case-sensitive)
| Column Name | Required | Description |
|------------|----------|-------------|
| `name` | ✅ Yes | Student's full name |
| `fatherName` | ✅ Yes | Father's name |
| `university_roll` | ✅ Yes | University roll number (must be unique) |
| `class_roll` | ❌ Optional | Class/college roll number |
| `MAJOR SUBJECT` | ❌ Optional | Major subject name |
| `MINOR SUBJECT` | ❌ Optional | Minor subject name |

#### Sample Excel Structure
```
| S No. | name          | fatherName      | university_roll | class_roll | MAJOR SUBJECT | MINOR SUBJECT |
|-------|---------------|-----------------|-----------------|------------|---------------|---------------|
| 1     | EESHA KUMARI  | RAMLAGAN PASWAN | 2443541190001   | 389        | PHILOSOPHY    | HINDI         |
| 2     | HEMA KUMARI   | RAKESH GIRI     | 2443541190002   | 468        | PHILOSOPHY    | HINDI         |
```

### cURL Example
```bash
curl -X POST http://localhost:3000/api/students/bulk/upload-excel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@chemistry-45-sem-5.xlsx" \
  -F "courseId=56f51f44-5432-426d-aae0-a7718527e7ff" \
  -F "sessionId=fcb62f6c-fc0d-4e3e-acd2-d1fdd919496d" \
  -F "semesterId=388669fd-2744-4a3e-8f86-5aaba712cb0e" \
  -F "departmentId=b8266411-6f62-4207-8ce7-2200ffc7156c" \
  -F "academicYear=2024-25" \
  -F "admissionType=NEW"
```

### Success Response (201 Created)
```json
{
  "status": "success",
  "message": "Successfully created 950 out of 1000 students",
  "data": {
    "totalRecords": 1000,
    "successCount": 950,
    "failureCount": 50,
    "students": [...],
    "errors": [...]
  }
}
```

### Error Responses

#### 400 Bad Request - No File
```json
{
  "status": "fail",
  "message": "Please upload an Excel file (.xlsx or .xls)"
}
```

#### 400 Bad Request - Excel Parsing Error
```json
{
  "status": "fail",
  "message": "Excel parsing failed: Cannot find first sheet"
}
```

#### 400 Bad Request - Validation Errors
```json
{
  "status": "fail",
  "message": "Validation failed for 5 records",
  "errors": [
    {
      "row": 5,
      "errors": ["Invalid name at row 5", "Invalid university roll at row 5"]
    }
  ]
}
```

---

## 3. Bulk Update Students

### Endpoint
```
PATCH /api/students/bulk/update
```

### Authentication
- **Required**: Yes
- **Roles**: ADMIN, HOD

### Request Body Schema
```json
{
  "students": [
    {
      "id": "student-uuid-1",
      "university_roll": "2443551020001",
      "class_roll": "316",
      "name": "Updated Name",
      "fatherName": "Updated Father Name"
    }
  ]
}
```

### Required Fields
- `students` (Array): Must contain at least 1 student
  - `id` (UUID) - Student ID to update
  - `university_roll` (String) - New university roll

### Optional Fields
- `class_roll` (String)
- `name` (String)
- `fatherName` (String)

### Success Response (200 OK)
```json
{
  "status": "success",
  "message": "Successfully updated 98 out of 100 students",
  "data": {
    "totalRecords": 100,
    "successCount": 98,
    "failureCount": 2,
    "students": [...],
    "errors": [
      {
        "id": "invalid-uuid",
        "university_roll": "2443551020001",
        "error": "Student not found"
      }
    ]
  }
}
```

---

## Sample Data Templates

### Template 1: Chemistry Students (Your Use Case)

```json
{
  "students": [
    {
      "name": "AMISHA KUMARI",
      "fatherName": "VIPIN KUMAR",
      "university_roll": "2443551020001",
      "class_roll": "223"
    },
    {
      "name": "ANANYA KUMARI",
      "fatherName": "LALAN KUMAR SINGH",
      "university_roll": "2443551020002",
      "class_roll": "87"
    },
    {
      "name": "ANJANI KUMARI",
      "fatherName": "VINOD YADAV",
      "university_roll": "2443551020003",
      "class_roll": "300"
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

### Template 2: Minimal Data (Only Required Fields)

```json
{
  "students": [
    {
      "name": "Student One",
      "fatherName": "Father One",
      "university_roll": "244355102999"
    },
    {
      "name": "Student Two",
      "fatherName": "Father Two",
      "university_roll": "244355103000"
    }
  ],
  "courseId": "56f51f44-5432-426d-aae0-a7718527e7ff",
  "sessionId": "fcb62f6c-fc0d-4e3e-acd2-d1fdd919496d",
  "semesterId": "388669fd-2744-4a3e-8f86-5aaba712cb0e"
}
```

---

## Error Handling

### Common Error Codes

| HTTP Status | Error Type | Description |
|-------------|-----------|-------------|
| 400 | Validation Error | Invalid input data format |
| 400 | Duplicate Error | University roll already exists |
| 400 | File Error | Invalid file type or size |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Course/Session/Semester not found |
| 500 | Server Error | Internal server error |

### Batch Processing Behavior

1. **Atomic Operations**: Each student is processed independently
2. **Partial Success**: If some students fail, others are still created
3. **Error Reporting**: Failed records are returned with error messages
4. **Rollback**: If a critical error occurs, entire batch is rolled back

### Best Practices

1. **Validate Before Upload**:
   - Check for duplicate university rolls in your data
   - Ensure all required fields are present
   - Verify UUIDs are valid

2. **Batch Size**:
   - Recommended: 50-100 students per request
   - Maximum: No hard limit, but larger batches take longer

3. **File Upload**:
   - Use .xlsx format for better compatibility
   - Keep file size under 5MB
   - Ensure column headers match exactly

4. **Error Recovery**:
   - Save the response errors array
   - Fix issues in your data
   - Re-upload only failed records

---

## Testing with Postman

### Collection Setup

1. **Base URL**: `http://localhost:3000/api`
2. **Auth Token**: Add to Authorization tab → Bearer Token

### Request Examples

#### 1. Bulk Create (JSON)
- **Method**: POST
- **URL**: `/students/bulk/create`
- **Body**: raw JSON (use template above)

#### 2. Bulk Upload (Excel)
- **Method**: POST
- **URL**: `/students/bulk/upload-excel`
- **Body**: form-data
  - Key: `file`, Type: File, Value: select your .xlsx file
  - Key: `courseId`, Type: Text, Value: your course UUID
  - Key: `sessionId`, Type: Text, Value: your session UUID
  - Key: `semesterId`, Type: Text, Value: your semester UUID
  - Key: `departmentId`, Type: Text, Value: your department UUID

#### 3. Bulk Update
- **Method**: PATCH
- **URL**: `/students/bulk/update`
- **Body**: raw JSON

---

## Performance Notes

- **Processing Speed**: ~50-100 students per second
- **Database Transactions**: Uses Prisma transactions for data integrity
- **Batching**: Automatically processes in batches of 50
- **Memory**: Efficient streaming for Excel files

---

## Support

For issues or questions:
1. Check error response messages
2. Validate your JSON/Excel format
3. Ensure all UUIDs are valid
4. Contact system administrator for server errors
