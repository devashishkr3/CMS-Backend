# College ERP System Workflow

This document outlines the complete workflow of the College ERP system, detailing how different modules interact and the business logic behind each process.

## 🏫 System Overview

The College ERP system is designed to manage all aspects of college operations from student admissions to graduation. The system follows a modular architecture with each module handling specific business functions while maintaining data integrity and security.

## 📋 Main Workflows

### 1. Student Registration & Management Workflow

#### 1.1 Student Registration Process
```
Admin/HOD → Student Controller → Validation → Database → Audit Log
```

**Steps:**
1. Admin or HOD creates a new student record
2. Request validation using Joi
3. Email uniqueness check
4. Course and session validation
5. Registration number generation
6. Student record creation in database
7. Audit log entry creation
8. Response with student details

#### 1.2 Student Status Management
- Students can have different statuses: ACTIVE, SUSPENDED, PASSED_OUT, ALUMNI, DROPOUT
- Soft delete using `isDeleted` field instead of hard deletion
- Access control based on roles

#### 1.3 Semester Assignment
- Students are assigned to semesters
- Fee payment tracking per semester
- Status updates (ONGOING, COMPLETED, FAILED, PROMOTED)

### 2. Admission Process Workflow

#### 2.1 Admission Lifecycle
```
Admission Initiation → Payment Pending → Confirmed → Course Enrollment
```

**Status Transitions:**
- `INITIATED` → `PAYMENT_PENDING` | `CANCELLED`
- `PAYMENT_PENDING` → `CONFIRMED` | `CANCELLED`
- `CONFIRMED` → (Final state)
- `CANCELLED` → (Final state, cannot be changed)

#### 2.2 Admission Window Management
1. Admin creates admission windows for specific courses/department
2. Windows have start and end dates
3. Students apply during active windows
4. Applications are tracked with history

#### 2.3 Admission History Tracking
- All status changes are logged
- Who changed what and when
- Notes for each transition
- Complete audit trail

### 3. Payment Processing Workflow

#### 3.1 Payment Flow
```
Fee Calculation → Payment Initiation → Gateway Processing → Status Update → Receipt Generation
```

**Key Features:**
- Fee breakdown by category (Tuition, Exam, Infrastructure, etc.)
- Transaction safety with proper status management
- Receipt generation and storage
- Refund processing capability

#### 3.2 Payment Status Management
- `INITIATED` → `SUCCESS` | `FAILED`
- `SUCCESS` → `REFUNDED` (refund possible)
- `FAILED` → Cannot be changed
- `REFUNDED` → Final state

### 4. Certificate Request & Issuance Workflow

#### 4.1 Certificate Lifecycle
```
Request → Pending → Approved → Issued (PDF Generation) → Download
```

**Status Flow:**
- `PENDING` → `APPROVED` | `REJECTED`
- `APPROVED` → `ISSUED`
- `REJECTED` → (Final state)
- `ISSUED` → (Final state, PDF available for download)

#### 4.2 PDF Certificate Generation
- Dynamic PDF generation based on certificate type
- Bonafide certificates for current students
- Character and Leaving Certificates (CLC) for graduates
- Professional certificate formatting

### 5. Academic Structure Workflow

#### 5.1 Course Structure
```
Department → Course → Semester → Subject → Student Enrollment
```

**Relationships:**
- Departments contain multiple courses
- Courses have multiple semesters
- Semesters have multiple subjects
- Students are enrolled in courses and attend semesters

#### 5.2 Semester Auto-Assignment
- Automatic assignment of students to next semester
- Promotion logic based on current semester status
- Fee payment tracking per semester

### 6. File Management Workflow

#### 6.1 File Upload Process
```
Upload Request → Validation → Cloudflare R2 → Database Storage → Access Control
```

**File Types:**
- Student photos
- Student documents (Aadhar, Marksheet, TC)
- Certificate PDFs
- CMS content (Gallery images)

#### 6.2 Document Verification
- HOD/Admin can verify documents
- Verification notes tracking
- Status management (Verified/Not Verified)

### 7. Content Management System Workflow

#### 7.1 CMS Content Flow
- **Gallery**: Image management for college events
- **News**: News articles with publish/unpublish
- **Notices**: Important announcements

#### 7.2 Access Control
- Public access for published content
- Admin access for all content management
- Different permissions for different content types

### 8. Audit & Security Workflow

#### 8.1 Audit Trail
```
Action Performed → Audit Log Creation → Data Capture → Storage → Reporting
```

**Captured Information:**
- User ID and role
- Action performed
- Entity and Entity ID
- Payload data
- IP address
- User agent
- Timestamp

#### 8.2 Authentication Flow
```
Login Request → Credential Validation → Token Generation → Session Management
```

**Security Features:**
- JWT-based authentication
- Role-based access control
- Token refresh mechanism
- Blacklisted tokens for logout

## 🔐 Role-Based Access Control (RBAC)

### 8.1 Role Permissions

#### ADMIN
- Full access to all modules
- User management
- System configuration
- All CRUD operations

#### HOD (Head of Department)
- Department-specific access
- Course management within department
- Student management for department
- Admission processing for department
- Document verification

#### ACCOUNTANT
- Payment processing
- Fee management
- Receipt generation
- Refund processing

#### STUDENT
- Own profile management
- Own academic records
- Certificate requests
- Own document uploads
- Payment history

### 8.2 Access Control Implementation
- Middleware-based protection
- Route-level restrictions
- Data-level filtering
- Action-level permissions

## 🔄 Business Rules & Validation

### 9.1 Data Integrity Rules
- Unique constraints on emails, registration numbers
- Foreign key relationships enforced
- Referential integrity maintained
- Business logic validation at application level

### 9.2 Academic Rules
- Students can only be assigned to semesters of their course
- Semester progression follows academic calendar
- Fee payment required for semester completion
- Course prerequisites enforced

### 9.3 Admission Rules
- One student per course admission
- Admission window restrictions
- Payment requirements for confirmation
- Status transition validation

## 📊 Reporting & Analytics

### 10.1 Audit Reports
- User activity tracking
- System usage analytics
- Security event monitoring
- Compliance reporting

### 10.2 Academic Reports
- Student progress tracking
- Course enrollment statistics
- Payment collection reports
- Certificate issuance statistics

## 🚨 Error Handling & Recovery

### 11.1 Error Types
- **Operational Errors**: Expected errors (validation, business logic)
- **Programming Errors**: Unexpected errors (bugs, system failures)

### 11.2 Error Handling Strategy
- Graceful degradation
- User-friendly error messages
- System logging
- Recovery mechanisms

## 🛡️ Security Measures

### 12.1 Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Secure file handling

### 12.2 Access Security
- Authentication and authorization
- Session management
- Rate limiting
- Secure token handling

## 🚀 Deployment & Maintenance

### 13.1 Deployment Workflow
- Database migrations
- Environment configuration
- Security hardening
- Monitoring setup

### 13.2 Maintenance Operations
- Regular backups
- Audit log maintenance
- Performance monitoring
- Security updates

This workflow document provides a comprehensive overview of how the College ERP system operates, ensuring all stakeholders understand the business processes and technical implementation.