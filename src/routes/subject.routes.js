const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { createSubject, updateSubject } = require("../validation/subject.validation");

// Import controllers
const {
  createSubject: createSubjectController,
  getAllSubjects,
  getSubject,
  updateSubject: updateSubjectController,
  deleteSubject
} = require('../controllers/subject.controller');

// All routes below this middleware require authentication
router.use(protect);

// Subject Management Routes
router.post('/', restrictTo('ADMIN'), joiValidator(createSubject, "body"), createSubjectController);
router.get('/', restrictTo('ADMIN', 'HOD'), getAllSubjects);
router.get('/:id', restrictTo('ADMIN', 'HOD'), getSubject);
router.patch('/:id', restrictTo('ADMIN'), joiValidator(updateSubject, "body"), updateSubjectController);
router.delete('/:id', restrictTo('ADMIN'), deleteSubject);

module.exports = router;