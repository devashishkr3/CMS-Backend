# College ERP API Endpoints

This document lists all available API endpoints in the College ERP system.

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication

### Register (Admin Only)
```
POST /auth/register
```
Request Body:
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "phone": "string",
  "role": "ADMIN|HOD|ACCOUNTANT"
}
```

### Login
```
POST /auth/login
```
Request Body:
```json
{
  "email": "string",
  "password": "string"
}
```

### Refresh Token
```
POST /auth/refresh
```

### Logout
```
POST /auth/logout
```

## Students

### Create Student
```
POST /students
```
Access: ADMIN, HOD

### Get All Students
```
GET /students
```
Query Parameters:
- status: Student status filter
- courseId: Filter by course
- sessionId: Filter by session
- search: Search by name, email, or registration number

Access: ADMIN, HOD

### Get Student by ID
```
GET /students/:id
```
Access: ADMIN, HOD, STUDENT (own record)

### Update Student
```
PATCH /students/:id
```
Access: ADMIN, HOD

### Delete Student
```
DELETE /students/:id
```
Access: ADMIN

### Assign Semester to Student
```
POST /students/:id/semester
```
Access: ADMIN, HOD

### Update Student Semester Status
```
PATCH /students/:studentId/semesters/:semesterId
```
Access: ADMIN, HOD

## Departments

### Create Department
```
POST /departments
```
Access: ADMIN

### Get All Departments
```
GET /departments
```
Access: ADMIN, HOD

### Get Department by ID
```
GET /departments/:id
```
Access: ADMIN, HOD

### Update Department
```
PATCH /departments/:id
```
Access: ADMIN

### Delete Department
```
DELETE /departments/:id
```
Access: ADMIN

## Courses

### Create Course
```
POST /courses
```
Access: ADMIN

### Get All Courses
```
GET /courses
```
Access: ADMIN, HOD

### Get Course by ID
```
GET /courses/:id
```
Access: ADMIN, HOD

### Update Course
```
PATCH /courses/:id
```
Access: ADMIN

### Delete Course
```
DELETE /courses/:id
```
Access: ADMIN

## Subjects

### Create Subject
```
POST /subjects
```
Access: ADMIN

### Get All Subjects
```
GET /subjects
```
Access: ADMIN, HOD

### Get Subject by ID
```
GET /subjects/:id
```
Access: ADMIN, HOD

### Update Subject
```
PATCH /subjects/:id
```
Access: ADMIN

### Delete Subject
```
DELETE /subjects/:id
```
Access: ADMIN

## Semesters

### Create Semester
```
POST /semesters
```
Access: ADMIN

### Get All Semesters
```
GET /semesters
```
Access: ADMIN, HOD

### Get Semester by ID
```
GET /semesters/:id
```
Access: ADMIN, HOD

### Update Semester
```
PATCH /semesters/:id
```
Access: ADMIN

### Delete Semester
```
DELETE /semesters/:id
```
Access: ADMIN

### Auto-Assign Students to Semesters
```
POST /semesters/auto-assign
```
Access: ADMIN

### Promote Students to Next Semester
```
POST /semesters/promote
```
Access: ADMIN

## Admissions

### Create Admission
```
POST /admissions
```
Access: ADMIN, HOD

### Get All Admissions
```
GET /admissions
```
Query Parameters:
- status: Admission status filter
- courseId: Filter by course
- studentId: Filter by student

Access: ADMIN, HOD

### Get Admission by ID
```
GET /admissions/:id
```
Access: ADMIN, HOD

### Update Admission Status
```
PATCH /admissions/:id/status
```
Access: ADMIN, HOD

### Create Admission Window
```
POST /admissions/windows
```
Access: ADMIN

### Get All Admission Windows
```
GET /admissions/windows
```
Query Parameters:
- courseId: Filter by course
- departmentId: Filter by department
- enabled: Filter by enabled status

Access: ADMIN, HOD

### Get Admission Window by ID
```
GET /admissions/windows/:id
```
Access: ADMIN, HOD

### Update Admission Window
```
PATCH /admissions/windows/:id
```
Access: ADMIN

### Delete Admission Window
```
DELETE /admissions/windows/:id
```
Access: ADMIN

## Payments

### Create Payment
```
POST /payments
```
Access: ADMIN, ACCOUNTANT

### Get All Payments
```
GET /payments
```
Query Parameters:
- status: Payment status filter
- studentId: Filter by student
- courseId: Filter by course

Access: ADMIN, ACCOUNTANT, HOD

### Get Payment by ID
```
GET /payments/:id
```
Access: ADMIN, ACCOUNTANT, HOD, STUDENT (own payments)

### Update Payment Status
```
PATCH /payments/:id/status
```
Access: ADMIN, ACCOUNTANT

### Refund Payment
```
POST /payments/:id/refund
```
Access: ADMIN, ACCOUNTANT

## Files

### Upload File
```
POST /files/upload
```
Form Data:
- file: File to upload
- type: Document type
- studentId: Associated student ID

Access: ADMIN, HOD

### Get File by ID
```
GET /files/:id
```
Access: ADMIN, HOD, STUDENT (own files)

### Download File
```
GET /files/:id/download
```
Access: ADMIN, HOD, STUDENT (own files)

### Verify Document
```
PATCH /files/:id/verify
```
Access: ADMIN, HOD

## Audit Logs

### Get All Audit Logs
```
GET /audit
```
Query Parameters:
- userId: Filter by user
- action: Filter by action
- entity: Filter by entity type
- entityId: Filter by entity ID
- startDate: Filter by start date
- endDate: Filter by end date
- page: Page number (default: 1)
- limit: Results per page (default: 50)

Access: ADMIN

### Get Audit Log by ID
```
GET /audit/:id
```
Access: ADMIN

### Get Audit Logs for Entity
```
GET /audit/entity/:entity/:entityId
```
Access: ADMIN, HOD

### Get User Activity Logs
```
GET /audit/user/:userId
```
Access: ADMIN, HOD

### Export Audit Logs
```
GET /audit/export
```
Query Parameters:
- startDate: Filter by start date
- endDate: Filter by end date
- format: Export format (json or csv, default: json)

Access: ADMIN

### Get Audit Statistics
```
GET /audit/stats
```
Query Parameters:
- days: Number of days to include (default: 30)

Access: ADMIN

### Get Recent Audit Logs
```
GET /audit/recent
```
Query Parameters:
- limit: Number of recent logs (default: 50)

Access: ADMIN

## Certificates

### Create Certificate Request
```
POST /certificates
```
Request Body:
```json
{
  "studentId": "string",
  "type": "BONAFIDE|CLC",
  "purpose": "string",
  "departmentId": "string"
}
```
Access: STUDENT, ADMIN, HOD

### Get All Certificate Requests
```
GET /certificates
```
Query Parameters:
- studentId: Filter by student
- type: Filter by certificate type
- status: Filter by status
- departmentId: Filter by department

Access: ADMIN, HOD, STUDENT (own requests)

### Get Certificate Request by ID
```
GET /certificates/:id
```
Access: ADMIN, HOD, STUDENT (own requests)

### Update Certificate Status
```
PATCH /certificates/:id/status
```
Request Body:
```json
{
  "status": "APPROVED|REJECTED|ISSUED",
  "notes": "string"
}
```
Access: ADMIN, HOD

### Issue Certificate
```
POST /certificates/:id/issue
```
Access: ADMIN, HOD

### Download Certificate
```
GET /certificates/:id/download
```
Access: STUDENT (own certificates), ADMIN, HOD

### Delete Certificate Request
```
DELETE /certificates/:id
```
Access: ADMIN, STUDENT (own pending requests)

## CMS

### Gallery Items

#### Create Gallery Item
```
POST /cms/gallery
```
Access: ADMIN

#### Get All Gallery Items
```
GET /cms/gallery
```
Query Parameters:
- search: Search by title

Access: PUBLIC

#### Get Gallery Item by ID
```
GET /cms/gallery/:id
```
Access: PUBLIC

#### Update Gallery Item
```
PATCH /cms/gallery/:id
```
Access: ADMIN

#### Delete Gallery Item
```
DELETE /cms/gallery/:id
```
Access: ADMIN

### News Items

#### Create News Item
```
POST /cms/news
```
Access: ADMIN

#### Get All News Items
```
GET /cms/news
```
Query Parameters:
- search: Search by title or body
- isPublished: Filter by published status (ADMIN only)

Access: PUBLIC (published only), ADMIN (all)

#### Get News Item by ID
```
GET /cms/news/:id
```
Access: PUBLIC (published only), ADMIN (all)

#### Update News Item
```
PATCH /cms/news/:id
```
Access: ADMIN

#### Delete News Item
```
DELETE /cms/news/:id
```
Access: ADMIN

### Notice Items

#### Create Notice Item
```
POST /cms/notices
```
Access: ADMIN

#### Get All Notice Items
```
GET /cms/notices
```
Query Parameters:
- search: Search by title or body

Access: PUBLIC

#### Get Notice Item by ID
```
GET /cms/notices/:id
```
Access: PUBLIC

#### Update Notice Item
```
PATCH /cms/notices/:id
```
Access: ADMIN

#### Delete Notice Item
```
DELETE /cms/notices/:id
```
Access: ADMIN

## Health Check

### API Health
```
GET /health
```
Access: PUBLIC

### Root Endpoint
```
GET /
```
Access: PUBLIC