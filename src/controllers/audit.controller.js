const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { Parser } = require('json2csv');

/**
 * Get all audit logs with filtering options
 * Access: ADMIN
 */
exports.getAllAuditLogs = async (req, res, next) => {
  try {
    const { userId, action, entity, entityId, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    // Build where clause
    const where = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (action) {
      where.action = {
        contains: action,
        mode: 'insensitive'
      };
    }
    
    if (entity) {
      where.entity = {
        contains: entity,
        mode: 'insensitive'
      };
    }
    
    if (entityId) {
      where.entityId = entityId;
    }
    
    if (startDate || endDate) {
      where.timestamp = {};
      
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Get audit logs
    const [auditLogs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        skip,
        take
      }),
      prisma.auditLog.count({ where })
    ]);

    res.status(200).json({
      status: 'success',
      results: auditLogs.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: {
        auditLogs
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit log by ID
 * Access: ADMIN
 */
exports.getAuditLog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const auditLog = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!auditLog) {
      return next(new AppError('Audit log not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        auditLog
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs for a specific entity
 * Access: ADMIN, HOD (for own entities)
 */
exports.getEntityAuditLogs = async (req, res, next) => {
  try {
    const { entity, entityId } = req.params;

    // Build where clause
    const where = {
      entity,
      entityId
    };

    // Get audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: auditLogs.length,
      data: {
        auditLogs
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user activity logs
 * Access: ADMIN, USER (own logs)
 */
exports.getUserActivityLogs = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // For non-admin users, only allow accessing own logs
    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
      return next(new AppError('You can only access your own activity logs', 403));
    }

    // Build where clause
    const where = {
      userId
    };

    // Get audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 100 // Limit to last 100 activities
    });

    res.status(200).json({
      status: 'success',
      results: auditLogs.length,
      data: {
        auditLogs
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export audit logs
 * Access: ADMIN
 */
exports.exportAuditLogs = async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    // Build where clause
    const where = {};
    
    if (startDate || endDate) {
      where.timestamp = {};
      
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Get audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // Format data based on requested format
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'IP Address', 'User Agent'];
      const csvRows = auditLogs.map(log => [
        log.timestamp.toISOString(),
        `${log.user.name} (${log.user.email})`,
        log.action,
        log.entity,
        log.entityId,
        log.ipAddress || '',
        log.userAgent || ''
      ]);
      
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');
      
      res.header('Content-Type', 'text/csv');
      res.attachment('audit_logs.csv');
      return res.send(csvContent);
    } else {
      // Default to JSON format
      res.header('Content-Type', 'application/json');
      res.attachment('audit_logs.json');
      return res.json(auditLogs);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit statistics
 * Access: ADMIN
 */
exports.getAuditStats = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Build where clause
    const where = {
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    };

    // Get audit logs for statistics
    const auditLogs = await prisma.auditLog.findMany({
      where,
      select: {
        action: true,
        entity: true,
        userId: true,
        timestamp: true
      }
    });

    // Calculate statistics
    const totalLogs = auditLogs.length;
    
    // Group by action
    const actionStats = {};
    const entityStats = {};
    const userStats = {};
    
    // Daily activity
    const dailyStats = {};
    
    auditLogs.forEach(log => {
      // Action stats
      actionStats[log.action] = (actionStats[log.action] || 0) + 1;
      
      // Entity stats
      entityStats[log.entity] = (entityStats[log.entity] || 0) + 1;
      
      // User stats
      userStats[log.userId] = (userStats[log.userId] || 0) + 1;
      
      // Daily stats
      const date = log.timestamp.toISOString().split('T')[0];
      dailyStats[date] = (dailyStats[date] || 0) + 1;
    });

    // Get top users
    const topUsers = Object.entries(userStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    res.status(200).json({
      status: 'success',
      data: {
        totalLogs,
        actionStats,
        entityStats,
        topUsers,
        dailyStats,
        period: {
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent audit logs
 * Access: ADMIN
 */
exports.getRecentAuditLogs = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    
    // Get recent audit logs
    const auditLogs = await prisma.auditLog.findMany({
      take: parseInt(limit),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: auditLogs.length,
      data: {
        auditLogs
      }
    });
  } catch (error) {
    next(error);
  }
};