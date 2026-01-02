const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { createStudent, updateStudent, assignSemester } = require("../validation/student.validation");

// Import controllers
const {
  createStudent: createStudentController,
  getAllStudents,
  getStudent,
  updateStudent: updateStudentController,
  deleteStudent,
  assignSemester: assignSemesterController,
  updateStudentSemesterStatus
} = require('../controllers/student.controller');

// All routes below this middleware require authentication
router.use(protect);

// Student Management Routes
router.post('/', restrictTo('ADMIN', 'HOD'), joiValidator(createStudent, "body"), createStudentController);
router.get('/', restrictTo('ADMIN', 'HOD'), getAllStudents);
router.get('/:id', restrictTo('ADMIN', 'HOD'), getStudent);
router.patch('/:id', restrictTo('ADMIN', 'HOD'), joiValidator(updateStudent, "body"), updateStudentController);
router.delete('/:id', restrictTo('ADMIN'), deleteStudent);

// Semester Assignment Routes
router.post('/:id/semesters', restrictTo('ADMIN', 'HOD'), joiValidator(assignSemester, "body"), assignSemesterController);
router.patch('/:studentId/semesters/:semesterId', restrictTo('ADMIN', 'HOD'), updateStudentSemesterStatus);

module.exports = router;