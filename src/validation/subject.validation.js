const Joi = require('joi');

// Create subject validation schema
const createSubject = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Subject name should be at least 2 characters long',
    'string.max': 'Subject name should not exceed 100 characters',
    'any.required': 'Subject name is required'
  }),
  code: Joi.string().max(10).required().messages({
    'string.max': 'Subject code should not exceed 10 characters',
    'any.required': 'Subject code is required'
  }),
  type: Joi.string().valid('MJC', 'MIC', 'MDC', 'SEC', 'VAC').required().messages({
    'any.only': 'Subject type must be one of: MJC, MIC, MDC, SEC, VAC',
    'any.required': 'Subject type is required'
  }),
  // credit: Joi.number().integer().min(1).max(10).optional().messages({
  //   'number.integer': 'Credit must be an integer',
  //   'number.min': 'Credit must be at least 1',
  //   'number.max': 'Credit cannot exceed 10'
  // }),
  semesterId: Joi.string().uuid().required().messages({
    'string.uuid': 'Semester ID must be a valid UUID',
    'any.required': 'Semester ID is required'
  }),
  courseId: Joi.string().uuid().required().messages({
    'string.uuid': 'Course ID must be a valid UUID',
    'any.required': 'Course ID is required'
  })
});

// Update subject validation schema
const updateSubject = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Subject name should be at least 2 characters long',
    'string.max': 'Subject name should not exceed 100 characters'
  }),
  code: Joi.string().max(10).optional().messages({
    'string.max': 'Subject code should not exceed 10 characters'
  }),
  type: Joi.string().valid('MJC', 'MIC', 'MDC', 'SEC', 'VAC').optional().messages({
    'any.only': 'Subject type must be one of: MJC, MIC, MDC, SEC, VAC'
  }),
  credit: Joi.number().integer().min(1).max(10).optional().messages({
    'number.integer': 'Credit must be an integer',
    'number.min': 'Credit must be at least 1',
    'number.max': 'Credit cannot exceed 10'
  }),
  semesterId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Semester ID must be a valid UUID'
  }),
  courseId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Course ID must be a valid UUID'
  })
});

module.exports = {
  createSubject,
  updateSubject
};