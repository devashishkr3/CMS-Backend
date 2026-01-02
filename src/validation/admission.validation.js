const Joi = require('joi');

// Create admission validation schema
const createAdmission = Joi.object({
  studentId: Joi.string().uuid().required().messages({
    'string.uuid': 'Student ID must be a valid UUID',
    'any.required': 'Student ID is required'
  }),
  courseId: Joi.string().uuid().required().messages({
    'string.uuid': 'Course ID must be a valid UUID',
    'any.required': 'Course ID is required'
  })
});

// Update admission status validation schema
const updateAdmissionStatus = Joi.object({
  status: Joi.string().valid('INITIATED', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED').required().messages({
    'any.required': 'Status is required',
    'any.only': 'Status must be one of: INITIATED, PAYMENT_PENDING, CONFIRMED, CANCELLED'
  }),
  notes: Joi.string().max(500).optional().messages({
    'string.max': 'Notes should not exceed 500 characters'
  })
});

// Admission window validation schema
const createAdmissionWindow = Joi.object({
  title: Joi.string().min(3).max(100).required().messages({
    'string.min': 'Title should be at least 3 characters long',
    'string.max': 'Title should not exceed 100 characters',
    'any.required': 'Title is required'
  }),
  courseId: Joi.string().uuid().required().messages({
    'string.uuid': 'Course ID must be a valid UUID',
    'any.required': 'Course ID is required'
  }),
  departmentId: Joi.string().uuid().required().messages({
    'string.uuid': 'Department ID must be a valid UUID',
    'any.required': 'Department ID is required'
  }),
  startDate: Joi.date().iso().required().messages({
    'date.iso': 'Start date must be in ISO format',
    'any.required': 'Start date is required'
  }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.iso': 'End date must be in ISO format',
    'date.greater': 'End date must be after start date',
    'any.required': 'End date is required'
  })
});

// Update admission window validation schema
const updateAdmissionWindow = Joi.object({
  title: Joi.string().min(3).max(100).optional().messages({
    'string.min': 'Title should be at least 3 characters long',
    'string.max': 'Title should not exceed 100 characters'
  }),
  startDate: Joi.date().iso().optional().messages({
    'date.iso': 'Start date must be in ISO format'
  }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).optional().messages({
    'date.iso': 'End date must be in ISO format',
    'date.greater': 'End date must be after start date'
  }),
  enabled: Joi.boolean().optional()
});

module.exports = {
  createAdmission,
  updateAdmissionStatus,
  createAdmissionWindow,
  updateAdmissionWindow
};