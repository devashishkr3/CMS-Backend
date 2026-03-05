# Audit Logging Guide

This guide explains how to use the enhanced audit logging system in the College ERP backend.

## Overview

The audit logging system tracks all critical actions performed by users in the system. It captures detailed information including:
- User who performed the action
- Action performed
- Entity affected
- Entity ID
- Payload/data related to the action
- IP address of the client
- User agent of the client
- Timestamp of the action

## Components

### 1. Audit Log Model

The `AuditLog` model in Prisma schema includes:
- `userId`: ID of the user who performed the action
- `action`: Description of the action (e.g., CREATE_STUDENT, UPDATE_DEPARTMENT)
- `entity`: Type of entity affected (e.g., Student, Department)
- `entityId`: ID of the specific entity affected
- `payload`: JSON data containing details about the action
- `ipAddress`: IP address of the client
- `userAgent`: User agent string of the client
- `timestamp`: When the action occurred

### 2. Audit Logger Utility

The `auditLogger.js` utility provides functions for centralized audit logging:

#### logAudit(options)
Manually log an audit entry.

```javascript
const { logAudit } = require('../utils/auditLogger');

await logAudit({
  userId: req.user.id,
  action: 'CUSTOM_ACTION',
  entity: 'CustomEntity',
  entityId: entityId,
  payload: { key: 'value' },
  req // Pass the request object to capture IP and user agent
});
```

#### auditMiddleware(action, entity)
Express middleware for automatic audit logging.

```javascript
const { auditMiddleware } = require('../utils/auditLogger');

router.post('/students', 
  auditMiddleware('CREATE_STUDENT', 'Student'),
  studentController.createStudent
);
```

#### auditSuccessMiddleware()
Express middleware to log successful responses.

```javascript
const { auditSuccessMiddleware } = require('../utils/auditLogger');

router.use(auditSuccessMiddleware());
```

### 3. Audit Controller

The audit controller provides endpoints for viewing and exporting audit logs:
- `GET /audit`: Get all audit logs with filtering
- `GET /audit/:id`: Get specific audit log
- `GET /audit/entity/:entity/:entityId`: Get audit logs for specific entity
- `GET /audit/user/:userId`: Get user activity logs
- `GET /audit/export`: Export audit logs (JSON/CSV)
- `GET /audit/stats`: Get audit statistics
- `GET /audit/recent`: Get recent audit logs

## Usage Examples

### Manual Logging in Controllers

```javascript
const { logAudit } = require('../utils/auditLogger');

exports.createStudent = async (req, res, next) => {
  try {
    // ... validation and creation logic ...
    
    const student = await prisma.student.create({
      // ... student data ...
    });
    
    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'CREATE_STUDENT',
      entity: 'Student',
      entityId: student.id,
      payload: { name, email, phone, courseId, sessionId },
      req
    });
    
    res.status(201).json({
      status: 'success',
      data: { student }
    });
  } catch (error) {
    next(error);
  }
};
```

### Automatic Logging with Middleware

```javascript
const express = require('express');
const router = express.Router();
const { auditMiddleware, auditSuccessMiddleware } = require('../utils/auditLogger');

// Apply middleware to routes
router.post('/departments', 
  auditMiddleware('CREATE_DEPARTMENT', 'Department'),
  departmentController.createDepartment
);

// Apply success middleware to automatically log responses
router.use(auditSuccessMiddleware());

module.exports = router;
```

## API Endpoints

### Get All Audit Logs
```
GET /audit
Query Parameters:
- userId: Filter by user ID
- action: Filter by action (partial match)
- entity: Filter by entity type (partial match)
- entityId: Filter by entity ID
- startDate: Filter by start date (ISO format)
- endDate: Filter by end date (ISO format)
- page: Page number (default: 1)
- limit: Results per page (default: 50)
```

### Get Specific Audit Log
```
GET /audit/:id
```

### Get Entity Audit Logs
```
GET /audit/entity/:entity/:entityId
```

### Get User Activity Logs
```
GET /audit/user/:userId
```

### Export Audit Logs
```
GET /audit/export
Query Parameters:
- startDate: Filter by start date (ISO format)
- endDate: Filter by end date (ISO format)
- format: Export format (json or csv, default: json)
```

### Get Audit Statistics
```
GET /audit/stats
Query Parameters:
- days: Number of days to include in statistics (default: 30)
```

### Get Recent Audit Logs
```
GET /audit/recent
Query Parameters:
- limit: Number of recent logs to retrieve (default: 50)
```

## Best Practices

1. **Always log critical actions**: Log all CRUD operations and important state changes
2. **Include relevant payload data**: Include enough information to understand what happened
3. **Use consistent action naming**: Follow the pattern VERB_ENTITY (e.g., CREATE_STUDENT, UPDATE_DEPARTMENT)
4. **Pass the request object**: Always pass the req object to capture IP and user agent
5. **Handle errors gracefully**: Audit logging failures should not break the main functionality
6. **Respect privacy**: Do not log sensitive information like passwords or personal identification numbers

## Security Considerations

- Only ADMIN users can access audit logs
- HOD users can only access audit logs for their own entities
- All audit log access is itself logged for accountability
- IP addresses and user agents are stored for security analysis
- Regular export and backup of audit logs is recommended for compliance