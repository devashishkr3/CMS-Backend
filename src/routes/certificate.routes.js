const express = require('express');
const router = express.Router();
const { 
  createCertificateRequest,
  getAllCertificateRequests,
  getCertificateRequest,
  updateCertificateStatus,
  deleteCertificateRequest,
  issueCertificate,
  downloadCertificate
} = require('../controllers/certificate.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Apply protection middleware to all routes
router.use(protect);

// Create certificate request (STUDENT, ADMIN, HOD)
router.post('/', restrictTo('STUDENT', 'ADMIN', 'HOD'), createCertificateRequest);

// Get all certificate requests (ADMIN, HOD, STUDENT)
router.get('/', restrictTo('ADMIN', 'HOD', 'STUDENT'), getAllCertificateRequests);

// Get certificate request by ID (ADMIN, HOD, STUDENT)
router.get('/:id', restrictTo('ADMIN', 'HOD', 'STUDENT'), getCertificateRequest);

// Update certificate status (ADMIN, HOD)
router.patch('/:id/status', restrictTo('ADMIN', 'HOD'), updateCertificateStatus);

// Issue certificate and generate PDF (ADMIN, HOD)
router.post('/:id/issue', restrictTo('ADMIN', 'HOD'), issueCertificate);

// Download certificate PDF (STUDENT for own certificates, ADMIN, HOD)
router.get('/:id/download', restrictTo('STUDENT', 'ADMIN', 'HOD'), downloadCertificate);

// Delete certificate request (ADMIN, STUDENT for own pending requests)
router.delete('/:id', restrictTo('ADMIN', 'STUDENT'), deleteCertificateRequest);

module.exports = router;