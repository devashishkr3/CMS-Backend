const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { 
  createStudentSubject, 
  filterStudentSubjects 
} = require("../validation/studentSubject.validation");

// Import controllers
const {
  createStudentSubject: createStudentSubjectController,
  getAllStudentSubjects,
  getStudentSubject,
  deleteStudentSubject,
  getStudentSubjectsForSemester,
  bulkAssignSubjects
} = require('../controllers/studentSubject.controller');

// All routes below this middleware require authentication
router.use(protect, restrictTo('ADMIN', 'HOD'));

// Student Subject Management Routes
router.post('/', 
  joiValidator(createStudentSubject, "body"), 
  createStudentSubjectController
);

router.get('/', 
  getAllStudentSubjects
);

router.get('/student/:studentId/semester/:semesterId', 
  getStudentSubjectsForSemester
);

router.get('/:id', 
  getStudentSubject
);

router.delete('/:id', 
  deleteStudentSubject
);

router.post('/bulk', 
  bulkAssignSubjects
);

module.exports = router;