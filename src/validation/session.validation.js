const Joi = require('joi');

// Create session validation schema
const createSession = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Session name should be at least 2 characters long',
    'string.max': 'Session name should not exceed 100 characters',
    'any.required': 'Session name is required'
  }),
  startYear: Joi.number().integer().min(1900).max(2100).required().messages({
    'number.base': 'Start year must be a number',
    'number.integer': 'Start year must be an integer',
    'number.min': 'Start year must be at least 1900',
    'number.max': 'Start year must not exceed 2100',
    'any.required': 'Start year is required'
  }),
  endYear: Joi.number().integer().min(1900).max(2100).required().messages({
    'number.base': 'End year must be a number',
    'number.integer': 'End year must be an integer',
    'number.min': 'End year must be at least 1900',
    'number.max': 'End year must not exceed 2100',
    'any.required': 'End year is required'
  }),
  courseId: Joi.string().uuid().required().messages({
    'string.uuid': 'Course ID must be a valid UUID',
    'any.required': 'Course ID is required'
  })
}).custom((value, helpers) => {
  if (value.startYear >= value.endYear) {
    return helpers.error('any.custom', { message: 'End year must be greater than start year' });
  }
  return value;
});

// Update session validation schema
const updateSession = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Session name should be at least 2 characters long',
    'string.max': 'Session name should not exceed 100 characters'
  }),
  startYear: Joi.number().integer().min(1900).max(2100).optional().messages({
    'number.base': 'Start year must be a number',
    'number.integer': 'Start year must be an integer',
    'number.min': 'Start year must be at least 1900',
    'number.max': 'Start year must not exceed 2100'
  }),
  endYear: Joi.number().integer().min(1900).max(2100).optional().messages({
    'number.base': 'End year must be a number',
    'number.integer': 'End year must be an integer',
    'number.min': 'End year must be at least 1900',
    'number.max': 'End year must not exceed 2100'
  }),
  courseId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Course ID must be a valid UUID'
  })
}).custom((value, helpers) => {
  if (value.startYear !== undefined && value.endYear !== undefined && value.startYear >= value.endYear) {
    return helpers.error('any.custom', { message: 'End year must be greater than start year' });
  }
  if (value.startYear !== undefined && value.endYear === undefined && value.startYear >= value.originalValue.endYear) {
    return helpers.error('any.custom', { message: 'End year must be greater than start year' });
  }
  if (value.startYear === undefined && value.endYear !== undefined && value.originalValue.startYear >= value.endYear) {
    return helpers.error('any.custom', { message: 'End year must be greater than start year' });
  }
  return value;
});

module.exports = {
  createSession,
  updateSession
};