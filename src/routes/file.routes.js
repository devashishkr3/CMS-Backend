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
  deleteFile,
  getPresignedUploadUrl
} = require('../controllers/file.controller');

// All routes below this middleware require authentication


// File Management Routes
router.post(
  '/', 
  // restrictTo('ADMIN'), 
  uploadSingleFile, 
  handleFileUploadErrors,
  joiValidator(uploadFile, "body"), 
  uploadFileController
);



router.get(
  '/students/:studentId/documents', 
  // restrictTo('ADMIN'), 
  getStudentDocuments
);

router.use(protect);

router.patch(
  '/documents/:id/verify', 
  restrictTo('ADMIN'), 
  joiValidator(verifyDocument, "body"), 
  verifyDocumentController
);

router.get(
  '/:id/:fileType/download', 
  restrictTo('ADMIN'), 
  getFileDownloadUrl
);

router.delete(
  '/:id/:fileType', 
  restrictTo('ADMIN'), 
  deleteFile
);

router.post(
  "/presign-upload",
  protect,
  restrictTo("ADMIN"),
  getPresignedUploadUrl
);

module.exports = router;

// exports.saveFileMetadata = async (req, res) => {
//   const { fileType, studentId, documentType, fileUrl } = req.body;

//   if (fileType === "photo") {
//     await prisma.student.update({
//       where: { id: studentId },
//       data: { photoUrl: fileUrl }
//     });
//   }

//   if (fileType === "document") {
//     await prisma.studentDocument.create({
//       data: {
//         studentId,
//         type: documentType,
//         fileUrl
//       }
//     });
//   }

//   res.json({ status: "success" });
// };
