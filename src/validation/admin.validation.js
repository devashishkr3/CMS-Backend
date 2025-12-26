const Joi = require('joi');

// Create user validation schema
const createUser = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Name should be at least 2 characters long',
    'string.max': 'Name should not exceed 100 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password should be at least 6 characters long',
    'any.required': 'Password is required'
  }),
  phone: Joi.string().pattern(/^[0-9]{10,15}$/).optional().messages({
    'string.pattern.base': 'Phone number must be between 10-15 digits'
  }),
  role: Joi.string().valid('HOD','ACCOUNTANT', 'STAFF').required().messages({
    'any.only': 'Role must be either HOD or STAFF',
    'any.required': 'Role is required'
  })
});

// Update user status validation schema
const updateUserStatus = Joi.object({
  isActive: Joi.boolean().required().messages({
    'boolean.base': 'isActive must be a boolean',
    'any.required': 'isActive is required'
  })
});

module.exports = {
  createUser,
  updateUserStatus
};