const Joi = require('joi');

// Validation for creating a certificate request
exports.createCertificateRequest = Joi.object({
  studentId: Joi.string().uuid().required().messages({
    'string.base': 'Student ID must be a string',
    'string.uuid': 'Student ID must be a valid UUID',
    'any.required': 'Student ID is required'
  }),
  type: Joi.string().valid('BONAFIDE', 'CLC').required().messages({
    'string.base': 'Certificate type must be a string',
    'any.only': 'Certificate type must be either BONAFIDE or CLC',
    'any.required': 'Certificate type is required'
  }),
  purpose: Joi.string().max(500).optional().messages({
    'string.base': 'Purpose must be a string',
    'string.max': 'Purpose cannot exceed 500 characters'
  }),
  departmentId: Joi.string().uuid().required().messages({
    'string.base': 'Department ID must be a string',
    'string.uuid': 'Department ID must be a valid UUID',
    'any.required': 'Department ID is required'
  })
});

// Validation for updating a certificate request status
exports.updateCertificateStatus = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED', 'ISSUED').required().messages({
    'string.base': 'Status must be a string',
    'any.only': 'Status must be either APPROVED, REJECTED, or ISSUED',
    'any.required': 'Status is required'
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.base': 'Notes must be a string',
    'string.max': 'Notes cannot exceed 1000 characters'
  })
});

// Validation for filtering certificate requests
exports.filterCertificates = Joi.object({
  studentId: Joi.string().uuid().optional().messages({
    'string.base': 'Student ID must be a string',
    'string.uuid': 'Student ID must be a valid UUID'
  }),
  type: Joi.string().valid('BONAFIDE', 'CLC').optional().messages({
    'string.base': 'Certificate type must be a string',
    'any.only': 'Certificate type must be either BONAFIDE or CLC'
  }),
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'ISSUED').optional().messages({
    'string.base': 'Status must be a string',
    'any.only': 'Status must be either PENDING, APPROVED, REJECTED, or ISSUED'
  }),
  departmentId: Joi.string().uuid().optional().messages({
    'string.base': 'Department ID must be a string',
    'string.uuid': 'Department ID must be a valid UUID'
  })
});