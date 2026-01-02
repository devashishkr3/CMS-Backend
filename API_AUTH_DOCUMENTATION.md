# Authentication API Documentation

## Overview
This document describes the authentication endpoints for the CMS Backend. The system uses JWT tokens with both access tokens (15 minutes expiry) and refresh tokens (7 days expiry).

## Endpoints

### 1. Register User
**POST** `/api/v1/auth/register`

#### Request Body
```json
{
  "name": "string (required, 2-50 characters)",
  "email": "string (required, valid email format)",
  "password": "string (required, minimum 6 characters)",
  "phone": "string (optional, exactly 10 digits)",
  "role": "string (optional, one of: ADMIN, HOD, ACCOUNTANT - defaults to ADMIN)"
}
```

#### Response
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "role": "string",
      "phone": "string or null",
      "isActive": "boolean",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    },
    "accessToken": "JWT token (15 min expiry)",
    "refreshToken": "JWT token (7 days expiry)"
  }
}
```

### 2. Login User
**POST** `/api/v1/auth/login`

#### Request Body
```json
{
  "email": "string (required, valid email format)",
  "password": "string (required)"
}
```

#### Response
```json
{
  "status": "success",
  "message": "Logged in successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "role": "string",
      "phone": "string or null",
      "isActive": "boolean"
    },
    "accessToken": "JWT token (15 min expiry)",
    "refreshToken": "JWT token (7 days expiry)"
  }
}
```

### 3. Refresh Token
**POST** `/api/v1/auth/refresh-token`

#### Request Body
```json
{
  "refreshToken": "string (required, valid refresh token)"
}
```

#### Response
```json
{
  "status": "success",
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "JWT token (15 min expiry)",
    "refreshToken": "JWT token (7 days expiry)"
  }
}
```

### 4. Logout User
**POST** `/api/v1/auth/logout`

#### Request Body
```json
{
  "refreshToken": "string (required, valid refresh token)"
}
```

#### Response
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

## Error Responses
All endpoints may return the following error responses:

### Validation Errors (400)
```json
{
  "status": "fail",
  "message": "Error message describing the validation issue"
}
```

### Authentication Errors (401)
```json
{
  "status": "error",
  "message": "Error message describing the authentication issue"
}
```

### Authorization Errors (403)
```json
{
  "status": "error",
  "message": "You do not have permission to perform this action"
}
```

### Server Errors (500)
```json
{
  "status": "error",
  "message": "Something went wrong!"
}
```

## Token Usage
- Access tokens should be sent in the `Authorization` header as `Bearer <token>`
- Refresh tokens should be stored securely (e.g., HttpOnly cookies) and used only for refreshing tokens
- Both tokens are blacklisted upon logout to prevent reuse