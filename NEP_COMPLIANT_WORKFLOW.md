# NEP Compliant College ERP - Complete Workflow Documentation

## Overview
This document outlines the complete workflow for the NEP (National Education Policy) compliant College ERP system, covering all major modules and processes.

## 1. Department Creation
- **Purpose**: Create academic departments (e.g., Computer Science, Physics, English)
- **Process**:
  - Admin creates department with name, code, and description
  - Department is linked to courses and faculty
- **API**: `POST /api/v1/departments`

## 2. Course Creation
- **Purpose**: Create academic courses (e.g., BSc Computer Science, BA Economics)
- **Process**:
  - Admin creates course with name, code, duration, and department
  - Course is linked to semesters and subjects
- **API**: `POST /api/v1/courses`

## 3. Session Mapping
- **Purpose**: Create academic sessions (e.g., 2024-2027 for 3-year course)
- **Process**:
  - Admin creates session with start and end years
  - Session is linked to students and courses
- **API**: `POST /api/v1/sessions`

## 4. Semester Setup
- **Purpose**: Create semesters for each course (e.g., 6 semesters for 3-year course)
- **Process**:
  - Admin creates semesters (1-6) for each course
  - Each semester is linked to subjects
- **API**: `POST /api/v1/semesters`

## 5. Subject Setup (NEP based)
- **Purpose**: Create subjects with NEP-compliant types (MJC, MIC, MDC, SEC, VAC)
- **Process**:
  - **MJC (Major Core)**: Core subjects specific to major
  - **MIC (Minor Core)**: Core subjects for minor specialization
  - **MDC (Multi-Disciplinary Course)**: Interdisciplinary subjects
  - **SEC (Skill Enhancement Course)**: Practical skill development
  - **VAC (Value Added Course)**: Additional value-adding subjects
- **API**: `POST /api/v1/subjects`

## 6. Admission Flow
- **Purpose**: Manage student admission process
- **Process**:
  - Admission window opens for specific courses/departments
  - Students apply through admission process
  - Admin/HOD reviews and confirms admission
  - **Automatic**: Student automatically assigned to Semester 1 upon admission confirmation
- **APIs**:
  - `POST /api/v1/admissions`
  - `POST /api/v1/admissions/windows`
  - `PATCH /api/v1/admissions/:id/status`

## 7. Payment Flow
- **Purpose**: Handle fee payments for admission and semester fees
- **Process**:
  - Students pay fees through integrated payment gateway
  - Receipts are generated automatically
  - Payment status is tracked
- **APIs**: `POST /api/v1/payments`, `GET /api/v1/payments`

## 8. Semester Assignment
- **Purpose**: Assign students to semesters
- **Process**:
  - **Automatic**: Upon admission confirmation, student auto-assigned to Semester 1
  - **Manual**: Admin/HOD can manually assign semesters
  - **Auto-promotion**: When semester marked as COMPLETED, student auto-assigned to next semester
- **APIs**: `POST /api/v1/students/:id/semesters`, `PATCH /api/v1/students/:studentId/semesters/:semesterId`

## 9. Subject Selection (MJC/MIC etc.)
- **Purpose**: Allow students to select subjects for each semester
- **Process**:
  - Students select subjects based on type restrictions (1 MJC, 1 MIC, 1 MDC, etc.)
  - Admin/HOD can bulk assign subjects
  - Students can view their selected subjects
- **APIs**:
  - `POST /api/v1/student-subjects`
  - `GET /api/v1/student-subjects`
  - `POST /api/v1/student-subjects/bulk`

## 10. Promotion Process
- **Purpose**: Promote students to next semester upon completion
- **Process**:
  - **Automatic**: When semester marked as COMPLETED, student auto-assigned to next semester
  - **Manual**: Admin/HOD can promote students manually via bulk operations
  - **Validation**: System checks if student has completed previous semester before promotion
- **APIs**: `POST /api/v1/semesters/:id/promote`, `PATCH /api/v1/semesters/:id/status`

## 11. Final Passout Process
- **Purpose**: Handle student graduation and status change
- **Process**:
  - Student completes final semester
  - Student status changes from ACTIVE → PASSED_OUT → ALUMNI
  - Student becomes eligible for certificates
- **API**: `PATCH /api/v1/students/:id` (update status)

## 12. Certificate Issuance
- **Purpose**: Issue certificates to eligible students
- **Process**:
  - Student requests certificate (BONAFIDE/CLC)
  - Admin/HOD reviews and approves request
  - Certificate is issued and PDF is generated
  - Student status must be PASSED_OUT or ALUMNI for certificate eligibility
- **APIs**:
  - `POST /api/v1/certificates`
  - `PATCH /api/v1/certificates/:id/status`
  - `GET /api/v1/certificates/:id/download`

## Validation Rules Enforced

### 1. One student cannot have two active semesters
- System validates that a student can only be enrolled in one ongoing semester at a time

### 2. Same subject cannot be chosen twice in same semester
- System validates that each subject type (MJC, MIC, MDC) can only be selected once per semester

### 3. Certificate cannot be issued unless student status allows it
- Students must have PASSED_OUT or ALUMNI status to request certificates
- System validates student eligibility before allowing certificate requests

### 4. NEP Subject Type Restrictions
- Each semester can have only one MJC (Major Core)
- Each semester can have only one MIC (Minor Core) 
- Each semester can have only one MDC (Multi-Disciplinary Course)
- SEC and VAC subjects can be multiple as per curriculum

### 5. Semester Progression Rules
- Student must complete previous semester to be eligible for next semester
- Automatic promotion occurs when semester marked as COMPLETED
- Manual assignment allowed for special cases

## API Access Control

### Admin Access
- All CRUD operations
- Bulk operations
- System configuration

### HOD Access
- Department-specific operations
- Student management within department
- Subject and semester management

### Student Access
- Own record viewing
- Subject selection for enrolled semesters
- Certificate requests
- Payment tracking

## Data Integrity Rules

### 1. Unique Constraints
- Student email and registration number must be unique
- Subject codes must be unique within course and semester
- Student-semester combinations must be unique

### 2. Foreign Key Constraints
- All relationships enforced at database level
- Referential integrity maintained

### 3. Business Logic Constraints
- Semester numbers must be sequential
- Course duration must match number of semesters
- Student cannot be enrolled in semesters from different courses simultaneously

## Audit Trail
- All operations are logged with user, action, entity, and payload
- Critical operations are tracked for compliance
- Changes to student records are versioned