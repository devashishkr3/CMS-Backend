const Joi = require('joi');

// Register validation schema
const registerUser = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Name should be at least 2 characters long',
    'string.max': 'Name should not exceed 50 characters',
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
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional().messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits'
  }),
  role: Joi.string().valid('ADMIN', 'HOD', 'ACCOUNTANT').default('ADMIN').optional(),
  accessPassword: Joi.string().required().messages({
    'any.required': 'access password is mandatory',
  })
});

// Login validation schema
const loginUser = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

// Refresh token validation schema
const refreshToken = Joi.object({
  Authorization: Joi.string().required().messages({
    'any.required': 'Auth Header is required'
  })
});

// Logout validation schema
const logoutUser = Joi.object({
  Authorization: Joi.string().required().messages({
    'any.required': 'Auth Header is required'
  })
});

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser
};