const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { 
  createPayment, 
  updatePaymentStatus, 
  refundPayment 
} = require("../validation/payment.validation");

// Import controllers
const {
  createPayment: createPaymentController,
  getAllPayments,
  getPayment,
  updatePaymentStatus: updatePaymentStatusController,
  refundPayment: refundPaymentController,
  getPaymentStats
} = require('../controllers/payment.controller');

// All routes below this middleware require authentication
router.use(protect);

// Payment Management Routes
router.post('/', restrictTo('ADMIN', 'ACCOUNTANT'), joiValidator(createPayment, "body"), createPaymentController);
router.get('/', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getAllPayments);
router.get('/stats', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getPaymentStats);
router.get('/:id', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getPayment);
router.patch('/:id/status', restrictTo('ADMIN', 'ACCOUNTANT'), joiValidator(updatePaymentStatus, "body"), updatePaymentStatusController);
router.post('/:id/refund', restrictTo('ADMIN', 'ACCOUNTANT'), joiValidator(refundPayment, "body"), refundPaymentController);

module.exports = router;