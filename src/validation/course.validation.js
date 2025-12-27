const Joi = require('joi');

// Create course validation schema
const createCourse = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Course name should be at least 2 characters long',
    'string.max': 'Course name should not exceed 100 characters',
    'any.required': 'Course name is required'
  }),
  code: Joi.string().max(10).required().messages({
    'string.max': 'Course code should not exceed 10 characters',
    'any.required': 'Course code is required'
  }),
  durationYears: Joi.number().integer().min(1).max(10).required().messages({
    'number.integer': 'Duration must be an integer',
    'number.min': 'Duration must be at least 1 year',
    'number.max': 'Duration cannot exceed 10 years',
    'any.required': 'Duration is required'
  }),
  departmentId: Joi.string().uuid().required().messages({
    'string.uuid': 'Department ID must be a valid UUID',
    'any.required': 'Department ID is required'
  })
});

// Update course validation schema
const updateCourse = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Course name should be at least 2 characters long',
    'string.max': 'Course name should not exceed 100 characters'
  }),
  code: Joi.string().max(10).optional().messages({
    'string.max': 'Course code should not exceed 10 characters'
  }),
  durationYears: Joi.number().integer().min(1).max(10).optional().messages({
    'number.integer': 'Duration must be an integer',
    'number.min': 'Duration must be at least 1 year',
    'number.max': 'Duration cannot exceed 10 years'
  }),
  departmentId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Department ID must be a valid UUID'
  })
});

module.exports = {
  createCourse,
  updateCourse
};