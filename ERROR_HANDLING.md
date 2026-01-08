# College ERP System - Error Handling

This document provides a comprehensive overview of the error handling implementation across the College ERP system.

## Overview

The College ERP system implements a robust error handling mechanism that follows industry best practices for Node.js/Express applications. The system distinguishes between operational and programming errors and handles each appropriately.

## Error Handling Architecture

### Global Error Handler
The system uses a centralized error handling middleware located at `src/middlewares/errorHandler.js` that catches all unhandled errors and provides appropriate responses.

### Error Types

#### 1. Operational Errors
These are expected errors that can occur during normal operation:
- Validation errors
- Authentication/authorization errors
- Database constraint violations
- Resource not found errors
- Business logic errors

#### 2. Programming Errors
These are unexpected errors due to bugs or system failures:
- Unhandled exceptions
- System crashes
- Database connection failures
- Internal server errors

## Error Handling Implementation

### AppError Class
The system uses a custom `AppError` class for creating operational errors:

```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
```

### Error Middleware
The error handling middleware is implemented in `src/middlewares/errorHandler.js`:

```javascript
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = handleKnownErrors(err);

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};
```

## Error Response Format

### Success Response
```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": { ... },
  "results": 10
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Error Categories and Handling

### 1. Validation Errors

#### Joi Validation Errors
```javascript
if (err.name === "ValidationError") {
  const messages = err.details ? err.details.map(d => d.message) : [err.message];
  return new AppError(`Validation error: ${messages.join(", ")}`, 400);
}
```

**HTTP Status**: 400 Bad Request
**Response**:
```json
{
  "status": "error",
  "message": "Validation error: Name is required, Email must be a valid email"
}
```

#### Express Validator Errors
```javascript
if (err.errors && Array.isArray(err.errors)) {
  const messages = err.errors.map(e => e.msg);
  return new AppError(`Validation error: ${messages.join(", ")}`, 400);
}
```

### 2. Database Errors

#### Prisma Client Known Request Errors
```javascript
if (err.name === "PrismaClientKnownRequestError") {
  // Unique constraint violation
  if (err.code === "P2002") {
    const field = err.meta?.target?.join(", ");
    return new AppError(`Duplicate field value: ${field}`, 400);
  }
  
  // Record not found
  if (err.code === "P2025") {
    return new AppError("Record not found", 404);
  }
  
  // Foreign key constraint violation
  if (err.code === "P2003") {
    return new AppError("Foreign key constraint violation", 400);
  }
  
  // Invalid argument
  if (err.code === "P2009") {
    return new AppError("Invalid query argument", 400);
  }
}
```

#### Prisma Client Initialization Error
```javascript
if (err.name === "PrismaClientInitializationError") {
  return new AppError("Database connection error", 500);
}
```

#### Prisma Client Runtime Error
```javascript
if (err.name === "PrismaClientRustPanicError") {
  return new AppError("Database error", 500);
}
```

### 3. Authentication Errors

#### JWT Errors
```javascript
if (err.name === "JsonWebTokenError") {
  return new AppError("Invalid token", 401);
}

if (err.name === "TokenExpiredError") {
  return new AppError("Token expired", 401);
}
```

#### Custom Authentication Errors
- Invalid credentials: 401 Unauthorized
- Token expired: 401 Unauthorized
- Account inactive: 401 Unauthorized
- Access denied: 403 Forbidden

### 4. Authorization Errors
```javascript
return next(new AppError('You do not have permission to perform this action', 403));
```

### 5. Resource Not Found Errors
```javascript
return next(new AppError('Resource not found', 404));
```

### 6. Business Logic Errors
- Invalid status transitions
- Duplicate resource creation
- Constraint violations
- Business rule violations

## HTTP Status Codes

### 2xx Success
- `200`: OK - Request successful
- `201`: Created - Resource created successfully
- `204`: No Content - Request successful, no content to return

### 4xx Client Errors
- `400`: Bad Request - Validation or client error
- `401`: Unauthorized - Authentication required
- `403`: Forbidden - Access denied
- `404`: Not Found - Resource not found
- `409`: Conflict - Resource already exists
- `422`: Unprocessable Entity - Validation failed
- `429`: Too Many Requests - Rate limit exceeded

### 5xx Server Errors
- `500`: Internal Server Error - Unexpected server error
- `502`: Bad Gateway - Upstream server error
- `503`: Service Unavailable - Service temporarily unavailable
- `504`: Gateway Timeout - Request timeout

## Error Context Information

The error handler captures and logs additional context information:

```javascript
error.request = {
  url: req.originalUrl,
  method: req.method,
  ip: req.ip || req.connection.remoteAddress,
  userAgent: req.get('User-Agent'),
  userId: req.user ? req.user.id : null
};
```

## Logging Implementation

### Structured Logging
The system uses a structured logging utility in `src/utils/logger.js`:

```javascript
module.exports = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta)
};
```

### Error Logging
```javascript
logger.error("API Error", {
  message: err.message,
  statusCode: err.statusCode,
  isOperational: err.isOperational,
  stack: err.stack,
  name: err.name
});
```

## Process Event Handling

### Unhandled Rejection
```javascript
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection! Shutting down...', { 
    error: err.message, 
    stack: err.stack 
  });
  server.close(() => {
    process.exit(1);
  });
});
```

### Uncaught Exception
```javascript
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception! Shutting down...', { 
    error: err.message, 
    stack: err.stack 
  });
  process.exit(1);
});
```

### Graceful Shutdown
```javascript
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});
```

## Development vs Production Error Handling

### Development Mode
- Detailed error responses with stack traces
- Full error object information
- Console logging with detailed information

### Production Mode
- Generic error messages to prevent information leakage
- Operational errors return user-friendly messages
- Programming errors return generic "Something went wrong" message
- Comprehensive logging for monitoring

## Error Handling Best Practices

### 1. Operational vs Programming Errors
- Operational errors are expected and can be sent to clients
- Programming errors are unexpected and should not leak internal details

### 2. Error Propagation
- Use `next(error)` to propagate errors to middleware
- Don't catch and ignore errors
- Handle errors at appropriate levels

### 3. Security Considerations
- Don't expose internal system details to clients
- Use generic error messages for programming errors
- Log detailed information for debugging

### 4. User Experience
- Provide clear, helpful error messages
- Use consistent error response format
- Include relevant error codes when appropriate

### 5. Monitoring and Logging
- Log all errors for monitoring and debugging
- Include request context for better debugging
- Use structured logging for better analysis

## Common Error Scenarios and Solutions

### 1. Validation Errors
**Scenario**: User provides invalid data
**Solution**: Return 400 with validation error details

### 2. Authentication Errors
**Scenario**: Invalid or expired token
**Solution**: Return 401 with appropriate message

### 3. Authorization Errors
**Scenario**: User lacks permission
**Solution**: Return 403 with access denied message

### 4. Database Errors
**Scenario**: Unique constraint violation
**Solution**: Return 409 with conflict details

### 5. Resource Not Found
**Scenario**: Requested resource doesn't exist
**Solution**: Return 404 with not found message

## Testing Error Scenarios

### Unit Tests
- Test validation error scenarios
- Test authentication/authorization flows
- Test database constraint violations
- Test business logic errors

### Integration Tests
- Test error responses from API endpoints
- Test error propagation through middleware
- Test logging and monitoring integration

This comprehensive error handling system ensures the College ERP application is robust, secure, and provides a good user experience while maintaining proper logging and monitoring for system health.