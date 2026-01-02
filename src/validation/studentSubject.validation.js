const Joi = require('joi');

// Create student subject validation schema
const createStudentSubject = Joi.object({
  studentId: Joi.string().uuid().required().messages({
    'string.uuid': 'Student ID must be a valid UUID',
    'any.required': 'Student ID is required'
  }),
  subjectId: Joi.string().uuid().required().messages({
    'string.uuid': 'Subject ID must be a valid UUID',
    'any.required': 'Subject ID is required'
  }),
  semesterId: Joi.string().uuid().required().messages({
    'string.uuid': 'Semester ID must be a valid UUID',
    'any.required': 'Semester ID is required'
  })
});

// Update student subject validation schema (if needed for future use)
const updateStudentSubject = Joi.object({
  studentId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Student ID must be a valid UUID'
  }),
  subjectId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Subject ID must be a valid UUID'
  }),
  semesterId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Semester ID must be a valid UUID'
  })
});

// Filter student subjects validation schema
const filterStudentSubjects = Joi.object({
  studentId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Student ID must be a valid UUID'
  }),
  subjectId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Subject ID must be a valid UUID'
  }),
  semesterId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Semester ID must be a valid UUID'
  }),
  type: Joi.string().valid('MJC', 'MIC', 'MDC', 'SEC', 'VAC').optional().messages({
    'any.only': 'Subject type must be one of: MJC, MIC, MDC, SEC, VAC'
  })
});

module.exports = {
  createStudentSubject,
  updateStudentSubject,
  filterStudentSubjects
};