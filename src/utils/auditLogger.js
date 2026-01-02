const prisma = require('../config/prisma');

/**
 * Utility function to get client IP address from request
 * @param {Object} req - Express request object
 * @returns {String} Client IP address
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         'unknown';
};

/**
 * Utility function to get user agent from request
 * @param {Object} req - Express request object
 * @returns {String} User agent string
 */
const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Centralized audit logging function
 * @param {Object} options - Audit log options
 * @param {String} options.userId - ID of the user performing the action
 * @param {String} options.action - Action performed
 * @param {String} options.entity - Entity type
 * @param {String} options.entityId - ID of the entity
 * @param {Object} options.payload - Additional data about the action
 * @param {Object} options.req - Express request object (optional, for IP/userAgent)
 */
exports.logAudit = async ({ userId, action, entity, entityId, payload, req }) => {
  try {
    // Prepare audit log data
    const auditData = {
      userId,
      action,
      entity,
      entityId,
      payload: payload ? JSON.stringify(payload) : null
    };

    // Add IP address and user agent if request object is provided
    if (req) {
      auditData.ipAddress = getClientIp(req);
      auditData.userAgent = getUserAgent(req);
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: auditData
    });
  } catch (error) {
    // Don't throw error if audit logging fails, just log it
    console.error('Audit logging failed:', error);
  }
};

/**
 * Middleware for automatic audit logging
 * @param {String} action - Action performed
 * @param {String} entity - Entity type
 */
exports.auditMiddleware = (action, entity) => {
  return (req, res, next) => {
    // Store audit data in request for later use
    req.audit = {
      action,
      entity,
      timestamp: new Date()
    };
    next();
  };
};

/**
 * Middleware to log successful responses
 */
exports.auditSuccessMiddleware = () => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Call the original send method
      originalSend.call(this, data);
      
      // Log the audit entry if audit data exists
      if (req.audit && req.user) {
        // Try to extract entity ID from response data or request params
        let entityId = null;
        
        try {
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          if (parsedData && parsedData.data) {
            // Try to get ID from response data
            if (parsedData.data.id) {
              entityId = parsedData.data.id;
            } else if (parsedData.data[entity.toLowerCase()]) {
              entityId = parsedData.data[entity.toLowerCase()].id;
            } else if (parsedData.data[entity]) {
              entityId = parsedData.data[entity].id;
            }
          }
          
          // Fallback to request params
          if (!entityId && req.params.id) {
            entityId = req.params.id;
          }
        } catch (parseError) {
          // If parsing fails, try to get ID from request params
          if (req.params.id) {
            entityId = req.params.id;
          }
        }
        
        // Log the audit entry
        exports.logAudit({
          userId: req.user.id,
          action: req.audit.action,
          entity: req.audit.entity,
          entityId,
          payload: {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            timestamp: req.audit.timestamp
          },
          req
        }).catch(err => console.error('Failed to log audit:', err));
      }
    };
    
    next();
  };
};