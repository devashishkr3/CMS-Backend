const AppError = require('../utils/error');
const { 
  uploadFile, 
  verifyDocument 
} = require('../validation/file.validation');
const fileService = require('../services/file.service');

/**
 * Upload file to Cloudflare R2
 * Access: ADMIN, HOD, STUDENT (own files)
 */
exports.uploadFile = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = uploadFile.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { fileType, documentType, studentId } = value;

    // Check if file is provided
    if (!req.file) {
      return next(new AppError('File is required', 400));
    }

    // For STUDENT role, only allow uploading own files
    if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
      return next(new AppError('You can only upload files for yourself', 403));
    }

    // Check if student exists (if studentId is provided)
    if (studentId) {
      const student = await prisma.student.findUnique({
        where: { id: studentId }
      });

      if (!student) {
        return next(new AppError('Student not found', 404));
      }
    }

    // Upload file to Cloudflare R2
    const folder = fileType === 'photo' ? 'photos' : 
                  fileType === 'document' ? 'documents' : 
                  'certificates';
                  
    const fileUrl = await fileService.uploadFileToR2(
      req.file.buffer, 
      req.file.originalname, 
      folder
    );

    // Save file metadata
    const fileData = {
      fileType,
      fileUrl,
      studentId: studentId || null,
      documentType: documentType || null
    };

    const savedFile = await fileService.saveFileMetadata(fileData);

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPLOAD_FILE',
        entity: 'File',
        entityId: savedFile.type === 'student_document' ? savedFile.document.id : 
                 savedFile.type === 'student_photo' ? savedFile.student.id : 
                 'unknown',
        payload: JSON.stringify({ 
          fileType, 
          fileName: req.file.originalname,
          fileSize: req.file.size,
          studentId 
        })
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'File uploaded successfully',
      data: {
        file: savedFile
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student documents
 * Access: ADMIN, HOD, STUDENT (own documents)
 */
exports.getStudentDocuments = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // For STUDENT role, only allow accessing own documents
    if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
      return next(new AppError('You can only access your own documents', 403));
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Get student documents
    const documents = await fileService.getStudentDocuments(studentId);

    res.status(200).json({
      status: 'success',
      results: documents.length,
      data: {
        documents
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify student document
 * Access: ADMIN, HOD
 */
exports.verifyDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = verifyDocument.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { verified, notes } = value;

    // Verify document
    const document = await fileService.verifyDocument(id, verified, notes);

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'VERIFY_DOCUMENT',
        entity: 'StudentDocument',
        entityId: id,
        payload: JSON.stringify({ verified, notes })
      }
    });

    res.status(200).json({
      status: 'success',
      message: `Document ${verified ? 'verified' : 'rejected'} successfully`,
      data: {
        document
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get file download URL
 * Access: ADMIN, HOD, STUDENT (own files)
 */
exports.getFileDownloadUrl = async (req, res, next) => {
  try {
    const { id, fileType } = req.params;

    // Get file metadata
    const fileMetadata = await fileService.getFileMetadata(id, fileType);

    if (!fileMetadata) {
      return next(new AppError('File not found', 404));
    }

    // For STUDENT role, only allow accessing own files
    if (req.user.role === 'STUDENT' && fileMetadata.studentId !== req.user.id) {
      return next(new AppError('You can only access your own files', 403));
    }

    // Extract file key from URL
    const fileUrl = fileMetadata.fileUrl;
    const urlParts = fileUrl.split('/');
    const fileKey = urlParts.slice(3).join('/'); // Remove protocol and domain

    // Generate signed URL for download
    const downloadUrl = await fileService.generateSignedUrl(fileKey, 3600); // 1 hour expiry

    res.status(200).json({
      status: 'success',
      data: {
        downloadUrl,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete file
 * Access: ADMIN
 */
exports.deleteFile = async (req, res, next) => {
  try {
    const { id, fileType } = req.params;

    // Get file metadata
    const fileMetadata = await fileService.getFileMetadata(id, fileType);

    if (!fileMetadata) {
      return next(new AppError('File not found', 404));
    }

    // Extract file key from URL
    const fileUrl = fileMetadata.fileUrl;
    const urlParts = fileUrl.split('/');
    const fileKey = urlParts.slice(3).join('/'); // Remove protocol and domain

    // Delete file from Cloudflare R2
    await fileService.deleteFileFromR2(fileKey);

    // Delete file metadata from database
    await fileService.deleteFileMetadata(id, fileType);

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_FILE',
        entity: 'File',
        entityId: id,
        payload: JSON.stringify({ fileType, fileName: fileKey })
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'File deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};