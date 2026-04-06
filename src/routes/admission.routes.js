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
  getAdmissionFeePreview,
  getAllAdmissions,
  getAdmission,
  updateAdmissionStatus: updateAdmissionStatusController,
  createAdmissionWindow: createAdmissionWindowController,
  getAllAdmissionWindows,
  getAdmissionWindow,
  updateAdmissionWindow: updateAdmissionWindowController,
  deleteAdmissionWindow
} = require('../controllers/admission.controller');

//Public route for getting admission windows
router.get('/windows', getAllAdmissionWindows);
router.get('/fee-preview', getAdmissionFeePreview);

// All routes below this middleware require authentication
router.use(protect);

// Admission Window Routes
router.post('/windows', restrictTo('ADMIN'), joiValidator(createAdmissionWindow, "body"), createAdmissionWindowController);

router.get('/windows/:id', restrictTo('ADMIN'), getAdmissionWindow);
router.patch('/windows/:id', restrictTo('ADMIN'), joiValidator(updateAdmissionWindow, "body"), updateAdmissionWindowController);
router.delete('/windows/:id', restrictTo('ADMIN'), deleteAdmissionWindow);

// Admission Management Routes
router.post('/', restrictTo('ADMIN'), joiValidator(createAdmission, "body"), createAdmissionController);
router.get('/', restrictTo('ADMIN'), getAllAdmissions);
router.get('/:id', restrictTo('ADMIN'), getAdmission);
router.patch('/:id/status', restrictTo('ADMIN'), joiValidator(updateAdmissionStatus, "body"), updateAdmissionStatusController);


module.exports = router;
