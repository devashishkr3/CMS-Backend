# College ERP System - Validation Rules

This document provides a comprehensive overview of all validation rules implemented across the College ERP system using Joi validation schemas.

## Overview

All request validation in the system is performed using Joi validation schemas. Each module has its own validation file containing schemas for different operations.

## Validation Schema Files

### 1. Student Validation (`src/validation/student.validation.js`)

#### Create Student
```javascript
{
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(10).max(15).required(),
  dob: Joi.date().iso().optional(),
  guardianName: Joi.string().max(100).optional(),
  address: Joi.string().max(500).optional(),
  courseId: Joi.string().uuid().required(),
  sessionId: Joi.string().uuid().required()
}
```

**Validation Rules:**
- `name`: Required, string, 2-100 characters
- `email`: Required, valid email format
- `phone`: Required, string, 10-15 characters
- `dob`: Optional, valid ISO date format
- `guardianName`: Optional, string, max 100 characters
- `address`: Optional, string, max 500 characters
- `courseId`: Required, valid UUID format
- `sessionId`: Required, valid UUID format

#### Update Student
```javascript
{
  name: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().min(10).max(15).optional(),
  dob: Joi.date().iso().optional(),
  guardianName: Joi.string().max(100).optional(),
  address: Joi.string().max(500).optional()
}
```

**Validation Rules:**
- All fields are optional
- Same validation rules as create, but optional

#### Assign Semester
```javascript
{
  semesterId: Joi.string().uuid().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().optional()
}
```

**Validation Rules:**
- `semesterId`: Required, valid UUID format
- `startDate`: Required, valid ISO date format
- `endDate`: Optional, valid ISO date format

### 2. Department Validation (`src/validation/department.validation.js`)

#### Create Department
```javascript
{
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().max(20).optional(),
  description: Joi.string().max(500).optional()
}
```

**Validation Rules:**
- `name`: Required, string, 2-100 characters
- `code`: Optional, string, max 20 characters
- `description`: Optional, string, max 500 characters

#### Update Department
```javascript
{
  name: Joi.string().min(2).max(100).optional(),
  code: Joi.string().max(20).optional(),
  description: Joi.string().max(500).optional()
}
```

**Validation Rules:**
- All fields are optional
- Same validation rules as create

### 3. Course Validation (`src/validation/course.validation.js`)

#### Create Course
```javascript
{
  code: Joi.string().max(20).required(),
  name: Joi.string().min(2).max(100).required(),
  durationYears: Joi.number().integer().min(1).max(8).required(),
  departmentId: Joi.string().uuid().required()
}
```

**Validation Rules:**
- `code`: Required, string, max 20 characters
- `name`: Required, string, 2-100 characters
- `durationYears`: Required, integer, 1-8 years
- `departmentId`: Required, valid UUID format

#### Update Course
```javascript
{
  code: Joi.string().max(20).optional(),
  name: Joi.string().min(2).max(100).optional(),
  durationYears: Joi.number().integer().min(1).max(8).optional(),
  departmentId: Joi.string().uuid().optional()
}
```

**Validation Rules:**
- All fields are optional
- Same validation rules as create, but optional

### 4. Subject Validation (`src/validation/subject.validation.js`)

#### Create Subject
```javascript
{
  code: Joi.string().min(2).max(20).required(),
  name: Joi.string().min(2).max(100).required(),
  credit: Joi.number().integer().min(1).max(10).required(),
  semesterId: Joi.string().uuid().required(),
  courseId: Joi.string().uuid().required()
}
```

**Validation Rules:**
- `code`: Required, string, 2-20 characters
- `name`: Required, string, 2-100 characters
- `credit`: Required, integer, 1-10 credits
- `semesterId`: Required, valid UUID format
- `courseId`: Required, valid UUID format

#### Update Subject
```javascript
{
  code: Joi.string().min(2).max(20).optional(),
  name: Joi.string().min(2).max(100).optional(),
  credit: Joi.number().integer().min(1).max(10).optional(),
  semesterId: Joi.string().uuid().optional(),
  courseId: Joi.string().uuid().optional()
}
```

**Validation Rules:**
- All fields are optional
- Same validation rules as create, but optional

