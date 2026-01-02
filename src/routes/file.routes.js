const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { uploadSingleFile, handleFileUploadErrors } = require('../middlewares/fileUpload');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { uploadFile, verifyDocument } = require("../validation/file.validation");

// Import controllers
const {
  uploadFile: uploadFileController,
  getStudentDocuments,
  verifyDocument: verifyDocumentController,
  getFileDownloadUrl,
  deleteFile
} = require('../controllers/file.controller');

// All routes below this middleware require authentication
router.use(protect);

// File Management Routes
router.post(
  '/', 
  restrictTo('ADMIN', 'HOD', 'STUDENT'), 
  uploadSingleFile, 
  handleFileUploadErrors,
  joiValidator(uploadFile, "body"), 
  uploadFileController
);

router.get(
  '/students/:studentId/documents', 
  restrictTo('ADMIN', 'HOD', 'STUDENT'), 
  getStudentDocuments
);

router.patch(
  '/documents/:id/verify', 
  restrictTo('ADMIN', 'HOD'), 
  joiValidator(verifyDocument, "body"), 
  verifyDocumentController
);

router.get(
  '/:id/:fileType/download', 
  restrictTo('ADMIN', 'HOD', 'STUDENT'), 
  getFileDownloadUrl
);

router.delete(
  '/:id/:fileType', 
  restrictTo('ADMIN'), 
  deleteFile
);

module.exports = router;