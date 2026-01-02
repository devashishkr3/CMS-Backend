# College ERP API Documentation

Complete API documentation for the College ERP system with detailed request/response schemas, error handling, and validation rules.

## Base URL
```
https://your-domain.com/api/v1
```

## Authentication
All protected endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Common Response Format

### Success Response
```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": { ... },
  "results": 10
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Authentication Endpoints

### Register Admin
```
POST /auth/register
```

#### Request Body
```json
{
  "name": "string (min: 2, max: 100)",
  "email": "string (email format)",
  "password": "string (min: 8, max: 100)",
  "phone": "string (min: 10, max: 15)",
  "role": "ADMIN|HOD|ACCOUNTANT"
}
```

#### Validation
- `name`: Required, 2-100 characters
- `email`: Required, valid email format
- `password`: Required, minimum 8 characters
- `phone`: Required, 10-15 characters
- `role`: Required, must be one of specified values

#### Responses
- `201`: Admin registered successfully
- `400`: Validation errors
- `409`: Email already exists
- `500`: Server error

#### Example Request
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "1234567890",
  "role": "ADMIN"
}
```

#### Example Response
```json
{
  "status": "success",
  "message": "Admin registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "ADMIN",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### Login
```
POST /auth/login
```

#### Request Body
```json
{
  "email": "string (email format)",
  "password": "string"
}
```

#### Responses
- `200`: Login successful
- `400`: Invalid credentials
- `401`: Account inactive
- `500`: Server error

### Refresh Token
```
POST /auth/refresh
```

#### Request Body
```json
{
  "refreshToken": "string"
}
```

#### Responses
- `200`: Token refreshed
- `401`: Invalid token
- `500`: Server error

### Logout
```
POST /auth/logout
```

#### Responses
- `200`: Logout successful
- `401`: Invalid token
- `500`: Server error

## Student Management

### Create Student
```
POST /students
```
**Access**: ADMIN, HOD

#### Request Body
```json
{
  "name": "string (min: 2, max: 100)",
  "email": "string (email format)",
  "phone": "string (min: 10, max: 15)",
  "dob": "date string",
  "guardianName": "string (max: 100)",
  "address": "string (max: 500)",
  "courseId": "uuid",
  "sessionId": "uuid"
}
```

#### Validation
- `name`: Required, 2-100 characters
- `email`: Required, valid email format
- `phone`: Required, 10-15 characters
- `dob`: Optional, valid date format
- `courseId`: Required, valid UUID
- `sessionId`: Required, valid UUID
- `guardianName`: Optional, max 100 characters
- `address`: Optional, max 500 characters

#### Responses
- `201`: Student created successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Course or session not found
- `409`: Email already exists
- `500`: Server error

#### Example Request
```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "phone": "9876543210",
  "dob": "2000-05-15",
  "guardianName": "Bob Johnson",
  "address": "123 Main St, City",
  "courseId": "uuid-string",
  "sessionId": "uuid-string"
}
```

#### Example Response
```json
{
  "status": "success",
  "message": "Student created successfully",
  "data": {
    "student": {
      "id": "uuid",
      "reg_no": "REG123456789",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "course": {
        "id": "uuid",
        "name": "Computer Science"
      },
      "session": {
        "id": "uuid",
        "name": "2023-2026"
      }
    }
  }
}
```

### Get All Students
```
GET /students
```
**Access**: ADMIN, HOD

#### Query Parameters
- `status`: Filter by student status (ACTIVE, SUSPENDED, etc.)
- `courseId`: Filter by course ID
- `sessionId`: Filter by session ID
- `search`: Search by name, email, or registration number

#### Responses
- `200`: Students retrieved successfully
- `401`: Unauthorized
- `403`: Forbidden
- `500`: Server error

#### Example Response
```json
{
  "status": "success",
  "results": 25,
  "data": {
    "students": [
      {
        "id": "uuid",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "reg_no": "REG123456789",
        "status": "ACTIVE",
        "course": {
          "name": "Computer Science"
        },
        "session": {
          "name": "2023-2026"
        }
      }
    ]
  }
}
```

### Get Student by ID
```
GET /students/:id
```
**Access**: ADMIN, HOD, STUDENT (own record)

#### Responses
- `200`: Student retrieved successfully
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Student not found
- `500`: Server error

### Update Student
```
PATCH /students/:id
```
**Access**: ADMIN, HOD

#### Request Body
```json
{
  "name": "string (min: 2, max: 100)",
  "phone": "string (min: 10, max: 15)",
  "dob": "date string",
  "guardianName": "string (max: 100)",
  "address": "string (max: 500)"
}
```

#### Responses
- `200`: Student updated successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Student not found
- `500`: Server error

### Delete Student
```
DELETE /students/:id
```
**Access**: ADMIN

#### Responses
- `200`: Student deleted successfully
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Student not found
- `500`: Server error

### Assign Semester to Student
```
POST /students/:id/semester
```
**Access**: ADMIN, HOD

#### Request Body
```json
{
  "semesterId": "uuid",
  "startDate": "date string",
  "endDate": "date string (optional)"
}
```

#### Validation
- `semesterId`: Required, valid UUID
- `startDate`: Required, valid date format
- `endDate`: Optional, valid date format

#### Responses
- `201`: Semester assigned successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Student or semester not found
- `409`: Student already assigned to this semester
- `500`: Server error

## Department Management

### Create Department
```
POST /departments
```
**Access**: ADMIN

#### Request Body
```json
{
  "name": "string (min: 2, max: 100)",
  "code": "string (max: 20)",
  "description": "string (max: 500)"
}
```

#### Validation
- `name`: Required, 2-100 characters
- `code`: Optional, max 20 characters, must be unique
- `description`: Optional, max 500 characters

#### Responses
- `201`: Department created successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `409`: Department name or code already exists
- `500`: Server error

### Get All Departments
```
GET /departments
```
**Access**: ADMIN, HOD

#### Responses
- `200`: Departments retrieved successfully
- `401`: Unauthorized
- `403`: Forbidden
- `500`: Server error

## Course Management

### Create Course
```
POST /courses
```
**Access**: ADMIN

#### Request Body
```json
{
  "code": "string (max: 20)",
  "name": "string (min: 2, max: 100)",
  "durationYears": "number (min: 1, max: 8)",
  "departmentId": "uuid"
}
```

#### Validation
- `code`: Required, max 20 characters, must be unique
- `name`: Required, 2-100 characters
- `durationYears`: Required, 1-8 years
- `departmentId`: Required, valid UUID

#### Responses
- `201`: Course created successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Department not found
- `409`: Course code already exists
- `500`: Server error

## Subject Management

### Create Subject
```
POST /subjects
```
**Access**: ADMIN

#### Request Body
```json
{
  "code": "string (min: 2, max: 20)",
  "name": "string (min: 2, max: 100)",
  "credit": "number (min: 1, max: 10)",
  "semesterId": "uuid",
  "courseId": "uuid"
}
```

#### Validation
- `code`: Required, 2-20 characters
- `name`: Required, 2-100 characters
- `credit`: Required, 1-10 credits
- `semesterId`: Required, valid UUID
- `courseId`: Required, valid UUID

#### Responses
- `201`: Subject created successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Course or semester not found
- `409`: Subject code already exists for this course
- `500`: Server error

## Semester Management

### Create Semester
```
POST /semesters
```
**Access**: ADMIN

#### Request Body
```json
{
  "number": "number (min: 1, max: 12)",
  "courseId": "uuid"
}
```

#### Validation
- `number`: Required, 1-12
- `courseId`: Required, valid UUID

#### Responses
- `201`: Semester created successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Course not found
- `409`: Semester number already exists for this course
- `500`: Server error

## Admission Management

### Create Admission
```
POST /admissions
```
**Access**: ADMIN, HOD

#### Request Body
```json
{
  "studentId": "uuid",
  "courseId": "uuid"
}
```

#### Validation
- `studentId`: Required, valid UUID
- `courseId`: Required, valid UUID

#### Responses
- `201`: Admission created successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Student or course not found
- `409`: Student already admitted to this course
- `500`: Server error

### Update Admission Status
```
PATCH /admissions/:id/status
```
**Access**: ADMIN, HOD

#### Request Body
```json
{
  "status": "APPROVED|REJECTED|ISSUED",
  "notes": "string (max: 1000)"
}
```

#### Validation
- `status`: Required, must be valid status
- `notes`: Optional, max 1000 characters

#### Responses
- `200`: Admission status updated successfully
- `400`: Validation errors or invalid status transition
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Admission not found
- `500`: Server error

## Payment Processing

### Create Payment
```
POST /payments
```
**Access**: ADMIN, ACCOUNTANT

#### Request Body
```json
{
  "studentId": "uuid",
  "admissionId": "uuid (optional)",
  "totalAmount": "decimal",
  "status": "INITIATED|SUCCESS|FAILED|REFUNDED",
  "gateway": "string",
  "txnId": "string",
  "referenceNo": "string (optional)",
  "breakups": [
    {
      "head": "TUITION|EXAM|INFRASTRUCTURE|DEVELOPMENT|CERTIFICATE|MISC",
      "amount": "decimal"
    }
  ]
}
```

#### Validation
- `studentId`: Required, valid UUID
- `totalAmount`: Required, positive decimal
- `status`: Required, valid status
- `gateway`: Required, string
- `txnId`: Required, unique string
- `breakups`: Required array, valid fee heads

#### Responses
- `201`: Payment created successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Student not found
- `409`: Transaction ID already exists
- `500`: Server error

### Refund Payment
```
POST /payments/:id/refund
```
**Access**: ADMIN, ACCOUNTANT

#### Request Body
```json
{
  "amount": "decimal",
  "reason": "string (max: 500)"
}
```

#### Validation
- `amount`: Required, positive decimal
- `reason`: Required, max 500 characters

#### Responses
- `200`: Refund processed successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Payment not found
- `500`: Server error

## File Management

### Upload File
```
POST /files/upload
```
**Access**: ADMIN, HOD

#### Request (Form Data)
- `file`: File to upload
- `type`: Document type
- `studentId`: Associated student ID

#### Responses
- `201`: File uploaded successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `413`: File too large
- `500`: Server error

### Download File
```
GET /files/:id/download
```
**Access**: ADMIN, HOD, STUDENT (own files)

#### Responses
- `200`: File download successful
- `401`: Unauthorized
- `403`: Forbidden
- `404`: File not found
- `500`: Server error

## Certificate Management

### Create Certificate Request
```
POST /certificates
```
**Access**: STUDENT, ADMIN, HOD

#### Request Body
```json
{
  "studentId": "uuid",
  "type": "BONAFIDE|CLC",
  "purpose": "string (max: 500)",
  "departmentId": "uuid"
}
```

#### Validation
- `studentId`: Required, valid UUID
- `type`: Required, BONAFIDE or CLC
- `departmentId`: Required, valid UUID
- `purpose`: Optional, max 500 characters

#### Responses
- `201`: Certificate request created successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Student or department not found
- `500`: Server error

### Update Certificate Status
```
PATCH /certificates/:id/status
```
**Access**: ADMIN, HOD

#### Request Body
```json
{
  "status": "APPROVED|REJECTED|ISSUED",
  "notes": "string (max: 1000)"
}
```

#### Validation
- `status`: Required, valid status
- `notes`: Optional, max 1000 characters

#### Responses
- `200`: Certificate status updated successfully
- `400`: Validation errors or invalid status transition
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Certificate request not found
- `500`: Server error

### Issue Certificate
```
POST /certificates/:id/issue
```
**Access**: ADMIN, HOD

#### Responses
- `200`: Certificate issued successfully
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Certificate request not found
- `500`: Server error

### Download Certificate
```
GET /certificates/:id/download
```
**Access**: STUDENT (own certificates), ADMIN, HOD

#### Responses
- `200`: Certificate download successful
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Certificate not found
- `500`: Server error

## CMS Content Management

### Create News
```
POST /cms/news
```
**Access**: ADMIN

#### Request Body
```json
{
  "title": "string (min: 1, max: 200)",
  "body": "string (min: 1, max: 5000)",
  "isPublished": "boolean",
  "url": "string (URL format, optional)"
}
```

#### Validation
- `title`: Required, 1-200 characters
- `body`: Required, 1-5000 characters
- `isPublished`: Optional, boolean
- `url`: Optional, valid URL format

#### Responses
- `201`: News created successfully
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `500`: Server error

### Get All News
```
GET /cms/news
```
**Access**: PUBLIC (published only), ADMIN (all)

#### Query Parameters
- `search`: Search by title or body
- `isPublished`: Filter by published status (ADMIN only)

#### Responses
- `200`: News retrieved successfully
- `401`: Unauthorized
- `500`: Server error

## Audit Logs

### Get All Audit Logs
```
GET /audit
```
**Access**: ADMIN

#### Query Parameters
- `userId`: Filter by user ID
- `action`: Filter by action type
- `entity`: Filter by entity type
- `entityId`: Filter by entity ID
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50)

#### Responses
- `200`: Audit logs retrieved successfully
- `401`: Unauthorized
- `403`: Forbidden
- `500`: Server error

### Export Audit Logs
```
GET /audit/export
```
**Access**: ADMIN

#### Query Parameters
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `format`: Export format (json or csv, default: json)

#### Responses
- `200`: Audit logs exported successfully
- `401`: Unauthorized
- `403`: Forbidden
- `500`: Server error

## Common Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource does not exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Unexpected error |

## Validation Rules Summary

### String Lengths
- Names: 2-100 characters
- Emails: Valid email format
- Phone: 10-15 characters
- Titles: 1-200 characters
- Descriptions: Up to 5000 characters

### Numeric Values
- IDs: Valid UUID format
- Amounts: Positive decimals
- Years: 1-8 years
- Credits: 1-10 credits
- Semester numbers: 1-12

### Date Formats
- All dates in ISO 8601 format (YYYY-MM-DD)

### Enums
- User roles: ADMIN, HOD, ACCOUNTANT
- Student statuses: ACTIVE, SUSPENDED, PASSED_OUT, ALUMNI, DROPOUT
- Certificate types: BONAFIDE, CLC
- Payment statuses: INITIATED, SUCCESS, FAILED, REFUNDED
- Admission statuses: INITIATED, PAYMENT_PENDING, CONFIRMED, CANCELLED
- Fee heads: TUITION, EXAM, INFRASTRUCTURE, DEVELOPMENT, CERTIFICATE, MISC

This API documentation provides comprehensive details about all endpoints, request/response formats, validation rules, and error handling for the College ERP system.