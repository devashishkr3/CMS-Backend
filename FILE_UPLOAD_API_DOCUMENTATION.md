# FILE UPLOAD API DOCUMENTATION

## Overview
This document outlines the API endpoints for handling file uploads in the CMS Backend system.

## Authentication
All endpoints require authentication. Ensure to include a valid token in the request header.

## Endpoints

### 1. Upload File
- **POST /api/files/upload**  
  - **Description**: Uploads a file to the server.
  - **Request Format**:  
    - **Headers**:
      - `Authorization: Bearer <token>`  
    - **Body**: 
      - Form-data with the following fields:  
        - `file` (file): The file to upload.

  - **Response Format**:  
    - **Success (201)**:
      ```json
      {
        "success": true,
        "data": {
          "fileId": "12345",
          "fileName": "example.png",
          "url": "https://example.com/files/example.png"
        }
      }
      ```
    - **Error (400)**:
      ```json
      {
        "success": false,
        "error": "Invalid file format."
      }
      ```

### 2. Get File
- **GET /api/files/{fileId}**  
  - **Description**: Retrieves a file's details by its ID.
  - **Request Format**:  
    - **Headers**:
      - `Authorization: Bearer <token>`  

  - **Response Format**:  
    - **Success (200)**:
      ```json
      {
        "success": true,
        "data": {
          "fileId": "12345",
          "fileName": "example.png",
          "url": "https://example.com/files/example.png"
        }
      }
      ```
    - **Error (404)**:
      ```json
      {
        "success": false,
        "error": "File not found."
      }
      ```

### 3. Delete File
- **DELETE /api/files/{fileId}**  
  - **Description**: Deletes a file by its ID.
  - **Request Format**:  
    - **Headers**:
      - `Authorization: Bearer <token>`  

  - **Response Format**:  
    - **Success (204)**: No content
    - **Error (404)**: 
      ```json
      {
        "success": false,
        "error": "File not found."
      }
      ```

## Error Handling
1. **400 Bad Request**:
   - The request was malformed or contained invalid data.
2. **401 Unauthorized**:
   - Authentication failed or token is missing.
3. **404 Not Found**:
   - Requested resource was not found.
4. **500 Internal Server Error**:
   - An unexpected error occurred at the server.

## Examples
### Uploading a File
```bash
curl -X POST https://api.example.com/api/files/upload \
-H "Authorization: Bearer YOUR_TOKEN" \
-F "file=@/path/to/file/example.png"
```
### Retrieving a File
```bash
curl -X GET https://api.example.com/api/files/12345 \
-H "Authorization: Bearer YOUR_TOKEN"
```
### Deleting a File
```bash
curl -X DELETE https://api.example.com/api/files/12345 \
-H "Authorization: Bearer YOUR_TOKEN"
```