### 5. Semester Validation (`src/validation/semester.validation.js`)

#### Create Semester
```javascript
{
  number: Joi.number().integer().min(1).max(12).required(),
  courseId: Joi.string().uuid().required()
}
```

**Validation Rules:**
- `number`: Required, integer, 1-12
- `courseId`: Required, valid UUID format

### 6. Admission Validation (`src/validation/admission.validation.js`)

#### Create Admission
```javascript
{
  studentId: Joi.string().uuid().required(),
  courseId: Joi.string().uuid().required()
}
```

**Validation Rules:**
- `studentId`: Required, valid UUID format
- `courseId`: Required, valid UUID format

#### Update Admission Status
```javascript
{
  status: Joi.string().valid('APPROVED', 'REJECTED', 'CANCELLED').required(),
  notes: Joi.string().max(1000).optional()
}
```

**Validation Rules:**
- `status`: Required, must be one of 'APPROVED', 'REJECTED', 'CANCELLED'
- `notes`: Optional, string, max 1000 characters

#### Create Admission Window
```javascript
{
  title: Joi.string().min(2).max(200).required(),
  courseId: Joi.string().uuid().required(),
  departmentId: Joi.string().uuid().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required()
}
```

**Validation Rules:**
- `title`: Required, string, 2-200 characters
- `courseId`: Required, valid UUID format
- `departmentId`: Required, valid UUID format
- `startDate`: Required, valid ISO date format
- `endDate`: Required, valid ISO date format

#### Update Admission Window
```javascript
{
  title: Joi.string().min(2).max(200).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  enabled: Joi.boolean().optional()
}
```

**Validation Rules:**
- All fields are optional
- Same validation rules as create, but optional

### 7. Payment Validation (`src/validation/payment.validation.js`)

#### Create Payment
```javascript
{
  studentId: Joi.string().uuid().required(),
  admissionId: Joi.string().uuid().optional(),
  totalAmount: Joi.number().precision(2).positive().required(),
  status: Joi.string().valid('INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED').required(),
  gateway: Joi.string().required(),
  txnId: Joi.string().required(),
  referenceNo: Joi.string().optional(),
  breakups: Joi.array().items(
    Joi.object({
      head: Joi.string().valid('TUITION', 'EXAM', 'INFRASTRUCTURE', 'DEVELOPMENT', 'CERTIFICATE', 'MISC').required(),
      amount: Joi.number().precision(2).positive().required()
    })
  ).required()
}
```

**Validation Rules:**
- `studentId`: Required, valid UUID format
- `totalAmount`: Required, positive number with 2 decimal places
- `status`: Required, must be one of specified values
- `gateway`: Required, string
- `txnId`: Required, string
- `breakups`: Required array of objects with head and amount

#### Update Payment Status
```javascript
{
  status: Joi.string().valid('SUCCESS', 'FAILED', 'REFUNDED').required(),
  notes: Joi.string().max(1000).optional()
}
```

**Validation Rules:**
- `status`: Required, must be one of 'SUCCESS', 'FAILED', 'REFUNDED'
- `notes`: Optional, string, max 1000 characters

#### Process Refund
```javascript
{
  amount: Joi.number().precision(2).positive().required(),
  reason: Joi.string().max(500).required()
}
```

**Validation Rules:**
- `amount`: Required, positive number with 2 decimal places
- `reason`: Required, string, max 500 characters

### 8. File Validation (`src/validation/file.validation.js`)

#### Upload File
```javascript
{
  type: Joi.string().valid('photo', 'document', 'certificate').required(),
  documentType: Joi.string().when('type', {
    is: 'document',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  studentId: Joi.string().uuid().when('type', {
    is: Joi.string().valid('photo', 'document'),
    then: Joi.string().uuid().required(),
    otherwise: Joi.string().optional()
  }),
  certificateId: Joi.string().uuid().when('type', {
    is: 'certificate',
    then: Joi.string().uuid().required(),
    otherwise: Joi.string().optional()
  })
}
```

**Validation Rules:**
- `type`: Required, must be 'photo', 'document', or 'certificate'
- Conditional validation based on type

#### Verify Document
```javascript
{
  verified: Joi.boolean().required(),
  notes: Joi.string().max(500).optional()
}
```

