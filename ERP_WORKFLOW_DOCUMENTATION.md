# College ERP - NEP 2020 Compliant Workflow Documentation

## Complete Step-by-Step Workflow

### Step 1: Department Creation
- Create departments (Arts, Science, Commerce, etc.)
- Each department has unique code and description
- Used to organize courses and academic activities

### Step 2: Course Creation
- Create courses under respective departments (BA, BSc, BCom, etc.)
- Define course duration (typically 3 years for undergraduate)
- Associate with the appropriate department

### Step 3: Session Mapping
- Create academic sessions (e.g., 2026-2030 for 4-year courses)
- Map sessions to specific courses
- Defines the academic timeline for students

### Step 4: Semester Setup
- Create semesters for each course (typically 6 semesters for 3-year courses)
- Each semester is numbered (1-6) and linked to a course
- Semesters follow sequential order

### Step 5: Subject Setup (NEP)
- Create subjects following NEP guidelines:
  - **MJC** (Major Core): Core subject of the main discipline
  - **MIC** (Minor Core): Minor core subject from related discipline
  - **MDC** (Discipline Core): Discipline-specific core subject
  - **SEC** (Skill Enhancement Course): Practical/skill-based courses
  - **VAC** (Value Added Course): Elective courses for skill enhancement
- Each subject is assigned to a specific semester and course
- Only one MJC, MIC, and MDC per semester per student (enforced by validation)

### Step 6: Admission Flow
- **Admission Window**: Admin creates admission windows for courses
- **Student Registration**: Students create accounts with required details
- **Admission Creation**: Admin creates admission record for student
- **Payment Process**: Student pays admission fees with breakup
- **Admission Confirmation**: Admin confirms admission, triggers automatic semester assignment

### Step 7: Payment Flow
- **Fee Calculation**: System calculates total fees with breakup (Tuition, Exam, Infrastructure, etc.)
- **Payment Gateway**: Integration with payment gateway (Razorpay, etc.)
- **Receipt Generation**: Automatic receipt generation upon successful payment
- **Fee Breakup**: Detailed breakdown of fee heads for transparency

### Step 8: Semester Assignment
- **Automatic Assignment**: Upon admission confirmation, student is automatically assigned to Semester 1
- **Manual Assignment**: Admin/HOD can manually assign students to semesters
- **Validation**: System ensures only one active semester per student
- **Status Tracking**: Semesters have statuses (ONGOING, COMPLETED, FAILED, PROMOTED)

### Step 9: Subject Selection
- **NEP Compliance**: Students select subjects following NEP guidelines
- **Constraint Validation**:
  - Only one MJC subject per semester
  - Only one MIC subject per semester
  - Only one MDC subject per semester
  - Multiple SEC and VAC subjects allowed
- **Student Interface**: Students can select/deselect subjects during allowed periods

### Step 10: Promotion Process
- **Manual Promotion**: Admin/HOD can manually promote students to next semester
- **Automatic Promotion**: System automatically promotes students when semester is marked as COMPLETED
- **Failed Students**: Students who fail remain in same semester, may need to repeat
- **Final Semester**: Students completing final semester are marked as PASSED_OUT

### Step 11: Final Passout
- **Course Completion**: Student completes all semesters in the course
- **Status Update**: Student status automatically updated to PASSED_OUT
- **Alumni Status**: Student may be transitioned to ALUMNI status
- **Academic Records**: All academic records preserved for future reference

### Step 12: Certificate Issuance
- **Certificate Request**: Students can request certificates (BONAFIDE or CLC)
- **Admin Approval**: Admin/HOD reviews and approves certificate requests
- **Issuance Process**: Approved certificates are issued with PDF generation
- **Eligibility Check**: System verifies student eligibility based on status
- **Download Access**: Students can download issued certificates

## Semester Flow Explanation

### ONGOING → COMPLETED → PROMOTION Flow
1. **ONGOING**: Student is enrolled in semester, attending classes
2. **COMPLETED**: Student successfully completes semester requirements
3. **Auto-Promotion**: System automatically assigns student to next semester
4. **Manual Promotion**: Admin can also trigger promotion manually

