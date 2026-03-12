const Joi = require('joi');

//<---------------------------------Create student validation schema------------------------------------------>
const createStudent = Joi.object({
    reg_no: Joi.string().min(5).max(50).optional(),
  uan_no: Joi.string().min(5).max(50).optional(),
  class_roll: Joi.string().min(1).max(10).optional(),
  university_roll: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'University roll should be at least 1 character long',
    'string.max': 'University roll should not exceed 50 characters'
  }),
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
  photoUrl: Joi.string().uri().optional().messages({
    'string.uri': 'Photo URL must be a valid URI'
  }),
  departmentId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Department ID must be a valid UUID'
  }),
  courseId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Course ID must be a valid UUID'
  }),
  sessionId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Session ID must be a valid UUID'
  }),
  semesterId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Semester ID must be a valid UUID'
  }),
  admissionType: Joi.string().valid('NEW', 'CONTINUATION').optional().messages({
    'any.only': 'admission type must be one of NEW, CONTINUATION'
  }),
  academicYear: Joi.string().pattern(/^\d{4}-\d{2}$/).optional().messages({
    'any.required': 'academic year must be in 2025-26 format'
  }), // 2025-26
  admissionNo: Joi.string().optional(),
  confidentialNo: Joi.string().optional(),
  meritListType: Joi.string().optional(),
  profileNo: Joi.string().optional()
});

//<--------------------------------- Update student validation schema---------------------------->
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
  }),
  university_roll: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'University roll should be at least 1 character long',
    'string.max': 'University roll should not exceed 50 characters'
  })
});

//<-----------------------------Assign semester validation schema------------------------------------>
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
const verifyStudentSchema = Joi.object({

  uan_no: Joi.string()
    .trim()
    .optional(),

  reg_no: Joi.string()
    .trim()
    .optional(),

  university_roll: Joi.string()
    .trim()
    .optional(),

  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid mobile number"
    })

}).or("uan_no", "reg_no", "university_roll"); 
// At least one of uan_no, reg_no, or university_roll is required along with phone

//<---------------------------------Bulk Create Students validation schema------------------------------------------>
const bulkCreateStudents = Joi.object({
  students: Joi.array().items(
    Joi.object({
      name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Name should be at least 2 characters long',
        'string.max': 'Name should not exceed 100 characters',
        'any.required': 'Name is required'
      }),
      fatherName: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Father name should be at least 2 characters long',
        'string.max': 'Father name should not exceed 100 characters',
        'any.required': 'Father name is required'
      }),
      university_roll: Joi.string().min(5).max(50).required().messages({
        'string.min': 'University roll should be at least 5 characters long',
        'string.max': 'University roll should not exceed 50 characters',
        'any.required': 'University roll is required'
      }),
      class_roll: Joi.string().min(1).max(50).optional().messages({
        'string.min': 'Class roll should be at least 1 character long',
        'string.max': 'Class roll should not exceed 50 characters'
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
      gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional().messages({
        'any.only': 'Gender must be one of MALE, FEMALE, or OTHER'
      }),
      category: Joi.string().valid('GENERAL', 'BC_I', 'BC_II', 'SC', 'ST', 'EWS').optional().messages({
        'any.only': 'Category must be one of GENERAL, BC_I, BC_II, SC, ST, or EWS'
      }),
      address: Joi.string().max(500).optional().messages({
        'string.max': 'Address should not exceed 500 characters'
      })
    })
  ).min(1).required().messages({
    'array.min': 'At least one student is required',
    'any.required': 'Students array is required'
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
  departmentId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Department ID must be a valid UUID'
  }),
  academicYear: Joi.string().pattern(/^\d{4}-\d{2}$/).optional().messages({
    'any.required': 'academic year must be in 2025-26 format'
  }), // 2025-26
  admissionType: Joi.string().valid('NEW', 'CONTINUATION').optional().messages({
    'any.only': 'admission type must be one of NEW, CONTINUATION'
  })
});

module.exports = {
  createStudent,
  updateStudent,
  assignSemester,
  verifyStudentSchema,
  bulkCreateStudents
};

