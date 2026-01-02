const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { 
  createSession, 
  updateSession 
} = require("../validation/session.validation");

// Import controllers
const {
  createSession: createSessionController,
  getAllSessions,
  getSession,
  updateSession: updateSessionController,
  deleteSession,
  getSessionsByCourse,
  associateSessionWithCourse,
  removeSessionCourseAssociation,
  getSessionsForCourse,
  getCoursesForSession
} = require('../controllers/session.controller');

// All routes below this middleware require authentication
router.use(protect);

// Session Management Routes
router.post('/', restrictTo('ADMIN','HOD'), joiValidator(createSession, "body"), createSessionController);
router.get('/', getAllSessions);
router.get('/:id', getSession);
router.patch('/:id', restrictTo('ADMIN','HOD'), joiValidator(updateSession, "body"), updateSessionController);
router.delete('/:id', restrictTo('ADMIN','HOD'), deleteSession);

// Course-specific routes
router.get('/course/:courseId', restrictTo('ADMIN', 'HOD'), getSessionsByCourse);

// Session-Course association routes
router.post('/associate', restrictTo('ADMIN', 'HOD'), associateSessionWithCourse);
router.delete('/associate/:sessionId/:courseId', restrictTo('ADMIN', 'HOD'), removeSessionCourseAssociation);
router.get('/course/:courseId/sessions', restrictTo('ADMIN', 'HOD'), getSessionsForCourse);
router.get('/session/:sessionId/courses', restrictTo('ADMIN', 'HOD'), getCoursesForSession);

module.exports = router;