### FAILED → REPEAT/DETAIN Flow
1. **FAILED**: Student fails to meet semester requirements
2. **No Promotion**: Student is not promoted to next semester
3. **Repeat Option**: Student may repeat the semester
4. **Detention**: Student may be detained based on institutional policy

## Validation Rules Enforced

### Student-Semester Constraints
- Only one active semester per student at any time
- Students cannot be assigned to multiple ongoing semesters
- Semester progression must follow sequential order (1→2→3→...n)

### Subject Selection Constraints
- One MJC (Major Core) subject per semester (enforced by validation)
- One MIC (Minor Core) subject per semester (enforced by validation) 
- One MDC (Discipline Core) subject per semester (enforced by validation)
- Multiple SEC (Skill Enhancement) subjects allowed per semester
- Multiple VAC (Value Added) subjects allowed per semester
- No duplicate subjects in same semester

### Certificate Eligibility
- Only students with ACTIVE, PASSED_OUT, or ALUMNI status can request certificates
- Students with SUSPENDED, DROPOUT status cannot request certificates
- Certificate issuance requires admin approval

### Promotion Rules
- Students can only be promoted if current semester status is COMPLETED
- Students with FAILED status cannot be promoted automatically
- Manual promotion possible by Admin/HOD after review

## Automatic Flows Implemented

### Admission to Semester-1 Auto Assignment
- When admission status is CONFIRMED
- System checks if student already has ongoing semester
- If no ongoing semester exists, auto-assigns to Semester 1
- Creates studentSemester record with ONGOING status

### Semester Completion Auto-Promotion
- When semester status is updated to COMPLETED
- System finds next sequential semester in same course
- If next semester exists and student not already assigned
- Auto-creates studentSemester record for next semester
- If no next semester exists (final semester), updates student status to PASSED_OUT

### Failed Semester Handling
- When semester status is updated to FAILED
- System prevents auto-promotion to next semester
- Student remains in current semester
- Admin/HOD must decide on repeat or detention

## API Endpoints Summary

### Student Management
- `POST /api/students` - Create student
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get specific student
- `PATCH /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student (soft delete)

### Admission Management
- `POST /api/admissions` - Create admission
- `GET /api/admissions` - Get all admissions
- `PATCH /api/admissions/:id` - Update admission status
- `POST /api/admissions/:id/confirm` - Confirm admission (triggers auto-assignment)

### Semester Management
- `GET /api/semesters` - Get all semesters
- `POST /api/semesters/:id/auto-assign` - Auto-assign students to semester
- `POST /api/semesters/:id/promote` - Promote students to next semester
- `PATCH /api/semesters/bulk-status` - Bulk update semester statuses

### Subject Selection
- `POST /api/student-subjects` - Assign subject to student
- `GET /api/student-subjects` - Get student subjects
- `DELETE /api/student-subjects/:id` - Remove subject assignment
- `POST /api/semesters/:semesterId/:studentId/subjects/bulk` - Bulk assign subjects

### Certificate Management
- `POST /api/certificates` - Request certificate
- `GET /api/certificates` - Get certificate requests
- `PATCH /api/certificates/:id` - Update certificate status
- `GET /api/certificates/:id/download` - Download certificate PDF

## Security & Access Control

### Role-Based Access
- **ADMIN**: Full access to all operations
- **HOD**: Access to department-specific operations
- **ACCOUNTANT**: Access to payment and financial operations
- **STUDENT**: Access to personal records and self-service features

### Data Validation
- All inputs validated using JOI validation schemas
- Prisma-level constraints enforced for data integrity
- Business rule validation implemented in controllers
- Audit logging for all critical operations

## Audit Trail
- All critical operations are logged in audit logs
- Tracks user, action, entity, and payload
- IP address and user agent captured for security
- Audit logs available for compliance and monitoring

This comprehensive workflow ensures NEP 2020 compliance while maintaining robust academic management processes.