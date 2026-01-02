const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { createCourse, updateCourse } = require("../validation/course.validation");

// Import controllers
const {
  createCourse: createCourseController,
  getAllCourses,
  getCourse,
  updateCourse: updateCourseController,
  deleteCourse,
  createSemesters
} = require('../controllers/course.controller');

// All routes below this middleware require authentication
router.use(protect);

// Course Management Routes
router.post('/', restrictTo('ADMIN'), joiValidator(createCourse, "body"), createCourseController);
router.get('/', restrictTo('ADMIN', 'HOD'), getAllCourses);
router.get('/:id', restrictTo('ADMIN', 'HOD'), getCourse);
router.patch('/:id', restrictTo('ADMIN'), joiValidator(updateCourse, "body"), updateCourseController);
router.delete('/:id', restrictTo('ADMIN'), deleteCourse);

// Semester Creation Route
router.post('/semesters/:id', restrictTo('ADMIN'), createSemesters);

module.exports = router;