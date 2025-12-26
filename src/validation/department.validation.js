const Joi = require('joi');

// Create department validation schema
const createDepartment = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Department name should be at least 2 characters long',
    'string.max': 'Department name should not exceed 100 characters',
    'any.required': 'Department name is required'
  }),
  code: Joi.string().max(10).optional().messages({
    'string.max': 'Department code should not exceed 10 characters'
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description should not exceed 500 characters'
  })
});

// Update department validation schema
const updateDepartment = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Department name should be at least 2 characters long',
    'string.max': 'Department name should not exceed 100 characters'
  }),
  code: Joi.string().max(10).optional().messages({
    'string.max': 'Department code should not exceed 10 characters'
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description should not exceed 500 characters'
  })
});

module.exports = {
  createDepartment,
  updateDepartment
};