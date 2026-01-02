const multer = require('multer');
const AppError = require('../utils/error');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to allow only specific file types
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX files are allowed.', 400), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Single file upload middleware
exports.uploadSingleFile = upload.single('file');

// Multiple files upload middleware
exports.uploadMultipleFiles = upload.array('files', 5); // Max 5 files

// Handle file upload errors
exports.handleFileUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File size too large. Maximum file size is 5MB.', 400));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError('Too many files uploaded. Maximum 5 files allowed.', 400));
    }
    return next(new AppError(`Multer error: ${err.message}`, 400));
  }
  
  if (err) {
    return next(new AppError(err.message, 400));
  }
  
  next();
};