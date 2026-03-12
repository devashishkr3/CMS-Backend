const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");
const upload = require('../middlewares/fileUpload'); // Add file upload middleware

// Import validation schemas
const { createStudent, updateStudent, assignSemester,getStudentByUniversityRollSchema, verifyStudentSchema, bulkCreateStudents } = require("../validation/student.validation");

// Import controllers
const {
  createStudent: createStudentController,
  getAllStudents,
  getStudent,
  updateStudent: updateStudentController,
  deleteStudent,
  assignSemester: assignSemesterController,
  updateStudentSemesterStatus,
  verifyStudentForAdmission,
  getStudentByUniversityRoll,
  clearAllStudentPaymentStatuses,
  bulkCreateStudents: bulkCreateStudentsController,
  bulkUploadStudentsFromExcel,
  bulkUpdateStudents
} = require('../controllers/student.controller');

const {
  studentGeneratePaymentLink
} = require('../controllers/payment.controller');

router.post("/verify-student",joiValidator(verifyStudentSchema, "body"), verifyStudentForAdmission);

router.post(
  "/verify-student-by-university-roll",
  joiValidator(getStudentByUniversityRollSchema, "body"),
  getStudentByUniversityRoll
);

// All routes below this middleware require authentication
router.use(protect);

// Student Payment Routes
router.post('/:id/payments/:paymentId/generate-link', studentGeneratePaymentLink);

// Student Management Routes
router.post('/', restrictTo('ADMIN', 'HOD'), joiValidator(createStudent, "body"), createStudentController);
router.get('/', restrictTo('ADMIN', 'HOD'), getAllStudents);
router.post('/payments/clear-status', restrictTo('ADMIN', 'HOD'), clearAllStudentPaymentStatuses);
router.get('/:id', restrictTo('ADMIN', 'HOD'), getStudent);
router.patch('/:id', restrictTo('ADMIN', 'HOD'), joiValidator(updateStudent, "body"), updateStudentController);
router.delete('/:id', restrictTo('ADMIN'), deleteStudent);

// Semester Assignment Routes
router.post('/:id/semesters', restrictTo('ADMIN', 'HOD'), joiValidator(assignSemester, "body"), assignSemesterController);
router.patch('/:studentId/semesters/:semesterId', restrictTo('ADMIN', 'HOD'), updateStudentSemesterStatus);

// Bulk Operations Routes
router.post('/bulk/create', restrictTo('ADMIN', 'HOD'), joiValidator(bulkCreateStudents, "body"), bulkCreateStudentsController);
router.post('/bulk/upload-excel', restrictTo('ADMIN', 'HOD'), upload.single('file'), bulkUploadStudentsFromExcel);
router.patch('/bulk/update', restrictTo('ADMIN', 'HOD'), bulkUpdateStudents);

module.exports = router;
