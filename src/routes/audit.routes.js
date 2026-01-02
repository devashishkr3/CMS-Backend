const express = require('express');
const router = express.Router();
const { getAllAuditLogs, getAuditLog, getEntityAuditLogs, getUserActivityLogs, exportAuditLogs, getAuditStats, getRecentAuditLogs } = require('../controllers/audit.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Apply protection middleware to all routes
router.use(protect);

// Get all audit logs (ADMIN only)
router.get('/', restrictTo('ADMIN'), getAllAuditLogs);

// Get audit log by ID (ADMIN only)
router.get('/:id', restrictTo('ADMIN'), getAuditLog);

// Get audit logs for a specific entity (ADMIN, HOD)
router.get('/entity/:entity/:entityId', restrictTo('ADMIN', 'HOD'), getEntityAuditLogs);

// Get user activity logs (ADMIN, USER - own logs only)
router.get('/user/:userId', restrictTo('ADMIN', 'HOD'), getUserActivityLogs);

// Export audit logs (ADMIN only)
router.get('/export', restrictTo('ADMIN'), exportAuditLogs);

// Get audit statistics (ADMIN only)
router.get('/stats', restrictTo('ADMIN'), getAuditStats);

// Get recent audit logs (ADMIN only)
router.get('/recent', restrictTo('ADMIN'), getRecentAuditLogs);

module.exports = router;