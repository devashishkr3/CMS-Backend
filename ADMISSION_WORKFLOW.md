# Complete Admission Workflow for CMS-Backend

## Overview
This document outlines the complete admission workflow for the College Management System (CMS) Backend. The system has a well-structured workflow that handles admissions from creation to confirmation, including payment processing and verification.

## Complete Step-by-Step Admission Workflow

### 1. Session, Course, and Semester Setup (Admin Actions)
**Who:** Administrator
**Process:**
- Admin creates academic sessions (e.g., 2025-2028 for a 3-year course)
- Admin creates courses (e.g., BSc Computer Science, BCom)
- Admin creates semesters for each course (1st, 2nd, 3rd, etc.)
- These foundational elements are required before any admission can be processed

### 2. Admission Window Creation (Admin Action)
**Who:** Administrator
**Process:**
- Admin creates an admission window for specific courses and departments
- Sets start and end dates for the admission window
- Initially sets the window as disabled, then enables it when ready
- Only one active admission window per course and department is allowed

### 3. Student Addition/Admission Initiation (Admin/HOD Action)
**Who:** Administrator or Head of Department (HOD)
**Process:**
- Admin/HOD adds new students to the system (creates student records with registration numbers)
- Links students to specific courses and sessions
- Alternatively, creates admission records directly for existing students
- Admission status is initially set to "INITIATED"

### 4. Admission Window Activation (Admin Action)
**Who:** Administrator
**Process:**
- Admin enables the admission window to make it active
- Students can now search for admission using registration numbers
- The window is accessible for the specified date range

### 5. Student Payment Process (Student Action)
**Who:** Student
**Process:**
- Student accesses the admission window using their registration number
- Student initiates payment through the integrated payment gateway
- Payment can be linked to the admission record
- Payment status is tracked as INITIATED initially

### 6. Payment Processing and Confirmation
**Who:** Payment Gateway / Administrator/Accountant
**Process:**
- Payment is processed through the selected gateway (Razorpay, Stripe, etc.)
- Payment status is updated to SUCCESS/FAILED based on transaction result
- If payment is successful and linked to an admission, the admission status automatically changes to "CONFIRMED"
- Payment receipt is generated with a unique receipt number

### 7. Payment Receipt Generation
**Who:** System / Administrator/Accountant
**Process:**
- System automatically generates a payment receipt upon successful payment
- Receipt contains all relevant details (student info, amount, transaction ID)
- Student can download the payment receipt from their portal

### 8. College Application with Documents
**Who:** Student
**Process:**
- Student visits the college physically with required documents
- Presents the payment receipt as proof of payment completion
- Submits all required admission documents (mark sheets, certificates, etc.)

### 9. HOD Verification Process
**Who:** Head of Department (HOD)
**Process:**
- HOD verifies the payment receipt to confirm payment authenticity
- Validates all submitted documents
- Confirms the admission status if all documents are in order
- Can update admission status as needed (following valid status transitions)

## Admission Status Lifecycle

The system implements a strict status transition workflow:

### Valid Admission Status Transitions:
- `INITIATED` → `PAYMENT_PENDING` or `CANCELLED`
- `PAYMENT_PENDING` → `CONFIRMED` or `CANCELLED`
- `CONFIRMED` → No further transitions allowed
- `CANCELLED` → No further transitions allowed

### Valid Payment Status Transitions:
- `INITIATED` → `SUCCESS` or `FAILED`
- `SUCCESS` → `REFUNDED`
- `FAILED` → No further transitions allowed
- `REFUNDED` → No further transitions allowed

## Complete List of Admission-Related Endpoints

### ADMISSION MANAGEMENT ENDPOINTS

#### 1. Create New Admission
- **Endpoint:** `POST /api/admissions`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Request Body:**
  ```json
  {
    "studentId": "string",
    "courseId": "string"
  }
  ```
- **Response:** Created admission record with student and course details
- **Functionality:** Creates a new admission record with status "INITIATED"

#### 2. Get All Admissions
- **Endpoint:** `GET /api/admissions`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Query Parameters:**
  - `status`: Filter by admission status
  - `courseId`: Filter by course ID
  - `studentId`: Filter by student ID
- **Response:** List of admissions with student and course details
- **Functionality:** Retrieves all admissions with optional filtering

#### 3. Get Single Admission
- **Endpoint:** `GET /api/admissions/:id`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Response:** Single admission record with complete details
- **Functionality:** Retrieves detailed information about a specific admission

#### 4. Update Admission Status
- **Endpoint:** `PATCH /api/admissions/:id/status`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Request Body:**
  ```json
  {
    "status": "string",
    "notes": "string (optional)"
  }
  ```
- **Response:** Updated admission record with history
- **Functionality:** Updates admission status with proper lifecycle enforcement

### ADMISSION WINDOW MANAGEMENT ENDPOINTS

#### 5. Create Admission Window
- **Endpoint:** `POST /api/admissions/windows`
- **Access:** ADMIN
- **Authentication:** Required
- **Authorization:** ADMIN role only
- **Request Body:**
  ```json
  {
    "title": "string",
    "courseId": "string",
    "departmentId": "string",
    "startDate": "date",
    "endDate": "date"
  }
  ```
