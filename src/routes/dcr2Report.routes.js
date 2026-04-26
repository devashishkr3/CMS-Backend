const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { getDCR2Report, exportDCR2Report } = require('../controllers/dcr2Report.controller');

// DCR2 Report - Certificate Finance Report
router.get('/dcr2', protect, restrictTo('ADMIN', 'ACCOUNTANT'), getDCR2Report);

// DCR2 Report Export - CSV Download
router.get('/dcr2/export', protect, restrictTo('ADMIN', 'ACCOUNTANT'), exportDCR2Report);

module.exports = router;
