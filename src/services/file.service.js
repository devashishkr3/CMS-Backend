const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { r2Client, R2_BUCKET_NAME } = require('../config/cloudflareR2');
const prisma = require('../config/prisma');
const AppError = require('../utils/error');

/**
 * Generate signed URL for file download
 * @param {string} fileName - File name in R2
 * @param {number} expiresIn - Expiration time in seconds (default: 3600)
 * @returns {Promise<string>} - Signed URL
 */
exports.generateSignedUrl = async (fileName, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName
    });
    
    return await getSignedUrl(r2Client, command, { expiresIn });
  } catch (error) {
    throw new AppError('Failed to generate signed URL', 500);
  }
};

/**
 * Delete file from Cloudflare R2
 * @param {string} fileName - File name in R2
 * @returns {Promise<void>}
 */
exports.deleteFileFromR2 = async (fileName) => {
  try {
    const deleteParams = {
      Bucket: R2_BUCKET_NAME,
      Key: fileName
    };
    
    await r2Client.send(new DeleteObjectCommand(deleteParams));
  } catch (error) {
    throw new AppError('Failed to delete file from Cloudflare R2', 500);
  }
};

/**
 * Save file metadata to database
 * @param {Object} fileData - File metadata
 * @returns {Promise<Object>} - Created file record
 */
exports.saveFileMetadata = async (fileData) => {
  try {
    // For student photos
    if (fileData.fileType === 'photo' && fileData.studentId) {
      // Update student photo URL
      const student = await prisma.student.update({
        where: { id: fileData.studentId },
        data: { photoUrl: fileData.fileUrl }
      });
      
      return { type: 'student_photo', student };
    }
    
    // For student documents
    if (fileData.fileType === 'document' && fileData.studentId) {
      const document = await prisma.studentDocument.create({
        data: {
          studentId: fileData.studentId,
          type: fileData.documentType,
          fileUrl: fileData.fileUrl,
          verified: false
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              reg_no: true
            }
          }
        }
      });
      
      return { type: 'student_document', document };
    }
    
    // For certificates
    if (fileData.fileType === 'certificate' && fileData.certificateId) {
      const certificate = await prisma.certificateRequest.update({
        where: { id: fileData.certificateId },
        data: { pdfUrl: fileData.fileUrl }
      });
      
      return { type: 'certificate', certificate };
    }
    
    throw new AppError('Invalid file data', 400);
  } catch (error) {
    throw new AppError('Failed to save file metadata', 500);
  }
};

/**
 * Get file metadata from database
 * @param {string} fileId - File ID
 * @param {string} fileType - Type of file
 * @returns {Promise<Object>} - File metadata
 */
exports.getFileMetadata = async (fileId, fileType) => {
  try {
    if (fileType === 'document') {
      return await prisma.studentDocument.findUnique({
        where: { id: fileId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              reg_no: true
            }
          }
        }
      });
    }
    
    throw new AppError('Unsupported file type', 400);
  } catch (error) {
    throw new AppError('Failed to get file metadata', 500);
  }
};

/**
 * Verify student document
 * @param {string} documentId - Document ID
 * @param {boolean} verified - Verification status
 * @param {string} notes - Verification notes
 * @returns {Promise<Object>} - Updated document
 */
exports.verifyDocument = async (documentId, verified, notes = null) => {
  try {
    const document = await prisma.studentDocument.update({
      where: { id: documentId },
      data: { 
        verified,
        ...(notes && { verificationNotes: notes })
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true
          }
        }
      }
    });
    
    return document;
  } catch (error) {
    throw new AppError('Failed to verify document', 500);
  }
};

/**
 * Get student documents
 * @param {string} studentId - Student ID
 * @returns {Promise<Array>} - Student documents
 */
exports.getStudentDocuments = async (studentId) => {
  try {
    return await prisma.studentDocument.findMany({
      where: { studentId },
      orderBy: {
        createdAt: 'desc'
      }
    });
  } catch (error) {
    throw new AppError('Failed to get student documents', 500);
  }
};

/**
 * Delete file metadata from database
 * @param {string} fileId - File ID
 * @param {string} fileType - Type of file
 * @returns {Promise<void>}
 */
exports.deleteFileMetadata = async (fileId, fileType) => {
  try {
    if (fileType === 'document') {
      await prisma.studentDocument.delete({
        where: { id: fileId }
      });
    } else {
      throw new AppError('Unsupported file type', 400);
    }
  } catch (error) {
    throw new AppError('Failed to delete file metadata', 500);
  }
};

/**
 * Get MIME type based on file extension
 * @param {string} fileName - File name
 * @returns {string} - MIME type
 */
const getFileMimeType = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
};

exports.generatePresignedUploadUrl = async ({
  folder,
  fileName,
  mimeType
}) => {
  const key = `${folder}/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: mimeType
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: 300 // 5 min
  });

  return {
    uploadUrl,
    // fileUrl: `https://${R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`,
    fileUrl: `https://pub-69a6c36781b24ffe8e63b7f06a832a60.r2.dev/${key}`,
    key
  };
};
