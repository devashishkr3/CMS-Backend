const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Import controllers
const {
  getDashboardStats,
  getLast10Admissions,
  getMonthlyAdmissions,
  getStudentCountsByStatus
} = require('../controllers/adminDashboard.controller');

// All routes below this middleware require authentication
router.use(protect, restrictTo('ADMIN'));

// Admin Dashboard Routes
router.get('/stats', getDashboardStats);
router.get('/admissions/last-10', getLast10Admissions);
router.get('/admissions/monthly', getMonthlyAdmissions);
router.get('/students/status-counts', getStudentCountsByStatus);

module.exports = router;