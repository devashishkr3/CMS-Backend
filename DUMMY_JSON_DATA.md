# NEP Compliant College ERP - Dummy JSON Data

## 1. Department
```json
{
  "name": "Computer Science and Engineering",
  "code": "CSE",
  "description": "Department of Computer Science and Engineering"
}
```

## 2. Course (BA / BSc)
```json
{
  "code": "BSC-CS",
  "name": "Bachelor of Science in Computer Science",
  "durationYears": 3,
  "departmentId": "uuid-string"
}
```

## 3. Session (2024–2027)
```json
{
  "name": "2024-2027",
  "startYear": 2024,
  "endYear": 2027,
  "courseId": "uuid-string"
}
```

## 4. Semesters (1–6)
```json
{
  "number": 1,
  "courseId": "uuid-string"
}
```

## 5. Subjects (with MJC, MIC, MDC, SEC, VAC)
```json
{
  "name": "Programming Fundamentals",
  "code": "PF-101",
  "type": "MJC",
  "semesterId": "uuid-string",
  "courseId": "uuid-string"
}
```

```json
{
  "name": "Web Development",
  "code": "WD-102", 
  "type": "MIC",
  "semesterId": "uuid-string",
  "courseId": "uuid-string"
}
```

```json
{
  "name": "Environmental Science",
  "code": "ES-103",
  "type": "MDC",
  "semesterId": "uuid-string",
  "courseId": "uuid-string"
}
```

```json
{
  "name": "Communication Skills Lab",
  "code": "CSL-104",
  "type": "SEC",
  "semesterId": "uuid-string",
  "courseId": "uuid-string"
}
```

```json
{
  "name": "Industry 4.0",
  "code": "I40-105",
  "type": "VAC",
  "semesterId": "uuid-string",
  "courseId": "uuid-string"
}
```

## 6. Student
```json
{
  "name": "Rahul Sharma",
  "email": "rahul.sharma@example.com",
  "phone": "9876543210",
  "dob": "2002-05-15",
  "guardianName": "Rajesh Sharma",
  "address": "123 MG Road, Bangalore, Karnataka - 560001",
  "courseId": "uuid-string",
  "sessionId": "uuid-string"
}
```

## 7. Admission
```json
{
  "studentId": "uuid-string",
  "courseId": "uuid-string",
  "departmentId": "uuid-string"
}
```

## 8. Payment + Breakup
```json
{
  "studentId": "uuid-string",
  "admissionId": "uuid-string",
  "totalAmount": 150000,
  "gateway": "razorpay",
  "txnId": "txn_1234567890",
  "referenceNo": "REF123456",
  "breakups": [
    {
      "head": "TUITION",
      "amount": 100000
    },
    {
      "head": "EXAM",
      "amount": 25000
    },
    {
      "head": "INFRASTRUCTURE",
      "amount": 15000
    },
    {
      "head": "DEVELOPMENT",
      "amount": 10000
    }
  ]
}
```

## 9. StudentSemester
```json
{
  "studentId": "uuid-string",
  "semesterId": "uuid-string",
  "status": "ONGOING",
  "feePaid": false,
  "startDate": "2024-07-15",
  "endDate": null
}
```

## 10. StudentSubject
```json
{
  "studentId": "uuid-string",
  "subjectId": "uuid-string",
  "semesterId": "uuid-string"
}
```

## 11. CertificateRequest
```json
{
  "studentId": "uuid-string",
  "type": "BONAFIDE",
  "purpose": "For job application",
  "departmentId": "uuid-string"
}
```