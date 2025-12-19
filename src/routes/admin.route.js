const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Import controllers
const {
  createUser,
  getAllUsers,
  updateUserStatus,
  createAdmissionWindow,
  updateAdmissionWindowStatus,
  getAdmissions,
  updateAdmissionStatus
} = require('../controllers/admin.controller');

// All routes below this middleware require authentication
router.use(protect);

// User Management Routes
router.post('/users', restrictTo('ADMIN'), createUser);
router.get('/users', restrictTo('ADMIN', 'HOD'), getAllUsers);
router.patch('/users/:id/status', restrictTo('ADMIN'), updateUserStatus);

// Admission Window Routes
router.post('/admission-windows', restrictTo('ADMIN'), createAdmissionWindow);
router.patch('/admission-windows/:id', restrictTo('ADMIN'), updateAdmissionWindowStatus);

// Admission Management Routes
router.get('/admissions', restrictTo('ADMIN', 'HOD'), getAdmissions);
router.patch('/admissions/:id/status', restrictTo('ADMIN'), updateAdmissionStatus);

module.exports = router;