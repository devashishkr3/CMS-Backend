# Complete API List for NEP Compliant College ERP

## 1. Authentication APIs
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - User logout

## 2. Master APIs

### Department APIs
- `POST /api/v1/departments` - Create department
- `GET /api/v1/departments` - Get all departments
- `GET /api/v1/departments/:id` - Get department by ID
- `PATCH /api/v1/departments/:id` - Update department
- `DELETE /api/v1/departments/:id` - Delete department

### Course APIs
- `POST /api/v1/courses` - Create course
- `GET /api/v1/courses` - Get all courses
- `GET /api/v1/courses/:id` - Get course by ID
- `PATCH /api/v1/courses/:id` - Update course
- `DELETE /api/v1/courses/:id` - Delete course

### Session APIs
- `POST /api/v1/sessions` - Create session
- `GET /api/v1/sessions` - Get all sessions
- `GET /api/v1/sessions/:id` - Get session by ID
- `PATCH /api/v1/sessions/:id` - Update session
- `DELETE /api/v1/sessions/:id` - Delete session

### Semester APIs
- `POST /api/v1/semesters` - Create semester
- `GET /api/v1/semesters` - Get all semesters
- `GET /api/v1/semesters/:id` - Get semester by ID
- `POST /api/v1/semesters/:id/auto-assign` - Auto-assign students to semester
- `POST /api/v1/semesters/:id/promote` - Promote students to next semester
- `PATCH /api/v1/semesters/:id/status` - Bulk update semester status

## 3. Subject Selection APIs

### Subject APIs
- `POST /api/v1/subjects` - Create subject (with type: MJC/MIC/MDC/SEC/VAC)
- `GET /api/v1/subjects` - Get all subjects (with filtering by type)
- `GET /api/v1/subjects/:id` - Get subject by ID
- `PATCH /api/v1/subjects/:id` - Update subject
- `DELETE /api/v1/subjects/:id` - Delete subject

### Student Subject APIs
- `POST /api/v1/student-subjects` - Create student subject assignment
- `GET /api/v1/student-subjects` - Get all student subject assignments
- `GET /api/v1/student-subjects/:id` - Get student subject assignment by ID
- `GET /api/v1/student-subjects/student/:studentId/semester/:semesterId` - Get student's subjects for a semester
- `POST /api/v1/student-subjects/bulk` - Bulk assign subjects to student
- `DELETE /api/v1/student-subjects/:id` - Delete student subject assignment

## 4. Admission APIs

### Admission APIs
- `POST /api/v1/admissions` - Create admission
- `GET /api/v1/admissions` - Get all admissions (with filtering)
- `GET /api/v1/admissions/:id` - Get admission by ID
- `PATCH /api/v1/admissions/:id/status` - Update admission status (auto-assigns semester 1 when CONFIRMED)

### Admission Window APIs
- `POST /api/v1/admissions/windows` - Create admission window
- `GET /api/v1/admissions/windows` - Get all admission windows
- `GET /api/v1/admissions/windows/:id` - Get admission window by ID
- `PATCH /api/v1/admissions/windows/:id` - Update admission window
- `DELETE /api/v1/admissions/windows/:id` - Delete admission window

## 5. Student APIs

### Student Management APIs
- `POST /api/v1/students` - Create student
- `GET /api/v1/students` - Get all students (with filtering)
- `GET /api/v1/students/:id` - Get student by ID
- `PATCH /api/v1/students/:id` - Update student
- `DELETE /api/v1/students/:id` - Delete student (soft delete)

### Student Semester APIs
- `POST /api/v1/students/:id/semesters` - Assign semester to student
- `PATCH /api/v1/students/:studentId/semesters/:semesterId` - Update student semester status (auto-promotes when COMPLETED)

## 6. Payment APIs

### Payment APIs
- `POST /api/v1/payments` - Create payment
- `GET /api/v1/payments` - Get all payments
- `GET /api/v1/payments/:id` - Get payment by ID
- `POST /api/v1/payments/:id/refund` - Process refund
- `GET /api/v1/payments/student/:studentId` - Get payments for a student

## 7. Certificate APIs

### Certificate APIs
- `POST /api/v1/certificates` - Create certificate request
- `GET /api/v1/certificates` - Get all certificate requests
- `GET /api/v1/certificates/:id` - Get certificate request by ID
- `PATCH /api/v1/certificates/:id/status` - Update certificate status
- `DELETE /api/v1/certificates/:id` - Delete certificate request
- `GET /api/v1/certificates/:id/download` - Download certificate PDF

## 8. Audit APIs

### Audit APIs
- `GET /api/v1/audit` - Get all audit logs
- `GET /api/v1/audit/:id` - Get audit log by ID
- `GET /api/v1/audit/entity/:entity` - Get audit logs for specific entity

## Access Control Summary

### Admin Access (All APIs)
- Full CRUD operations
- Bulk operations
- System configuration
- User management

### HOD Access
- Department-specific operations
- Student management within department
- Subject and semester management
- Admission processing
- Certificate approval

### Student Access
- Own record viewing
- Subject selection for enrolled semesters
- Certificate requests
- Payment tracking
- Own audit logs