**Validation Rules:**
- `verified`: Required, boolean
- `notes`: Optional, string, max 500 characters

### 9. Certificate Validation (`src/validation/certificate.validation.js`)

#### Create Certificate Request
```javascript
{
  studentId: Joi.string().uuid().required(),
  type: Joi.string().valid('BONAFIDE', 'CLC').required(),
  purpose: Joi.string().max(500).optional(),
  departmentId: Joi.string().uuid().required()
}
```

**Validation Rules:**
- `studentId`: Required, valid UUID format
- `type`: Required, must be 'BONAFIDE' or 'CLC'
- `departmentId`: Required, valid UUID format
- `purpose`: Optional, string, max 500 characters

#### Update Certificate Status
```javascript
{
  status: Joi.string().valid('APPROVED', 'REJECTED', 'ISSUED').required(),
  notes: Joi.string().max(1000).optional()
}
```

**Validation Rules:**
- `status`: Required, must be one of 'APPROVED', 'REJECTED', 'ISSUED'
- `notes`: Optional, string, max 1000 characters

#### Filter Certificates
```javascript
{
  studentId: Joi.string().uuid().optional(),
  type: Joi.string().valid('BONAFIDE', 'CLC').optional(),
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'ISSUED').optional(),
  departmentId: Joi.string().uuid().optional()
}
```

**Validation Rules:**
- All fields are optional
- Valid values as specified

### 10. CMS Validation (`src/validation/cms.validation.js`)

#### Create Gallery Item
```javascript
{
  title: Joi.string().min(1).max(200).required(),
  coverUrl: Joi.string().uri().optional()
}
```

**Validation Rules:**
- `title`: Required, string, 1-200 characters
- `coverUrl`: Optional, valid URI format

#### Create News Item
```javascript
{
  title: Joi.string().min(1).max(200).required(),
  body: Joi.string().min(1).max(5000).required(),
  isPublished: Joi.boolean().optional(),
  url: Joi.string().uri().optional()
}
```

**Validation Rules:**
- `title`: Required, string, 1-200 characters
- `body`: Required, string, 1-5000 characters
- `isPublished`: Optional, boolean
- `url`: Optional, valid URI format

#### Create Notice Item
```javascript
{
  title: Joi.string().min(1).max(200).required(),
  body: Joi.string().min(1).max(2000).required(),
  url: Joi.string().uri().optional()
}
```

**Validation Rules:**
- `title`: Required, string, 1-200 characters
- `body`: Required, string, 1-2000 characters
- `url`: Optional, valid URI format

#### Filter Validation
- `search`: Optional, string, max 100 characters
- `isPublished`: Optional, boolean

## Common Validation Patterns

### UUID Validation
- All ID fields use `Joi.string().uuid().required()` or `.optional()`
- Ensures proper UUID format

### String Length Validation
- Name fields: 2-100 characters
- Title fields: 1-200 characters
- Description fields: Up to 5000 characters
- Notes fields: Up to 1000 characters

### Numeric Validation
- Amounts: `Joi.number().precision(2).positive()`
- Years: `Joi.number().integer().min(1).max(8)`
- Credits: `Joi.number().integer().min(1).max(10)`
- Semester numbers: `Joi.number().integer().min(1).max(12)`

### Date Validation
- All dates use `Joi.date().iso().required()` or `.optional()`
- Ensures ISO 8601 date format

### Boolean Validation
- All boolean fields use `Joi.boolean().optional()` or `.required()`

### Array Validation
- Arrays use `Joi.array().items(schema)` with appropriate item validation
- Ensures all items in array meet validation requirements

## Error Handling

All validation errors return a 400 status code with detailed error messages:
```json
{
  "status": "error",
  "message": "Validation error: field_name is required, field_name must be at least 2 characters long"
}
```

## Validation Best Practices

1. **Consistency**: All validation follows the same patterns across modules
2. **Security**: Input validation prevents injection attacks
3. **User Experience**: Clear, descriptive error messages
4. **Maintainability**: Validation schemas are separate from business logic
5. **Flexibility**: Optional fields allow partial updates
6. **Type Safety**: Strict type checking prevents runtime errors

This validation framework ensures data integrity and security across all modules of the College ERP system.