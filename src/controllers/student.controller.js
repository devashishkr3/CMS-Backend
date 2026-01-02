const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const Joi = require('joi');
const { logAudit } = require('../utils/auditLogger');
const { createStudent, updateStudent, assignSemester } = require('../validation/student.validation');

/**
 * Create a new student
 * Access: ADMIN, HOD
 */
exports.createStudent = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createStudent.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { name, email, phone, dob, fatherName, gender, category, address, courseId, sessionId } = value;

    // Check if student with this email already exists
    const existingStudentByEmail = await prisma.student.findUnique({
      where: { email }
    });

    if (existingStudentByEmail) {
      return next(new AppError('Student with this email already exists', 400));
    }



    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    // Check if session is associated with the course through CourseSession model
    const courseSession = await prisma.courseSession.findUnique({
      where: {
        courseId_sessionId: {
          courseId,
          sessionId
        }
      }
    });
    
    if (!courseSession) {
      return next(new AppError('Session does not belong to the specified course', 400));
    }

    // Generate registration number (simplified - in real implementation this would be more complex)
    const reg_no = `REG${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Generate UAN (University Acknowledgement Number) - simplified
    const uan_no = `UAN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create student
    const student = await prisma.student.create({
      data: {
        reg_no,
        email,
        uan_no,
        name,
        phone,
        dob: dob ? new Date(dob) : undefined,
        fatherName,
        gender,
        category,
        address,
        courseId,
        sessionId,
        status: 'ACTIVE'
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'CREATE_STUDENT',
      entity: 'Student',
      entityId: student.id,
      payload: { name, email, phone, courseId, sessionId },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Student created successfully',
      data: {
        student
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all students with filtering options
 * Access: ADMIN, HOD
 */
exports.getAllStudents = async (req, res, next) => {
  try {
    const { status, courseId, sessionId, search } = req.query;
    
    // Build where clause
    const where = { isDeleted: false };
    
    if (status) {
      where.status = status;
    }
    
    if (courseId) {
      where.courseId = courseId;
    }
    
    if (sessionId) {
      where.sessionId = sessionId;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { reg_no: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get students
    const students = await prisma.student.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: students.length,
      data: {
        students
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student by ID
 * Access: ADMIN, HOD, STUDENT (own record)
 */
exports.getStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    // For STUDENT role, only allow access to own record
    if (req.user.role === 'STUDENT' && req.user.id !== id) {
      return next(new AppError('You do not have permission to access this resource', 403));
    }

    const student = await prisma.student.findUnique({
      where: { 
        id,
        isDeleted: false
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            durationYears: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true
          }
        },
        semesters: {
          include: {
            semester: {
              select: {
                id: true,
                number: true
              }
            }
          },
          orderBy: {
            startDate: 'asc'
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
        },
        certificates: {
          select: {
            id: true,
            type: true,
            status: true,
            issuedAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        documents: {
          select: {
            id: true,
            type: true,
            verified: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        admissions: {
          select: {
            id: true,
            status: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        student
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update student
 * Access: ADMIN, HOD
 */
exports.updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = updateStudent.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Update student
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        ...value,
        dob: value.dob ? new Date(value.dob) : undefined,
        uan_no: undefined // Prevent updating UAN as it's unique and should not change
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_STUDENT',
      entity: 'Student',
      entityId: id,
      payload: value,
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Student updated successfully',
      data: {
        student: updatedStudent
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete student (soft delete)
 * Access: ADMIN
 */
exports.deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Mark student as deleted (soft delete approach)
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        isDeleted: true
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_STUDENT',
      entity: 'Student',
      entityId: id,
      payload: { status: 'DROPOUT' },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Student deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign semester to student
 * Access: ADMIN, HOD
 */
exports.assignSemester = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = assignSemester.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { semesterId, startDate, endDate } = value;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Check if semester exists
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });

    if (!semester) {
      return next(new AppError('Semester not found', 404));
    }

    // Check if semester belongs to student's course
    if (semester.courseId !== student.courseId) {
      return next(new AppError('Semester does not belong to student\'s course', 400));
    }

    // Check if student is already assigned to this semester
    const existingAssignment = await prisma.studentSemester.findFirst({
      where: {
        studentId: id,
        semesterId
      }
    });

    if (existingAssignment) {
      return next(new AppError('Student is already assigned to this semester', 400));
    }
    
    // Check if student already has an ongoing semester (only one active semester allowed)
    const ongoingSemester = await prisma.studentSemester.findFirst({
      where: {
        studentId: id,
        status: 'ONGOING'
      }
    });
    
    if (ongoingSemester && startDate <= ongoingSemester.startDate) {
      return next(new AppError('Student already has an ongoing semester. Cannot assign earlier semester.', 400));
    }

    // Create student semester assignment
    const studentSemester = await prisma.studentSemester.create({
      data: {
        studentId: id,
        semesterId,
        status: 'ONGOING',
        feePaid: false,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined
      },
      include: {
        semester: {
          select: {
            id: true,
            number: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'ASSIGN_SEMESTER_TO_STUDENT',
      entity: 'StudentSemester',
      entityId: studentSemester.id,
      payload: { studentId: id, semesterId, startDate, endDate },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Semester assigned to student successfully',
      data: {
        studentSemester
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update student semester status
 * Access: ADMIN, HOD
 */
exports.updateStudentSemesterStatus = async (req, res, next) => {
  try {
    const { studentId, semesterId } = req.params;
    const { status, feePaid } = req.body;

    // Validate status
    const validStatuses = ['ONGOING', 'COMPLETED', 'FAILED', 'PROMOTED'];
    if (status && !validStatuses.includes(status)) {
      return next(new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400));
    }

    // Check if student semester assignment exists
    const studentSemester = await prisma.studentSemester.findUnique({
      where: {
        studentId_semesterId: {
          studentId,
          semesterId
        }
      }
    });

    if (!studentSemester) {
      return next(new AppError('Student semester assignment not found', 404));
    }

    // Update student semester
    const updatedStudentSemester = await prisma.studentSemester.update({
      where: {
        studentId_semesterId: {
          studentId,
          semesterId
        }
      },
      data: {
        status: status || studentSemester.status,
        feePaid: feePaid !== undefined ? feePaid : studentSemester.feePaid
      },
      include: {
        semester: {
          select: {
            id: true,
            number: true
          }
        },
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_STUDENT_SEMESTER_STATUS',
      entity: 'StudentSemester',
      entityId: studentSemester.id,
      payload: { status, feePaid },
      req
    });
    
    // Find the current semester to get the course
    const currentSemester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });
    
    // If status is COMPLETED, auto-promote student to next semester
    if (status === 'COMPLETED') {
      
      if (currentSemester) {
        // Find the next semester in the same course
        const nextSemester = await prisma.semester.findFirst({
          where: {
            courseId: currentSemester.courseId,
            number: currentSemester.number + 1
          },
          orderBy: {
            number: 'asc'
          }
        });
        
        if (nextSemester) {
          // Check if student is already assigned to the next semester
          const existingNextSemesterAssignment = await prisma.studentSemester.findUnique({
            where: {
              studentId_semesterId: {
                studentId,
                semesterId: nextSemester.id
              }
            }
          });
          
          if (!existingNextSemesterAssignment) {
            // Auto-assign student to the next semester
            await prisma.studentSemester.create({
              data: {
                studentId,
                semesterId: nextSemester.id,
                status: 'ONGOING',
                feePaid: false,
                startDate: new Date(),
                endDate: null // Will be set when semester completes
              }
            });
            
            // Log audit entry for promotion
            await logAudit({
              userId: req.user.id,
              action: 'SEMESTER_AUTO_PROMOTION',
              entity: 'StudentSemester',
              entityId: studentId,
              payload: { 
                studentId, 
                semesterId: nextSemester.id,
                reason: `Auto-promoted from semester ${currentSemester.number} to ${currentSemester.number + 1}`
              },
              req
            });
          }
        } else {
          // If no next semester exists, student has completed the course
          // Update student status to PASSED_OUT
          await prisma.student.update({
            where: { id: studentId },
            data: { status: 'PASSED_OUT' }
          });
          
          // Log audit entry for course completion
          await logAudit({
            userId: req.user.id,
            action: 'STUDENT_COURSE_COMPLETION',
            entity: 'Student',
            entityId: studentId,
            payload: { 
              studentId, 
              reason: `Student completed all semesters for course ${currentSemester.courseId}`
            },
            req
          });
        }
      }
    } else if (status === 'FAILED') {
      // If status is FAILED, ensure no auto-promotion happens
      // Student needs to repeat the semester or be detained
      // No automatic next semester assignment
      
      // Log audit entry for failure
      await logAudit({
        userId: req.user.id,
        action: 'SEMESTER_FAILED',
        entity: 'StudentSemester',
        entityId: studentSemester.id,
        payload: { 
          studentId, 
          semesterId,
          reason: `Student failed semester ${currentSemester ? currentSemester.number : 'unknown'}`
        },
        req
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Student semester status updated successfully',
      data: {
        studentSemester: updatedStudentSemester
      }
    });
  } catch (error) {
    next(error);
  }
};
