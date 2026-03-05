# File Management System

## Overview
This document provides a comprehensive guide to the file management system implemented in the CMS-Backend project. This system facilitates file uploads to Cloudflare R2, handling presigned URLs for secure access, and provides methods for file management including downloads, deletions, and verification.

## API Documentation

### 1. Upload File to Cloudflare R2
**Endpoint:** `/api/files/upload`

**Method:** `POST`

**Request Body:**
```json
{
  "fileName": "<string>", // Name of the file to be uploaded
  "fileData": "<base64_encoded_string>" // Base64 encoded file data
}
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "fileUrl": "<file_url>"
}
```

### 2. Get Presigned URL
**Endpoint:** `/api/files/presigned-url`

**Method:** `GET`

**Query Parameters:**
- `fileName`: The name of the file for which the presigned URL is requested.

**Response:**
```json
{
  "success": true,
  "presignedUrl": "<presigned_url>"
}
```

### 3. Download File
**Endpoint:** `/api/files/download`

**Method:** `GET`

**Query Parameters:**
- `fileName`: The name of the file to be downloaded.

**Response:**
```json
{
  "success": true,
  "fileData": "<base64_encoded_string>",
  "fileName": "<file_name>"
}
```

### 4. Delete File
**Endpoint:** `/api/files/delete`

**Method:** `DELETE`

**Request Body:**
```json
{
  "fileName": "<string>"
}
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully."
}
```

### 5. Verify File
**Endpoint:** `/api/files/verify`

**Method:** `POST`

**Request Body:**
```json
{
  "fileName": "<string>",
  "fileHash": "<string>"  // Hash to verify the file integrity
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "message": "File is verified."
}
```

## Complete Integration Steps
1. **Set up Cloudflare R2**:
   - Create an R2 bucket in your Cloudflare dashboard.
   - Obtain the Access Key and Secret Key.

2. **Configure environment variables**:
   - Set the following environment variables:
     - `CLOUDFLARE_ACCESS_KEY`
     - `CLOUDFLARE_SECRET_KEY`
     - `CLOUDFLARE_BUCKET_NAME`

3. **Install dependencies**:
   - Use npm or yarn to install necessary packages for file handling and API

4. **Use the API endpoints**:
   - Implement calls to the provided API endpoints within your application, following the prescribed formats.

## Conclusion
This README provides an in-depth look into the file management functionalities integrated with Cloudflare R2. For additional support or feature requests, please raise an issue in the repository.