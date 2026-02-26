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
  getPaymentStats,
  paymentCallback,
  generatePaymentLink,
  paymentReturn
} = require('../controllers/payment.controller');


// Payment Management Routes
router.post("/return", paymentReturn);
router.post("/callback", paymentCallback);

// All routes below this middleware require authentication
router.use(protect);

router.post("/:paymentId/generate-link", protect, generatePaymentLink);

router.post('/', restrictTo('ADMIN'), joiValidator(createPayment, "body"), createPaymentController);
router.get('/', restrictTo('ADMIN'), getAllPayments);
router.get('/stats', restrictTo('ADMIN'), getPaymentStats);
router.get('/:id', restrictTo('ADMIN'), getPayment);
router.patch('/:id/status', restrictTo('ADMIN'), joiValidator(updatePaymentStatus, "body"), updatePaymentStatusController);
router.post('/:id/refund', restrictTo('ADMIN'), joiValidator(refundPayment, "body"), refundPaymentController);

module.exports = router;