- **Response:** Created admission window record
- **Functionality:** Creates a new admission window for specific course and department

#### 6. Get All Admission Windows
- **Endpoint:** `GET /api/admissions/windows`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Query Parameters:**
  - `courseId`: Filter by course ID
  - `departmentId`: Filter by department ID
  - `enabled`: Filter by enabled status (true/false)
- **Response:** List of admission windows
- **Functionality:** Retrieves all admission windows with optional filtering

#### 7. Get Single Admission Window
- **Endpoint:** `GET /api/admissions/windows/:id`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Response:** Single admission window record
- **Functionality:** Retrieves detailed information about a specific admission window

#### 8. Update Admission Window
- **Endpoint:** `PATCH /api/admissions/windows/:id`
- **Access:** ADMIN
- **Authentication:** Required
- **Authorization:** ADMIN role only
- **Request Body:**
  ```json
  {
    "title": "string (optional)",
    "startDate": "date (optional)",
    "endDate": "date (optional)",
    "enabled": "boolean (optional)"
  }
  ```
- **Response:** Updated admission window record
- **Functionality:** Updates admission window details including activation status

#### 9. Delete Admission Window
- **Endpoint:** `DELETE /api/admissions/windows/:id`
- **Access:** ADMIN
- **Authentication:** Required
- **Authorization:** ADMIN role only
- **Response:** Success message
- **Functionality:** Deletes an admission window record

### PAYMENT MANAGEMENT ENDPOINTS

#### 10. Create Payment
- **Endpoint:** `POST /api/payments`
- **Access:** ADMIN, ACCOUNTANT
- **Authentication:** Required
- **Authorization:** ADMIN or ACCOUNTANT roles only
- **Request Body:**
  ```json
  {
    "studentId": "string",
    "admissionId": "string (optional)",
    "totalAmount": "decimal",
    "gateway": "string",
    "txnId": "string",
    "referenceNo": "string (optional)",
    "breakups": [
      {
        "head": "string (enum)",
        "amount": "decimal"
      }
    ]
  }
  ```
- **Response:** Created payment record with student and admission details
- **Functionality:** Creates a new payment record linked to student and optionally to admission

#### 11. Get All Payments
- **Endpoint:** `GET /api/payments`
- **Access:** ADMIN, ACCOUNTANT, HOD
- **Authentication:** Required
- **Authorization:** ADMIN, ACCOUNTANT, or HOD roles only
- **Query Parameters:**
  - `status`: Filter by payment status
  - `studentId`: Filter by student ID
  - `admissionId`: Filter by admission ID
- **Response:** List of payments with student and admission details
- **Functionality:** Retrieves all payments with optional filtering

#### 12. Get Payment Statistics
- **Endpoint:** `GET /api/payments/stats`
- **Access:** ADMIN, ACCOUNTANT, HOD
- **Authentication:** Required
- **Authorization:** ADMIN, ACCOUNTANT, or HOD roles only
- **Response:** Payment statistics grouped by status with amounts and counts
- **Functionality:** Provides payment analytics and recent payment information

#### 13. Get Single Payment
- **Endpoint:** `GET /api/payments/:id`
- **Access:** ADMIN, ACCOUNTANT, HOD
- **Authentication:** Required
- **Authorization:** ADMIN, ACCOUNTANT, or HOD roles only
- **Response:** Single payment record with complete details
- **Functionality:** Retrieves detailed information about a specific payment

#### 14. Update Payment Status
- **Endpoint:** `PATCH /api/payments/:id/status`
- **Access:** ADMIN, ACCOUNTANT
- **Authentication:** Required
- **Authorization:** ADMIN or ACCOUNTANT roles only
- **Request Body:**
  ```json
  {
    "status": "string",
    "notes": "string (optional)"
  }
  ```
- **Response:** Updated payment record with student and admission details
- **Functionality:** Updates payment status with proper lifecycle enforcement

#### 15. Refund Payment
- **Endpoint:** `POST /api/payments/:id/refund`
- **Access:** ADMIN, ACCOUNTANT
- **Authentication:** Required
- **Authorization:** ADMIN or ACCOUNTANT roles only
- **Request Body:**
  ```json
  {
    "reason": "string",
    "refundAmount": "decimal (optional)"
  }
  ```
- **Response:** Updated payment record and refund record
- **Functionality:** Processes a refund for a successful payment

### STUDENT MANAGEMENT ENDPOINTS (Related to Admission)

#### 16. Create Student
- **Endpoint:** `POST /api/students`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Request Body:**
  ```json
  {
    "name": "string",
    "email": "string",
    "phone": "string",
    "dob": "date (optional)",
    "guardianName": "string (optional)",
    "address": "string (optional)",
    "courseId": "string",
    "sessionId": "string"
  }
  ```
- **Response:** Created student record with course and session details
- **Functionality:** Creates a new student record with auto-generated registration number

