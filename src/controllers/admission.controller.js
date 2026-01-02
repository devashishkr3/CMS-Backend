const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { logAudit } = require('../utils/auditLogger');
const { 
  createAdmission, 
  updateAdmissionStatus, 
  createAdmissionWindow,
  updateAdmissionWindow
} = require('../validation/admission.validation');

/**
 * Create a new admission
 * Access: ADMIN, HOD
 */
exports.createAdmission = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createAdmission.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { studentId, courseId } = value;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    // Check if student is already admitted to this course
    const existingAdmission = await prisma.admission.findFirst({
      where: {
        studentId,
        courseId
      }
    });

    if (existingAdmission) {
      return next(new AppError('Student is already admitted to this course', 400));
    }

    // Create admission
    const admission = await prisma.admission.create({
      data: {
        studentId,
        courseId,
        status: 'INITIATED'
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'CREATE_ADMISSION',
      entity: 'Admission',
      entityId: admission.id,
      payload: { studentId, courseId },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Admission created successfully',
      data: {
        admission
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all admissions with filtering options
 * Access: ADMIN, HOD
 */
exports.getAllAdmissions = async (req, res, next) => {
  try {
    const { status, courseId, studentId } = req.query;
    
    // Build where clause
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (courseId) {
      where.courseId = courseId;
    }
    
    if (studentId) {
      where.studentId = studentId;
    }

    // Get admissions
    const admissions = await prisma.admission.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        history: {
          include: {
            changedBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            changedAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: admissions.length,
      data: {
        admissions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get admission by ID
 * Access: ADMIN, HOD
 */
exports.getAdmission = async (req, res, next) => {
  try {
    const { id } = req.params;

    const admission = await prisma.admission.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true,
            phone: true,
            address: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            durationYears: true
          }
        },
        history: {
          include: {
            changedBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            changedAt: 'desc'
          }
        },
        payments: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            receiptNo: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!admission) {
      return next(new AppError('Admission not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        admission
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update admission status with lifecycle enforcement
 * Access: ADMIN, HOD
 */
exports.updateAdmissionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = updateAdmissionStatus.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { status, notes } = value;

    // Get current admission
    const admission = await prisma.admission.findUnique({
      where: { id }
    });

    if (!admission) {
      return next(new AppError('Admission not found', 404));
    }

    // Validate status transition
    const validTransitions = {
      'INITIATED': ['PAYMENT_PENDING', 'CANCELLED'],
      'PAYMENT_PENDING': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': [],
      'CANCELLED': []
    };

    // Check if current status allows transition to new status
    const allowedTransitions = validTransitions[admission.status] || [];
    
    if (!allowedTransitions.includes(status)) {
      return next(new AppError(
        `Invalid status transition from ${admission.status} to ${status}`, 
        400
      ));
    }

    // CANCELLED cannot be changed again
    if (admission.status === 'CANCELLED') {
      return next(new AppError('Cancelled admissions cannot be modified', 400));
    }

    // Update admission status
    const updatedAdmission = await prisma.admission.update({
      where: { id },
      data: { 
        status,
        history: {
          create: {
            fromStatus: admission.status,
            toStatus: status,
            changedById: req.user.id,
            notes: notes || null
          }
        }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        history: {
          include: {
            changedBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            changedAt: 'desc'
          }
        }
      }
    });

    // If admission is confirmed, create student record and assign semester 1
    if (status === 'CONFIRMED') {
      // Check if student record already exists for this admission
      const existingStudentRecord = await prisma.student.findUnique({
        where: { id: admission.studentId }
      });

      if (existingStudentRecord && existingStudentRecord.status === 'ACTIVE') {
        // Student already exists and is active, no need to create
      } else if (existingStudentRecord) {
        // Update student status to ACTIVE
        await prisma.student.update({
          where: { id: admission.studentId },
          data: { status: 'ACTIVE' }
        });
      }
      
      // Find semester 1 for the course
      const semester1 = await prisma.semester.findFirst({
        where: {
          courseId: admission.courseId,
          number: 1
        }
      });
      
      if (semester1) {
        // Check if student is already assigned to semester 1
        const existingSemesterAssignment = await prisma.studentSemester.findUnique({
          where: {
            studentId_semesterId: {
              studentId: admission.studentId,
              semesterId: semester1.id
            }
          }
        });
        
        // Check if student already has an ongoing semester
        const ongoingSemester = await prisma.studentSemester.findFirst({
          where: {
            studentId: admission.studentId,
            status: 'ONGOING'
          }
        });
        
        if (!existingSemesterAssignment && !ongoingSemester) {
          // Auto-assign student to semester 1
          await prisma.studentSemester.create({
            data: {
              studentId: admission.studentId,
              semesterId: semester1.id,
              status: 'ONGOING',
              feePaid: false,
              startDate: new Date(),
              endDate: null // Will be set when semester completes
            }
          });
          
          // Log audit entry for semester assignment
          await logAudit({
            userId: req.user.id,
            action: 'SEMESTER_AUTO_ASSIGNMENT',
            entity: 'StudentSemester',
            entityId: admission.studentId,
            payload: { 
              studentId: admission.studentId, 
              semesterId: semester1.id,
              reason: 'Admission confirmed - auto assigned to semester 1'
            },
            req
          });
        } else if (ongoingSemester) {
          // Student already has an ongoing semester, no need to assign semester 1
          // This could happen if the student was manually assigned to a semester before admission confirmation
          console.log(`Student ${admission.studentId} already has an ongoing semester ${ongoingSemester.semesterId}, skipping semester 1 assignment`);
        }
      }
    }

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_ADMISSION_STATUS',
      entity: 'Admission',
      entityId: id,
      payload: { fromStatus: admission.status, toStatus: status, notes },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Admission status updated successfully',
      data: {
        admission: updatedAdmission
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create admission window
 * Access: ADMIN
 */
exports.createAdmissionWindow = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createAdmissionWindow.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { title, courseId, departmentId, startDate, endDate } = value;

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });

    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    // Check if admission window already exists for this course and department
    const existingWindow = await prisma.admissionWindow.findFirst({
      where: {
        courseId,
        departmentId,
        endDate: {
          gte: new Date()
        }
      }
    });

    if (existingWindow) {
      return next(new AppError('An active admission window already exists for this course and department', 400));
    }

    // Create admission window
    const admissionWindow = await prisma.admissionWindow.create({
      data: {
        title,
        courseId,
        departmentId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        enabled: false // Default to disabled, needs to be enabled separately
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'CREATE_ADMISSION_WINDOW',
      entity: 'AdmissionWindow',
      entityId: admissionWindow.id,
      payload: { title, courseId, departmentId, startDate, endDate },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Admission window created successfully',
      data: {
        admissionWindow
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all admission windows with filtering options
 * Access: ADMIN, HOD
 */
exports.getAllAdmissionWindows = async (req, res, next) => {
  try {
    const { courseId, departmentId, enabled } = req.query;
    
    // Build where clause
    const where = {};
    
    if (courseId) {
      where.courseId = courseId;
    }
    
    if (departmentId) {
      where.departmentId = departmentId;
    }
    
    if (enabled !== undefined) {
      where.enabled = enabled === 'true';
    }

    // Get admission windows
    const admissionWindows = await prisma.admissionWindow.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: admissionWindows.length,
      data: {
        admissionWindows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get admission window by ID
 * Access: ADMIN, HOD
 */
exports.getAdmissionWindow = async (req, res, next) => {
  try {
    const { id } = req.params;

    const admissionWindow = await prisma.admissionWindow.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            durationYears: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!admissionWindow) {
      return next(new AppError('Admission window not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        admissionWindow
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update admission window
 * Access: ADMIN
 */
exports.updateAdmissionWindow = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = updateAdmissionWindow.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    // Check if admission window exists
    const admissionWindow = await prisma.admissionWindow.findUnique({
      where: { id }
    });

    if (!admissionWindow) {
      return next(new AppError('Admission window not found', 404));
    }

    const { title, startDate, endDate, enabled } = value;

    // Update admission window
    const updatedWindow = await prisma.admissionWindow.update({
      where: { id },
      data: {
        title: title || admissionWindow.title,
        startDate: startDate ? new Date(startDate) : admissionWindow.startDate,
        endDate: endDate ? new Date(endDate) : admissionWindow.endDate,
        enabled: enabled !== undefined ? enabled : admissionWindow.enabled
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_ADMISSION_WINDOW',
      entity: 'AdmissionWindow',
      entityId: id,
      payload: { title, startDate, endDate, enabled },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Admission window updated successfully',
      data: {
        admissionWindow: updatedWindow
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete admission window
 * Access: ADMIN
 */
exports.deleteAdmissionWindow = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if admission window exists
    const admissionWindow = await prisma.admissionWindow.findUnique({
      where: { id }
    });

    if (!admissionWindow) {
      return next(new AppError('Admission window not found', 404));
    }

    // Delete admission window
    await prisma.admissionWindow.delete({
      where: { id }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_ADMISSION_WINDOW',
      entity: 'AdmissionWindow',
      entityId: id,
      payload: { title: admissionWindow.title },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Admission window deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};