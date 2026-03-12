const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { 
  createPayment, 
  updatePaymentStatus, 
  refundPayment,
  getDCR1ReportWithDateRange: dcr1DateRangeValidator
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
  studentGeneratePaymentLink,
  downloadPublicInvoice,
  getDCR1Report,
  getDCR1ReportWithDateRange,
  getTodayCollection,
  getMonthCollection
} = require('../controllers/payment.controller');

// ========== PUBLIC ROUTES (No Auth Required) ==========
router.post("/callback", paymentCallback);
router.get("/return", paymentReturn);
router.post("/return", paymentReturn);

// TEST ENDPOINT: Manually test callback (for debugging only)
router.post('/callback-test', (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ status: "error", message: "Not found" });
  }
  console.log('🧪 [TEST CALLBACK] Received test callback');
  console.log('📦 [TEST CALLBACK] Body:', JSON.stringify(req.body, null, 2));
  paymentCallback(req, res, next);
});

// Public status lookup
router.get('/public/:id/status', getPayment);
router.get('/public/:id/invoice', downloadPublicInvoice);

// ========== AUTHENTICATED ROUTES ==========
router.use(protect);

// Create payment
router.post('/', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), joiValidator(createPayment, "body"), createPaymentController);

// Generate payment link
router.post('/:paymentId/generate-link', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), generatePaymentLink);

// Student link
router.post('/:paymentId/student-generate-link', studentGeneratePaymentLink);

// Admin routes
router.get('/', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getAllPayments);
router.get('/stats', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getPaymentStats);
router.get('/dcr1-report', restrictTo('ADMIN', 'ACCOUNTANT'), getDCR1Report);

// DCR1 Report with date range filter and CSV export
router.get('/dcr1-report/date-range', 
  restrictTo('ADMIN', 'ACCOUNTANT'),
  joiValidator(dcr1DateRangeValidator, "query"),
  getDCR1ReportWithDateRange
);

// Quick collection endpoints
router.get('/dcr1-report/today', restrictTo('ADMIN', 'ACCOUNTANT'), getTodayCollection);
router.get('/dcr1-report/month', restrictTo('ADMIN', 'ACCOUNTANT'), getMonthCollection);

router.get('/:id', restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getPayment);

router.patch('/:id/status',
  restrictTo('ADMIN', 'ACCOUNTANT'),
  joiValidator(updatePaymentStatus, "body"),
  updatePaymentStatusController
);

router.post('/:id/refund',
  restrictTo('ADMIN', 'ACCOUNTANT'),
  joiValidator(refundPayment, "body"),
  refundPaymentController
);

module.exports = router;

// const express = require("express");
// const router = express.Router();

// // Import middleware
// const { protect, restrictTo } = require('../middlewares/auth.middleware');
// const joiValidator = require("../middlewares/joiValidator");

// // Import validation schemas
// const { 
//   createPayment, 
//   updatePaymentStatus, 
//   refundPayment,
//   getDCR1ReportWithDateRange: dcr1DateRangeValidator
// } = require("../validation/payment.validation");

// // Import controllers
// const {
//   createPayment: createPaymentController,
//   getAllPayments,
//   getPayment,
//   updatePaymentStatus: updatePaymentStatusController,
//   refundPayment: refundPaymentController,
//   getPaymentStats,
//   paymentCallback,
//   generatePaymentLink,
//   paymentReturn,
//   studentGeneratePaymentLink,
//   downloadPublicInvoice,
//   getDCR1Report,
//   getDCR1ReportWithDateRange,
//   getTodayCollection,
//   getMonthCollection,
//   requeryPaymentStatus
// } = require('../controllers/payment.controller');

// // ========== PUBLIC ROUTES (No Auth Required) ==========
// router.post("/callback", paymentCallback);
// router.get("/return", paymentReturn);
// router.post("/return", paymentReturn);

// // TEST ENDPOINT: Manually test callback (for debugging only)
// router.post('/callback-test', (req, res, next) => {
//   if (process.env.NODE_ENV === "production") {
//     return res.status(404).json({ status: "error", message: "Not found" });
//   }
//   console.log('🧪 [TEST CALLBACK] Received test callback');
//   console.log('📦 [TEST CALLBACK] Body:', JSON.stringify(req.body, null, 2));
//   paymentCallback(req, res, next);
// });

// // Public status lookup
// router.get('/public/:id/status', getPayment);
// router.get('/public/:id/invoice', downloadPublicInvoice);

// // ========== AUTHENTICATED ROUTES ==========
// // router.use(protect);

// // Create payment
// router.post('/', joiValidator(createPayment, "body"), createPaymentController);

// // Generate payment link
// router.post('/:paymentId/generate-link', generatePaymentLink);

// // Student link
// router.post('/:paymentId/student-generate-link', studentGeneratePaymentLink);

// // Admin routes
// router.get('/', protect, restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getAllPayments);
// router.get('/stats', protect, restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getPaymentStats);
// router.get('/dcr1-report', protect, restrictTo('ADMIN', 'ACCOUNTANT'), getDCR1Report);

// // DCR1 Report with date range filter and CSV export
// router.get('/dcr1-report/date-range', protect, 
//   restrictTo('ADMIN', 'ACCOUNTANT'),
//   joiValidator(dcr1DateRangeValidator, "query"),
//   getDCR1ReportWithDateRange
// );

// // Quick collection endpoints
// router.get('/dcr1-report/today', protect, restrictTo('ADMIN', 'ACCOUNTANT'), getTodayCollection);
// router.get('/dcr1-report/month', protect, restrictTo('ADMIN', 'ACCOUNTANT'), getMonthCollection);

// router.get('/:id', protect, restrictTo('ADMIN', 'ACCOUNTANT', 'HOD'), getPayment);

// // Requery payment status from gateway (for admin to manually verify pending payments)
// router.get('/:id/requery', protect, restrictTo('ADMIN', 'ACCOUNTANT'), requeryPaymentStatus);

// router.patch('/:id/status',
//   restrictTo('ADMIN', 'ACCOUNTANT'), protect,
//   joiValidator(updatePaymentStatus, "body"),
//   updatePaymentStatusController
// );

// router.post('/:id/refund', protect,
//   restrictTo('ADMIN', 'ACCOUNTANT'),
//   joiValidator(refundPayment, "body"),
//   refundPaymentController
// );

// module.exports = router;