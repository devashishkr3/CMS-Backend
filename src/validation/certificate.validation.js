const Joi = require('joi');
const { 
  VALID_DEPARTMENTS, 
  VALID_COURSES, 
  VALID_SEMESTERS,
  VALID_SESSIONS,
  CERTIFICATE_FEES 
} = require('../utils/certificate.constants');

// Certificate fees mapping
exports.CERTIFICATE_FEES = CERTIFICATE_FEES;
exports.VALID_DEPARTMENTS = VALID_DEPARTMENTS;
exports.VALID_COURSES = VALID_COURSES;
exports.VALID_SEMESTERS = VALID_SEMESTERS;
exports.VALID_SESSIONS = VALID_SESSIONS;

// Validation for applying certificate (student)
exports.applyCertificate = Joi.object({
  type: Joi.string().valid('BONAFIDE', 'CLC', 'CHARACTER').required().messages({
    'string.base': 'Certificate type must be a string',
    'any.only': 'Certificate type must be BONAFIDE, CLC, or CHARACTER',
    'any.required': 'Certificate type is required'
  }),
  name: Joi.string().required().trim().min(3).max(200).messages({
    'string.base': 'Name must be a string',
    'string.min': 'Name must be at least 3 characters',
    'string.max': 'Name cannot exceed 200 characters',
    'string.empty': 'Name is required',
    'any.required': 'Name is required'
  }),
  fatherName: Joi.string().required().trim().min(3).max(200).messages({
    'string.base': 'Father name must be a string',
    'string.min': 'Father name must be at least 3 characters',
    'string.max': 'Father name cannot exceed 200 characters',
    'string.empty': 'Father name is required',
    'any.required': 'Father name is required'
  }),
  motherName: Joi.string().optional().trim().max(200).allow('').messages({
    'string.base': 'Mother name must be a string',
    'string.max': 'Mother name cannot exceed 200 characters'
  }),
  universityRoll: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'University roll must be a string',
    'string.max': 'University roll cannot exceed 50 characters'
  }),
  registrationNo: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'Registration number must be a string',
    'string.max': 'Registration number cannot exceed 50 characters'
  }),
  collegeRoll: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'College roll must be a string',
    'string.max': 'College roll cannot exceed 50 characters'
  }),
  courseName: Joi.string().required().valid(...VALID_COURSES).messages({
    'string.base': 'Course name must be a string',
    'any.only': `Course must be one of: ${VALID_COURSES.join(', ')}`,
    'string.empty': 'Course name is required',
    'any.required': 'Course name is required'
  }),
  departmentName: Joi.string().required().valid(...VALID_DEPARTMENTS).messages({
    'string.base': 'Department name must be a string',
    'any.only': `Department must be one of: ${VALID_DEPARTMENTS.join(', ')}`,
    'string.empty': 'Department name is required',
    'any.required': 'Department name is required'
  }),
  semester: Joi.string().required().valid(...VALID_SEMESTERS).messages({
    'string.base': 'Semester must be a string',
    'any.only': `Semester must be one of: ${VALID_SEMESTERS.join(', ')}`,
    'string.empty': 'Semester is required',
    'any.required': 'Semester is required'
  }),
  session: Joi.string().required().valid(...VALID_SESSIONS).messages({
    'string.base': 'Session must be a string',
    'any.only': `Session must be one of: ${VALID_SESSIONS.join(', ')}`,
    'string.empty': 'Session is required',
    'any.required': 'Session is required'
  }),
  dob: Joi.date().optional().messages({
    'date.base': 'Date of birth must be a valid date'
  }),
  examMonth: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'Exam month must be a string',
    'string.max': 'Exam month cannot exceed 50 characters'
  }),
  examYear: Joi.string().optional().trim().max(10).allow('').messages({
    'string.base': 'Exam year must be a string',
    'string.max': 'Exam year cannot exceed 10 characters'
  }),
  resultDivision: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'Result division must be a string',
    'string.max': 'Result division cannot exceed 50 characters'
  }),
  character: Joi.string().optional().trim().max(500).allow('').messages({
    'string.base': 'Character must be a string',
    'string.max': 'Character cannot exceed 500 characters'
  }),
  purpose: Joi.string().optional().trim().max(500).allow('').messages({
    'string.base': 'Purpose must be a string',
    'string.max': 'Purpose cannot exceed 500 characters'
  })
});

// Validation for creating certificate payment
exports.createCertificatePayment = Joi.object({
  certificateId: Joi.string().uuid().required().messages({
    'string.base': 'Certificate ID must be a string',
    'string.uuid': 'Certificate ID must be a valid UUID',
    'any.required': 'Certificate ID is required'
  })
});

