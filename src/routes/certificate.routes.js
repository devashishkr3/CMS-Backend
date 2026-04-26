const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require('../middlewares/joiValidator');
const { 
  applyCertificate, 
  createCertificatePayment,
  adminFilterCertificates,
  updateCertificate
} = require('../validation/certificate.validation');

const {
  applyCertificate: applyCertificateController,
  createPayment: createPaymentController,
  getAllApplications,
  getApplication,
  updateApplication,
  updateApplicationStatus,
  approveApplication,
  rejectApplication,
  downloadCertificate
} = require('../controllers/certificate.controller');

// STUDENT ROUTES
router.post('/',
  joiValidator(applyCertificate, 'body'),
  applyCertificateController
);

router.post('/apply', 
  // protect, 
  // restrictTo('STUDENT', 'ADMIN', 'HOD'),
  joiValidator(applyCertificate, 'body'), 
  applyCertificateController
);

router.post('/payment/create', 
  // protect,
  joiValidator(createCertificatePayment, 'body'),
  createPaymentController
);

// ADMIN ROUTES
router.get('/',
  protect,
  restrictTo('ADMIN'),
  joiValidator(adminFilterCertificates, 'query'),
  getAllApplications
);

router.get('/admin', 
  protect, 
  restrictTo('ADMIN'),
  joiValidator(adminFilterCertificates, 'query'),
  getAllApplications
);

router.get('/:id',
  protect,
  restrictTo('ADMIN'),
  getApplication
);

router.get('/admin/:id', 
  protect, 
  restrictTo('ADMIN'),
  getApplication
);

router.patch('/:id/status',
  protect,
  restrictTo('ADMIN'),
  updateApplicationStatus
);

router.patch('/admin/:id', 
  protect, 
  restrictTo('ADMIN'),
  joiValidator(updateCertificate, 'body'),
  updateApplication
);

router.patch('/admin/:id/approve', 
  protect, 
  restrictTo('ADMIN'),
  approveApplication
);

router.post('/:id/issue',
  protect,
  restrictTo('ADMIN'),
  approveApplication
);

router.patch('/admin/:id/reject', 
  protect, 
  restrictTo('ADMIN'),
  rejectApplication
);

router.get('/:id/download',
  protect,
  restrictTo('ADMIN', 'STUDENT'),
  downloadCertificate
);

router.get('/admin/:id/download', 
  protect, 
  restrictTo('ADMIN', 'STUDENT'),
  downloadCertificate
);

module.exports = router;
