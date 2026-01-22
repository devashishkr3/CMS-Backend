const Joi = require('joi');

// Create student validation schema
const createStudent = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Name should be at least 2 characters long',
    'string.max': 'Name should not exceed 100 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required'
  }),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits',
    'any.required': 'Phone number is required'
  }),
  dob: Joi.date().iso().optional().messages({
    'date.iso': 'Date of birth must be in ISO format'
  }),
  fatherName: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Father name should be at least 2 characters long',
    'string.max': 'Father name should not exceed 100 characters'
  }),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional().messages({
    'any.only': 'Gender must be one of MALE, FEMALE, or OTHER'
  }),
  category: Joi.string().valid('GENERAL', 'BC_I', 'BC_II', 'SC', 'ST', 'EWS').optional().messages({
    'any.only': 'Category must be one of GENERAL, BC_I, BC_II, SC, ST, or EWS'
  }),
  address: Joi.string().max(500).optional().messages({
    'string.max': 'Address should not exceed 500 characters'
  }),
  departmentId: Joi.string().uuid().required().messages({
    'string.uuid': 'Department ID must be a valid UUID',
    'any.required': 'Department ID is required'
  }),
  courseId: Joi.string().uuid().required().messages({
    'string.uuid': 'Course ID must be a valid UUID',
    'any.required': 'Course ID is required'
  }),
  sessionId: Joi.string().uuid().required().messages({
    'string.uuid': 'Session ID must be a valid UUID',
    'any.required': 'Session ID is required'
  }),
    semesterId: Joi.string().uuid().required().messages({
    'string.uuid': 'Semester ID must be a valid UUID',
    'any.required': 'Semester ID is required'
  }),
  admissionType: Joi.string().valid('NEW', 'CONTINUATION').required().messages({
    'any.only': 'admission type must be one of NEW, CONTINUATION',
    'any.required': 'Admission Type is Required',
  }),
  academicYear: Joi.string().pattern(/^\d{4}-\d{2}$/).required().messages({
    'any.required': 'academic year must be in 2025-26 format'
  }) // 2025-26
});

// Update student validation schema
const updateStudent = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Name should be at least 2 characters long',
    'string.max': 'Name should not exceed 100 characters'
  }),
  email: Joi.string().email().optional().messages({
    'string.email': 'Please provide a valid email'
  }),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional().messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits'
  }),
  dob: Joi.date().iso().optional().messages({
    'date.iso': 'Date of birth must be in ISO format'
  }),
  fatherName: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Father name should be at least 2 characters long',
    'string.max': 'Father name should not exceed 100 characters'
  }),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional().messages({
    'any.only': 'Gender must be one of MALE, FEMALE, or OTHER'
  }),
  category: Joi.string().valid('GENERAL', 'BC_I', 'BC_II', 'SC', 'ST', 'EWS').optional().messages({
    'any.only': 'Category must be one of GENERAL, BC_I, BC_II, SC, ST, or EWS'
  }),
  address: Joi.string().max(500).optional().messages({
    'string.max': 'Address should not exceed 500 characters'
  }),
  status: Joi.string().valid('ACTIVE', 'SUSPENDED', 'PASSED_OUT', 'ALUMNI', 'DROPOUT').optional(),
  photoUrl: Joi.string().uri().optional().messages({
    'string.uri': 'Photo URL must be a valid URI'
  }),
  class_roll: Joi.string().optional().messages({
    'string.base': 'Class roll must be a string'
  })
});

// Assign semester validation schema
const assignSemester = Joi.object({
  semesterId: Joi.string().uuid().required().messages({
    'string.uuid': 'Semester ID must be a valid UUID',
    'any.required': 'Semester ID is required'
  }),
  startDate: Joi.date().iso().required().messages({
    'date.iso': 'Start date must be in ISO format',
    'any.required': 'Start date is required'
  }),
  endDate: Joi.date().iso().optional().messages({
    'date.iso': 'End date must be in ISO format'
  })
});

module.exports = {
  createStudent,
  updateStudent,
  assignSemester
};


// exports.createStudent = Joi.object({
//   // BASIC INFO
//   name: Joi.string().min(2).max(100).required(),
//   email: Joi.string().email().required(),
//   phone: Joi.string().pattern(/^[0-9]{10}$/).required(),

//   dob: Joi.date().iso().optional(),
//   fatherName: Joi.string().max(100).optional(),

//   gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional(),
//   category: Joi.string().valid(
//     'GENERAL',
//     'BC_I',
//     'BC_II',
//     'SC',
//     'ST',
//     'EWS'
//   ).optional(),

//   address: Joi.string().max(500).optional(),
//   photoUrl: Joi.string().uri().optional(),

//   // ACADEMIC
//   departmentId: Joi.string().uuid().required(),
//   courseId: Joi.string().uuid().required(),
//   sessionId: Joi.string().uuid().required(),
//   semesterId: Joi.string().uuid().required(),

//   admissionType: Joi.string().valid('NEW', 'CONTINUATION').required(),
//   academicYear: Joi.string().pattern(/^\d{4}-\d{2}$/).required() // 2025-26
// });

