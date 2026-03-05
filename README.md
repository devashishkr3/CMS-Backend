# College ERP Backend System

A comprehensive College ERP (Enterprise Resource Planning) system built with Node.js, Express, and PostgreSQL using Prisma ORM. This system manages all aspects of college operations including student management, admissions, payments, certificates, and content management.

## 🚀 Features

### Student Management
- Complete student lifecycle management
- Registration and profile management
- Semester assignment and tracking
- Status management (Active, Suspended, Alumni, etc.)

### Academic Management
- Department, Course, and Subject management
- Semester planning and auto-assignment
- Student semester tracking with status updates

### Admission Process
- Admission workflow with status transitions
- Admission window management
- Application tracking and history

### Payment Processing
- Secure payment handling
- Fee breakdown by category
- Refund management
- Receipt generation

### File Management
- Cloudflare R2 integration for file storage
- Document management (photos, certificates, etc.)
- Secure file upload/download with verification

### Certificate Management
- Certificate request workflow
- PDF certificate generation
- Status tracking (Pending, Approved, Rejected, Issued)

### Content Management System
- Gallery management
- News and notice board
- Public content management

### Audit and Security
- Comprehensive audit logging
- Role-based access control (RBAC)
- JWT-based authentication
- Production-grade error handling

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT
- **Validation**: Joi
- **File Storage**: Cloudflare R2
- **PDF Generation**: PDFKit

## 📁 Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Request handlers
├── middlewares/      # Express middlewares
├── routes/          # API route definitions
├── services/        # Business logic services
├── utils/           # Utility functions
└── validation/      # Request validation schemas
```

## 🔐 Role-Based Access Control (RBAC)

The system implements a comprehensive RBAC system:

- **ADMIN**: Full system access
- **HOD**: Department-specific access
- **ACCOUNTANT**: Payment-related operations
- **STUDENT**: Self-service access

## 🗄️ Database Schema

The system uses PostgreSQL with Prisma ORM. Key models include:

- **User**: System users with roles
- **Student**: Student records
- **Department**: Academic departments
- **Course**: Academic courses
- **Subject**: Course subjects
- **Semester**: Academic semesters
- **Admission**: Admission applications
- **Payment**: Payment records
- **CertificateRequest**: Certificate requests
- **StudentDocument**: Student documents
- **AuditLog**: System audit logs

## 📡 API Endpoints

The API follows RESTful conventions and is available under `/api/v1/`.

## 🚦 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- Cloudflare R2 account (for file storage)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see `.env.example`)
4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## 🛡️ Security Features

- JWT-based authentication
- Rate limiting
- Input validation
- SQL injection prevention (Prisma)
- XSS protection (Helmet.js)
- CORS configuration

## 📊 Monitoring & Logging

- Structured logging
- Comprehensive audit trails
- Error tracking
- Performance monitoring

## 🚀 Deployment

The application is production-ready with:

- Graceful shutdown handling
- Process event management
- Error recovery mechanisms
- Health check endpoints

## 🤝 Contributing

Contributions are welcome! Please follow the standard fork-and-pull request workflow.

## 📄 License

This project is licensed under the MIT License.