// Validation for admin updating certificate
exports.updateCertificate = Joi.object({
  name: Joi.string().optional().trim().max(200).messages({
    'string.base': 'Name must be a string',
    'string.max': 'Name cannot exceed 200 characters'
  }),
  fatherName: Joi.string().optional().trim().max(200).messages({
    'string.base': 'Father name must be a string',
    'string.max': 'Father name cannot exceed 200 characters'
  }),
  motherName: Joi.string().optional().trim().max(200).allow('').messages({
    'string.base': 'Mother name must be a string',
    'string.max': 'Mother name cannot exceed 200 characters'
  }),
  universityRoll: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'University roll must be a string',
    'string.max': 'University roll cannot exceed 50 characters'
  }),
  registrationNo: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'Registration number must be a string',
    'string.max': 'Registration number cannot exceed 50 characters'
  }),
  collegeRoll: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'College roll must be a string',
    'string.max': 'College roll cannot exceed 50 characters'
  }),
  courseName: Joi.string().optional().trim().max(200).messages({
    'string.base': 'Course name must be a string',
    'string.max': 'Course name cannot exceed 200 characters'
  }),
  departmentName: Joi.string().optional().trim().max(200).messages({
    'string.base': 'Department name must be a string',
    'string.max': 'Department name cannot exceed 200 characters'
  }),
  dob: Joi.date().optional().messages({
    'date.base': 'Date of birth must be a valid date'
  }),
  semester: Joi.string().optional().trim().max(20).messages({
    'string.base': 'Semester must be a string',
    'string.max': 'Semester cannot exceed 20 characters'
  }),
  session: Joi.string().optional().trim().max(20).messages({
    'string.base': 'Session must be a string',
    'string.max': 'Session cannot exceed 20 characters'
  }),
  // Additional fields for admin editing
  examMonth: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'Exam month must be a string',
    'string.max': 'Exam month cannot exceed 50 characters'
  }),
  examYear: Joi.string().optional().trim().max(10).allow('').messages({
    'string.base': 'Exam year must be a string',
    'string.max': 'Exam year cannot exceed 10 characters'
  }),
  resultDivision: Joi.string().optional().trim().max(50).allow('').messages({
    'string.base': 'Result division must be a string',
    'string.max': 'Result division cannot exceed 50 characters'
  }),
  character: Joi.string().optional().trim().max(500).allow('').messages({
    'string.base': 'Character must be a string',
    'string.max': 'Character cannot exceed 500 characters'
  }),
  purpose: Joi.string().optional().trim().max(500).allow('').messages({
    'string.base': 'Purpose must be a string',
    'string.max': 'Purpose cannot exceed 500 characters'
  }),
  remarks: Joi.string().optional().trim().max(1000).allow('').messages({
    'string.base': 'Remarks must be a string',
    'string.max': 'Remarks cannot exceed 1000 characters'
  })
});

// Validation for admin filtering certificates
exports.adminFilterCertificates = Joi.object({
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'ISSUED').optional().messages({
    'string.base': 'Status must be a string',
    'any.only': 'Status must be PENDING, APPROVED, REJECTED, or ISSUED'
  }),
  type: Joi.string().valid('BONAFIDE', 'CLC', 'CHARACTER').optional().messages({
    'string.base': 'Type must be a string',
    'any.only': 'Type must be BONAFIDE, CLC, or CHARACTER'
  }),
  search: Joi.string().optional().max(200).messages({
    'string.base': 'Search must be a string',
    'string.max': 'Search cannot exceed 200 characters'
  }),
  dob: Joi.date().optional().messages({
    'date.base': 'Date of birth must be a valid date'
  }),
  appliedFrom: Joi.date().optional().messages({
    'date.base': 'Applied from must be a valid date'
  }),
  appliedTo: Joi.date().optional().messages({
    'date.base': 'Applied to must be a valid date'
  }),
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1'
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100'
  }),
  sortBy: Joi.string().valid('appliedAt', 'status', 'type').default('appliedAt').messages({
    'string.base': 'Sort by must be a string',
    'any.only': 'Sort by must be appliedAt, status, or type'
  }),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
    'string.base': 'Sort order must be a string',
    'any.only': 'Sort order must be asc or desc'
  })
});

// Validation for creating a certificate request
exports.createCertificateRequest = Joi.object({
  studentId: Joi.string().uuid().required().messages({
    'string.base': 'Student ID must be a string',
    'string.uuid': 'Student ID must be a valid UUID',
    'any.required': 'Student ID is required'
  }),
  type: Joi.string().valid('BONAFIDE', 'CLC').required().messages({
    'string.base': 'Certificate type must be a string',
    'any.only': 'Certificate type must be either BONAFIDE or CLC',
    'any.required': 'Certificate type is required'
  }),
  purpose: Joi.string().max(500).optional().messages({
    'string.base': 'Purpose must be a string',
    'string.max': 'Purpose cannot exceed 500 characters'
  }),
  departmentId: Joi.string().uuid().required().messages({
    'string.base': 'Department ID must be a string',
    'string.uuid': 'Department ID must be a valid UUID',
    'any.required': 'Department ID is required'
  })
});

// Validation for updating a certificate request status
exports.updateCertificateStatus = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED', 'ISSUED').required().messages({
    'string.base': 'Status must be a string',
    'any.only': 'Status must be either APPROVED, REJECTED, or ISSUED',
    'any.required': 'Status is required'
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.base': 'Notes must be a string',
    'string.max': 'Notes cannot exceed 1000 characters'
  })
});

// Validation for filtering certificate requests
exports.filterCertificates = Joi.object({
  studentId: Joi.string().uuid().optional().messages({
    'string.base': 'Student ID must be a string',
    'string.uuid': 'Student ID must be a valid UUID'
  }),
  type: Joi.string().valid('BONAFIDE', 'CLC').optional().messages({
    'string.base': 'Certificate type must be a string',
    'any.only': 'Certificate type must be either BONAFIDE or CLC'
  }),
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'ISSUED').optional().messages({
    'string.base': 'Status must be a string',
    'any.only': 'Status must be either PENDING, APPROVED, REJECTED, or ISSUED'
  }),
  departmentId: Joi.string().uuid().optional().messages({
    'string.base': 'Department ID must be a string',
    'string.uuid': 'Department ID must be a valid UUID'
  })
});