const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Import controllers
const {
  getAllSemesters,
  getSemester,
  autoAssignStudents,
  promoteStudents,
  bulkUpdateStudentSemesterStatus
} = require('../controllers/semester.controller');

// All routes below this middleware require authentication
router.use(protect);

// Semester Management Routes
router.get('/', restrictTo('ADMIN', 'HOD'), getAllSemesters);
router.get('/:id', restrictTo('ADMIN', 'HOD'), getSemester);
router.post('/:id/auto-assign', restrictTo('ADMIN', 'HOD'), autoAssignStudents);
router.post('/:id/promote', restrictTo('ADMIN', 'HOD'), promoteStudents);
router.patch('/:id/bulk-update', restrictTo('ADMIN', 'HOD'), bulkUpdateStudentSemesterStatus);

module.exports = router;