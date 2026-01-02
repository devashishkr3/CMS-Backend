const Joi = require('joi');

// File upload validation schema
const uploadFile = Joi.object({
  fileType: Joi.string().valid('photo', 'document', 'certificate').required().messages({
    'any.required': 'File type is required',
    'any.only': 'File type must be one of: photo, document, certificate'
  }),
  documentType: Joi.string().when('fileType', {
    is: 'document',
    then: Joi.string().valid('AADHAR', 'MARKSHEET', 'TC', 'OTHER').required().messages({
      'any.required': 'Document type is required for documents',
      'any.only': 'Document type must be one of: AADHAR, MARKSHEET, TC, OTHER'
    }),
    otherwise: Joi.optional()
  }),
  studentId: Joi.string().uuid().when('fileType', {
    is: Joi.exist(),
    then: Joi.required().messages({
      'any.required': 'Student ID is required'
    }),
    otherwise: Joi.optional()
  })
});

// Verify document validation schema
const verifyDocument = Joi.object({
  verified: Joi.boolean().required().messages({
    'any.required': 'Verification status is required'
  }),
  notes: Joi.string().max(500).optional().messages({
    'string.max': 'Notes should not exceed 500 characters'
  })
});

module.exports = {
  uploadFile,
  verifyDocument
};