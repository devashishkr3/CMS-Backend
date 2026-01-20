const Joi = require('joi');

// Create payment validation schema
const createPayment = Joi.object({
  studentId: Joi.string().uuid().required().messages({
    'string.uuid': 'Student ID must be a valid UUID',
    'any.required': 'Student ID is required'
  }),
  admissionId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Admission ID must be a valid UUID'
  }),
  totalAmount: Joi.number().positive().required().messages({
    'number.positive': 'Total amount must be a positive number',
    'any.required': 'Total amount is required'
  }),
  gateway: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Gateway should be at least 2 characters long',
    'string.max': 'Gateway should not exceed 50 characters',
    'any.required': 'Gateway is required'
  }),
  txnId: Joi.string().min(5).max(100).required().messages({
    'string.min': 'Transaction ID should be at least 5 characters long',
    'string.max': 'Transaction ID should not exceed 100 characters',
    'any.required': 'Transaction ID is required'
  }),
  referenceNo: Joi.string().max(100).optional().messages({
    'string.max': 'Reference number should not exceed 100 characters'
  }),
  breakups: Joi.array().items(Joi.object({
    head: Joi.string().valid('TUITION', 'EXAM', 'INFRASTRUCTURE', 'DEVELOPMENT', 'CERTIFICATE', 'MISC').required().messages({
      'any.required': 'Fee head is required',
      'any.only': 'Fee head must be one of: TUITION, EXAM, INFRASTRUCTURE, DEVELOPMENT, CERTIFICATE, MISC'
    }),
    amount: Joi.number().positive().required().messages({
      'number.positive': 'Amount must be a positive number',
      'any.required': 'Amount is required'
    })
  })).optional()
});

// Update payment status validation schema
const updatePaymentStatus = Joi.object({
  status: Joi.string().valid('SUCCESS', 'FAILED', 'REFUNDED').required().messages({
    'any.required': 'Status is required',
    'any.only': 'Status must be one of: SUCCESS, FAILED, REFUNDED'
  }),
  notes: Joi.string().max(500).optional().messages({
    'string.max': 'Notes should not exceed 500 characters'
  })
});

// Refund payment validation schema
const refundPayment = Joi.object({
  reason: Joi.string().min(5).max(500).required().messages({
    'string.min': 'Reason should be at least 5 characters long',
    'string.max': 'Reason should not exceed 500 characters',
    'any.required': 'Reason is required'
  }),
  refundAmount: Joi.number().positive().optional().messages({
    'number.positive': 'Refund amount must be a positive number'
  })
});

module.exports = {
  createPayment,
  updatePaymentStatus,
  refundPayment
};