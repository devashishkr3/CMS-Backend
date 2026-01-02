const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { logAudit } = require('../utils/auditLogger');
const { 
  createStudentSubject,
  updateStudentSubject,
  filterStudentSubjects
} = require('../validation/studentSubject.validation');

/**
 * Create a new student subject assignment (subject selection for semester)
 * Access: ADMIN, HOD, STUDENT (for self)
 */
exports.createStudentSubject = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createStudentSubject.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { studentId, subjectId, semesterId } = value;

    // For STUDENT role, only allow creating assignments for themselves
    if (req.user.role === 'STUDENT' && req.user.id !== studentId) {
      return next(new AppError('You can only select subjects for yourself', 403));
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Check if subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId }
    });

    if (!subject) {
      return next(new AppError('Subject not found', 404));
    }

    // Check if semester exists
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });

    if (!semester) {
      return next(new AppError('Semester not found', 404));
    }

    // Verify that subject belongs to the semester
    if (subject.semesterId !== semesterId) {
      return next(new AppError('Subject does not belong to the specified semester', 400));
    }

    // Verify that semester belongs to student's course
    if (semester.courseId !== student.courseId) {
      return next(new AppError('Semester does not belong to student\'s course', 400));
    }

    // Check if student is enrolled in this semester
    const studentSemester = await prisma.studentSemester.findUnique({
      where: {
        studentId_semesterId: {
          studentId,
          semesterId
        }
      }
    });

    if (!studentSemester) {
      return next(new AppError('Student is not enrolled in this semester', 400));
    }

    // Check if student is already assigned to this subject in this semester
    const existingAssignment = await prisma.studentSubject.findUnique({
      where: {
        studentId_subjectId_semesterId: {
          studentId,
          subjectId,
          semesterId
        }
      }
    });

    if (existingAssignment) {
      return next(new AppError('Student is already assigned to this subject in this semester', 400));
    }

    // Check if student has already selected a subject of the same type in this semester
    if (subject.type === 'MJC' || subject.type === 'MIC' || subject.type === 'MDC') {
      const existingSameType = await prisma.studentSubject.findFirst({
        where: {
          studentId,
          semesterId,
          subject: {
            type: subject.type
          }
        }
      });

      if (existingSameType) {
        return next(new AppError(`Student has already selected a ${subject.type} subject in this semester`, 400));
      }
    }

    // Create student subject assignment
    const studentSubject = await prisma.studentSubject.create({
      data: {
        studentId,
        subjectId,
        semesterId
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true
          }
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        },
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
      action: 'CREATE_STUDENT_SUBJECT',
      entity: 'StudentSubject',
      entityId: studentSubject.id,
      payload: { studentId, subjectId, semesterId },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Student subject assignment created successfully',
      data: {
        studentSubject
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all student subject assignments with filtering options
 * Access: ADMIN, HOD, STUDENT (own records only)
 */
exports.getAllStudentSubjects = async (req, res, next) => {
  try {
    // Validate query parameters
    const { error, value } = filterStudentSubjects.validate(req.query);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { studentId, subjectId, semesterId, type } = value;

    // Build where clause
    const where = {};

    // For STUDENT role, only allow accessing own records
    if (req.user.role === 'STUDENT') {
      where.studentId = req.user.id;
    } else if (studentId) {
      where.studentId = studentId;
    }

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (semesterId) {
      where.semesterId = semesterId;
    }

    if (type) {
      where.subject = {
        type
      };
    }

    // Get student subject assignments
    const studentSubjects = await prisma.studentSubject.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true
          }
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        },
        semester: {
          select: {
            id: true,
            number: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: studentSubjects.length,
      data: {
        studentSubjects
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student subject assignment by ID
 * Access: ADMIN, HOD, STUDENT (own record only)
 */
exports.getStudentSubject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const studentSubject = await prisma.studentSubject.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true
          }
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        },
        semester: {
          select: {
            id: true,
            number: true
          }
        }
      }
    });

    if (!studentSubject) {
      return next(new AppError('Student subject assignment not found', 404));
    }

    // For STUDENT role, only allow accessing own record
    if (req.user.role === 'STUDENT' && req.user.id !== studentSubject.studentId) {
      return next(new AppError('You do not have permission to access this resource', 403));
    }

    res.status(200).json({
      status: 'success',
      data: {
        studentSubject
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete student subject assignment
 * Access: ADMIN, HOD, STUDENT (own record only, only if semester is not started or ongoing)
 */
exports.deleteStudentSubject = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get current student subject assignment
    const studentSubject = await prisma.studentSubject.findUnique({
      where: { id }
    });

    if (!studentSubject) {
      return next(new AppError('Student subject assignment not found', 404));
    }

    // For STUDENT role, only allow deleting own assignments
    if (req.user.role === 'STUDENT') {
      if (req.user.id !== studentSubject.studentId) {
        return next(new AppError('You can only delete your own subject assignments', 403));
      }

      // Check if semester has started and is ongoing/failed/completed
      const studentSemester = await prisma.studentSemester.findUnique({
        where: {
          studentId_semesterId: {
            studentId: studentSubject.studentId,
            semesterId: studentSubject.semesterId
          }
        }
      });

      if (studentSemester && studentSemester.status !== 'ONGOING') {
        return next(new AppError('Cannot delete subject assignment after semester status is changed', 400));
      }
    }

    // Delete student subject assignment
    await prisma.studentSubject.delete({
      where: { id }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_STUDENT_SUBJECT',
      entity: 'StudentSubject',
      entityId: id,
      payload: { studentId: studentSubject.studentId, subjectId: studentSubject.subjectId },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Student subject assignment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student's subjects for a specific semester
 * Access: ADMIN, HOD, STUDENT (own records only)
 */
exports.getStudentSubjectsForSemester = async (req, res, next) => {
  try {
    const { studentId, semesterId } = req.params;

    // For STUDENT role, only allow accessing own records
    if (req.user.role === 'STUDENT' && req.user.id !== studentId) {
      return next(new AppError('You do not have permission to access this resource', 403));
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId }
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

    // Get student's subjects for the semester
    const studentSubjects = await prisma.studentSubject.findMany({
      where: {
        studentId,
        semesterId
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
      },
      orderBy: {
        subject: {
          type: 'asc'
        }
      }
    });

    res.status(200).json({
      status: 'success',
      results: studentSubjects.length,
      data: {
        studentSubjects
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk assign subjects to a student for a semester
 * Access: ADMIN, HOD
 */
exports.bulkAssignSubjects = async (req, res, next) => {
  try {
    const { studentId, semesterId, subjectIds } = req.body;

    // Validate input
    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return next(new AppError('Subject IDs array is required and cannot be empty', 400));
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId }
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

    // Check if student is enrolled in this semester
    const studentSemester = await prisma.studentSemester.findUnique({
      where: {
        studentId_semesterId: {
          studentId,
          semesterId
        }
      }
    });

    if (!studentSemester) {
      return next(new AppError('Student is not enrolled in this semester', 400));
    }

    // Get all subjects to verify they exist and belong to the semester
    const subjects = await prisma.subject.findMany({
      where: {
        id: {
          in: subjectIds
        },
        semesterId
      }
    });

    if (subjects.length !== subjectIds.length) {
      return next(new AppError('One or more subjects do not exist or do not belong to the specified semester', 400));
    }

    // Check for duplicate subject types (MJC, MIC, MDC should be unique per semester)
    const subjectTypes = subjects.map(s => s.type);
    const uniqueTypes = [...new Set(subjectTypes)];
    
    // Check for duplicate major/minor/core subjects
    const mjcCount = subjectTypes.filter(type => type === 'MJC').length;
    const micCount = subjectTypes.filter(type => type === 'MIC').length;
    const mdcCount = subjectTypes.filter(type => type === 'MDC').length;
    
    if (mjcCount > 1 || micCount > 1 || mdcCount > 1) {
      return next(new AppError('Cannot assign multiple subjects of the same type (MJC, MIC, MDC) to the same semester', 400));
    }

    // Check for existing assignments
    const existingAssignments = await prisma.studentSubject.findMany({
      where: {
        studentId,
        semesterId,
        subjectId: {
          in: subjectIds
        }
      }
    });

    if (existingAssignments.length > 0) {
      return next(new AppError('One or more subjects are already assigned to this student for this semester', 400));
    }

    // Create all assignments in a transaction
    const assignments = await prisma.$transaction(
      subjectIds.map(subjectId => 
        prisma.studentSubject.create({
          data: {
            studentId,
            subjectId,
            semesterId
          }
        })
      )
    );

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'BULK_ASSIGN_SUBJECTS',
      entity: 'StudentSubject',
      entityId: studentId,
      payload: { studentId, semesterId, subjectIds, count: assignments.length },
      req
    });

    res.status(201).json({
      status: 'success',
      message: `${assignments.length} subjects assigned to student successfully`,
      data: {
        assignments
      }
    });
  } catch (error) {
    next(error);
  }
};