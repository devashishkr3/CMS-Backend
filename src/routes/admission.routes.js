const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { 
  createAdmission, 
  updateAdmissionStatus, 
  createAdmissionWindow,
  updateAdmissionWindow
} = require("../validation/admission.validation");

// Import controllers
const {
  createAdmission: createAdmissionController,
  getAllAdmissions,
  getAdmission,
  updateAdmissionStatus: updateAdmissionStatusController,
  createAdmissionWindow: createAdmissionWindowController,
  getAllAdmissionWindows,
  getAdmissionWindow,
  updateAdmissionWindow: updateAdmissionWindowController,
  deleteAdmissionWindow
} = require('../controllers/admission.controller');

// All routes below this middleware require authentication
router.use(protect);
// router.use(restrictTo('ADMIN', 'HOD'))

// Admission Management Routes
router.post('/', restrictTo('ADMIN', 'HOD'), joiValidator(createAdmission, "body"), createAdmissionController);
router.get('/', restrictTo('ADMIN', 'HOD'), getAllAdmissions);
router.get('/:id', restrictTo('ADMIN', 'HOD'), getAdmission);
router.patch('/:id/status', restrictTo('ADMIN', 'HOD'), joiValidator(updateAdmissionStatus, "body"), updateAdmissionStatusController);

// Admission Window Routes
router.post('/windows', restrictTo('ADMIN'), joiValidator(createAdmissionWindow, "body"), createAdmissionWindowController);
router.get('/windows', restrictTo('ADMIN', 'HOD'), getAllAdmissionWindows);
router.get('/windows/:id', restrictTo('ADMIN', 'HOD'), getAdmissionWindow);
router.patch('/windows/:id', restrictTo('ADMIN'), joiValidator(updateAdmissionWindow, "body"), updateAdmissionWindowController);
router.delete('/windows/:id', restrictTo('ADMIN'), deleteAdmissionWindow);

module.exports = router;