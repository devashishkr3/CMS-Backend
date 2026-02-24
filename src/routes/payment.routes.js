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
  paymentReturn,
  studentGeneratePaymentLink
} = require('../controllers/payment.controller');

// ========== PUBLIC ROUTES (No Auth Required) ==========
// These endpoints are called by GetEpay gateway
// IMPORTANT: Put specific routes BEFORE generic /:id routes
router.post("/callback", paymentCallback);
router.get("/return", paymentReturn);
router.post("/return", paymentReturn); // GetEpay might send POST

// TEST ENDPOINT: Manually test callback (for debugging only)
// Usage: POST to /callback-test with encrypted response from GetEpay
router.post('/callback-test', (req, res, next) => {
  console.log('🧪 [TEST CALLBACK] Received test callback');
  console.log('📦 [TEST CALLBACK] Body:', JSON.stringify(req.body, null, 2));
  // Pass to actual callback handler
  paymentCallback(req, res, next);
});

// TESTING: Public endpoints for frontend testing
// TODO: Secure these with authentication in production
router.post('/', joiValidator(createPayment, "body"), createPaymentController);
router.post('/:paymentId/generate-link', generatePaymentLink);
router.get('/:id', getPayment); // Get payment status - public for testing

// ========== AUTHENTICATED ROUTES ==========
router.use(protect);

// ========== STUDENT/COMMON ROUTES ==========
router.post('/:paymentId/student-generate-link', studentGeneratePaymentLink);

// ========== ADMIN/ACCOUNTANT ROUTES ==========
// Admin and accountant routes
router.get('/', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getAllPayments);
router.get('/stats', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getPaymentStats);
router.patch('/:id/status', restrictTo('ADMIN', 'ACCOUNTANT'), joiValidator(updatePaymentStatus, "body"), updatePaymentStatusController);
router.post('/:id/refund', restrictTo('ADMIN', 'ACCOUNTANT'), joiValidator(refundPayment, "body"), refundPaymentController);

module.exports = router;