#### 17. Get All Students
- **Endpoint:** `GET /api/students`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Query Parameters:**
  - `status`: Filter by student status
  - `courseId`: Filter by course ID
  - `sessionId`: Filter by session ID
  - `search`: Search by name, email, or registration number
- **Response:** List of students with course and session details
- **Functionality:** Retrieves all students with optional filtering and search

#### 18. Get Single Student
- **Endpoint:** `GET /api/students/:id`
- **Access:** ADMIN, HOD, STUDENT (own record)
- **Authentication:** Required
- **Authorization:** ADMIN, HOD, or STUDENT (own record only)
- **Response:** Single student record with complete details
- **Functionality:** Retrieves detailed information about a specific student

#### 19. Update Student
- **Endpoint:** `PATCH /api/students/:id`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Response:** Updated student record
- **Functionality:** Updates student information

#### 20. Delete Student (Soft Delete)
- **Endpoint:** `DELETE /api/students/:id`
- **Access:** ADMIN
- **Authentication:** Required
- **Authorization:** ADMIN role only
- **Response:** Success message
- **Functionality:** Marks student as deleted (soft delete)

#### 21. Assign Semester to Student
- **Endpoint:** `POST /api/students/:id/semesters`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Request Body:**
  ```json
  {
    "semesterId": "string",
    "startDate": "date",
    "endDate": "date (optional)"
  }
  ```
- **Response:** Student semester assignment record
- **Functionality:** Assigns a semester to a student

#### 22. Update Student Semester Status
- **Endpoint:** `PATCH /api/students/:studentId/semesters/:semesterId`
- **Access:** ADMIN, HOD
- **Authentication:** Required
- **Authorization:** ADMIN or HOD roles only
- **Request Body:**
  ```json
  {
    "status": "string (optional)",
    "feePaid": "boolean (optional)"
  }
  ```
- **Response:** Updated student semester assignment record
- **Functionality:** Updates student semester status and fee payment status

## Database Relations

### Admission Model Relations
- Links to Student (one-to-many)
- Links to Course (one-to-many)
- Links to Department (optional)
- Contains Payment records (one-to-many)
- Contains Admission History (one-to-many)

### Payment Model Relations
- Links to Student (one-to-many)
- Links to Admission (optional, one-to-many)
- Contains Payment Breakups (one-to-many)
- Links to Receipt (one-to-many)

### Student Model Relations
- Links to Course (one-to-many)
- Links to Session (one-to-many)
- Contains Semesters (many-to-many through StudentSemester)
- Contains Payments (one-to-many)
- Contains Admissions (one-to-many)

## Security and Access Control

### Role-Based Access Control (RBAC)
- **ADMIN:** Full access to all admission and payment operations
- **HOD:** Can view and manage admissions, payments, and students within their department
- **ACCOUNTANT:** Can manage payments and view related information
- **STUDENT:** Can only access their own information

### Authentication
- All endpoints require JWT authentication
- User roles are verified for each request
- Session-based access control is enforced

## Business Rules and Constraints

### Admission Constraints
- A student cannot be admitted to the same course multiple times
- Admission windows are unique per course and department during active periods
- Admission status follows strict lifecycle transitions
- Only active admission windows can be used for new admissions

### Payment Constraints
- Transaction IDs must be unique across the system
- Payment amounts must be positive values
- Payment status follows strict lifecycle transitions
- Successful payments linked to admissions automatically confirm the admission

### Student Constraints
- Email addresses must be unique
- Registration numbers are auto-generated and unique
- Students must be linked to valid courses and sessions
- Student records support soft deletion for audit purposes

## Audit Trail

### Audit Logging
- All admission-related actions are logged in the audit system
- Payment transactions are recorded with full details
- Status changes are tracked with user information and timestamps
- Document verification and HOD approval actions are audited

## Integration Points

### Payment Gateway Integration
- Supports multiple payment gateways (Razorpay, Stripe, etc.)
- Transaction ID tracking for reconciliation
- Automatic status updates upon payment confirmation
- Receipt generation upon successful payment

### Document Verification
- Student document upload and verification system
- HOD approval workflow for document verification
- Integration with admission confirmation process

## Error Handling

### Validation Errors
- Input validation using Joi schemas
- Detailed error messages for client-side validation
- Proper HTTP status codes (400, 404, 403, etc.)

### Business Logic Errors
- Duplicate admission prevention
- Invalid status transition prevention
- Missing prerequisites validation
- Permission validation

## Future Enhancements

### Possible Additions
- Student self-registration with document upload
- Online admission application form
- Automated document verification using OCR
- SMS/email notifications for status changes
- Payment gateway integration for online payments
- Advanced reporting and analytics dashboard
- Bulk admission processing
- Integration with university systems

## Summary

The CMS-Backend already has a comprehensive admission workflow system implemented with proper role-based access control, status lifecycle management, and audit trails. The system supports the complete admission process from student creation through payment processing and final verification. The workflow you described is well-supported by the existing implementation with clear endpoints for each step of the process.