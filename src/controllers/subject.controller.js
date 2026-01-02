const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { createSubject, updateSubject } = require('../validation/subject.validation');

/**
 * Create a new subject
 * Access: ADMIN
 */
exports.createSubject = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createSubject.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { name, code, type, semesterId, courseId } = value;

    // Check if semester exists
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });

    if (!semester) {
      return next(new AppError('Semester not found', 404));
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    // Verify that semester belongs to the course
    if (semester.courseId !== courseId) {
      return next(new AppError('Semester does not belong to the specified course', 400));
    }

    // Check if subject with this name already exists in this course
    const existingSubject = await prisma.subject.findFirst({
      where: { 
        name,
        courseId
      }
    });

    if (existingSubject) {
      return next(new AppError('Subject with this name already exists in this course', 400));
    }

    // Check if subject with this code already exists in this course
    const existingSubjectByCode = await prisma.subject.findFirst({
      where: { 
        code,
        courseId
      }
    });

    if (existingSubjectByCode) {
      return next(new AppError('Subject with this code already exists in this course', 400));
    }

    // Create subject
    const subject = await prisma.subject.create({
      data: {
        name,
        code,
        type,
        // credit,
        semesterId,
        courseId
      },
      include: {
        semester: {
          select: {
            id: true,
            number: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        StudentSubject: {
          select: {
            id: true,
            student: {
              select: {
                id: true,
                name: true,
                reg_no: true
              }
            }
          }
        }
      }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_SUBJECT',
        entity: 'Subject',
        entityId: subject.id,
        payload: JSON.stringify({ name, code, type, credit: undefined, semesterId, courseId })
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Subject created successfully',
      data: {
        subject
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all subjects with filtering options
 * Access: ADMIN, HOD
 */
exports.getAllSubjects = async (req, res, next) => {
  try {
    const { courseId, semesterId, type } = req.query;
    
    // Build where clause
    const where = {};
    
    if (courseId) {
      where.courseId = courseId;
    }
    
    if (semesterId) {
      where.semesterId = semesterId;
    }
    
    if (type) {
      where.type = type;
    }

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        semester: {
          select: {
            id: true,
            number: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        StudentSubject: {
          select: {
            id: true,
            student: {
              select: {
                id: true,
                name: true,
                reg_no: true
              }
            }
          },
          take: 5 // Limit to first 5 student assignments for performance
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: subjects.length,
      data: {
        subjects
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subject by ID
 * Access: ADMIN, HOD
 */
exports.getSubject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        semester: {
          select: {
            id: true,
            number: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        StudentSubject: {
          select: {
            id: true,
            student: {
              select: {
                id: true,
                name: true,
                reg_no: true
              }
            }
          }
        }
      }
    });

    if (!subject) {
      return next(new AppError('Subject not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        subject
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update subject
 * Access: ADMIN
 */
exports.updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = updateSubject.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    // Check if subject exists
    const subject = await prisma.subject.findUnique({
      where: { id }
    });

    if (!subject) {
      return next(new AppError('Subject not found', 404));
    }

    const { name, code, type, credit, semesterId, courseId } = value;

    // Check if semester exists (if provided)
    if (semesterId) {
      const semester = await prisma.semester.findUnique({
        where: { id: semesterId }
      });

      if (!semester) {
        return next(new AppError('Semester not found', 404));
      }
    }

    // Check if course exists (if provided)
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId }
      });

      if (!course) {
        return next(new AppError('Course not found', 404));
      }
    }

    // Verify that semester belongs to the course (if both are provided)
    if (semesterId && courseId) {
      const semester = await prisma.semester.findUnique({
        where: { id: semesterId }
      });

      if (semester && semester.courseId !== courseId) {
        return next(new AppError('Semester does not belong to the specified course', 400));
      }
    }

    // Check if another subject with this name already exists in this course
    if (name && name !== subject.name) {
      const courseIdToCheck = courseId || subject.courseId;
      const existingSubject = await prisma.subject.findFirst({
        where: { 
          name,
          courseId: courseIdToCheck,
          NOT: { id }
        }
      });

      if (existingSubject) {
        return next(new AppError('Subject with this name already exists in this course', 400));
      }
    }

    // Check if another subject with this code already exists in this course
    if (code && code !== subject.code) {
      const courseIdToCheck = courseId || subject.courseId;
      const existingSubjectByCode = await prisma.subject.findFirst({
        where: { 
          code,
          courseId: courseIdToCheck,
          NOT: { id }
        }
      });

      if (existingSubjectByCode) {
        return next(new AppError('Subject with this code already exists in this course', 400));
      }
    }

    // Update subject
    const updatedSubject = await prisma.subject.update({
      where: { id },
      data: {
        name: name || subject.name,
        code: code || subject.code,
        type: type !== undefined ? type : subject.type,
        credit: credit || subject.credit,
        semesterId: semesterId || subject.semesterId,
        courseId: courseId || subject.courseId
      },
      include: {
        semester: {
          select: {
            id: true,
            number: true
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
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_SUBJECT',
        entity: 'Subject',
        entityId: id,
        payload: JSON.stringify(value)
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Subject updated successfully',
      data: {
        subject: updatedSubject
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete subject
 * Access: ADMIN
 */
exports.deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if subject exists
    const subject = await prisma.subject.findUnique({
      where: { id }
    });

    if (!subject) {
      return next(new AppError('Subject not found', 404));
    }

    // Check if subject is assigned to any students
    const studentSubjectCount = await prisma.studentSubject.count({
      where: {
        subjectId: id
      }
    });

    if (studentSubjectCount > 0) {
      return next(new AppError('Cannot delete subject as it is assigned to one or more students', 400));
    }

    // Delete subject
    await prisma.subject.delete({
      where: { id }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_SUBJECT',
        entity: 'Subject',
        entityId: id,
        payload: JSON.stringify({ name: subject.name, code: subject.code, type: subject.type })
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Subject deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};