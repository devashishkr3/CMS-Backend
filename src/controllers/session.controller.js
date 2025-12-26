const prisma = require('../config/prisma');
const AppError = require('../utils/error');

/**
 * Create a new session
 */
exports.createSession = async (req, res, next) => {
  try {
    const { name, startYear, endYear, courseId } = req.body;

    // Validate course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    // Check if session name already exists
    const existingSession = await prisma.session.findFirst({
      where: { name }
    });

    if (existingSession) {
      return next(new AppError('Session with this name already exists', 409));
    }

    // Check if the year range already exists for this course
    const existingYearRange = await prisma.session.findFirst({
      where: {
        courseId,
        startYear,
        endYear
      }
    });

    if (existingYearRange) {
      return next(new AppError('A session with this year range already exists for this course', 409));
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        name,
        startYear,
        endYear,
        courseId
      },
      include: {
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
        action: 'CREATE_SESSION',
        entity: 'Session',
        entityId: session.id,
        payload: JSON.stringify({ name, startYear, endYear, courseId })
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Session created successfully',
      data: {
        session
      }
    });
  } catch (error) {
    // Handle Prisma errors specifically
    if (error.code === 'P2002') {
      // Unique constraint violation
      return next(new AppError('A session with this name or year range already exists', 409));
    }
    
    if (error.code === 'P2003') {
      // Foreign key constraint violation
      return next(new AppError('Referenced course does not exist', 400));
    }
    
    // This error handling is too broad and catches unrelated errors
    // It has been removed to allow more specific error handling above
    
    next(error);
  }
};

/**
 * Get all sessions
 */
exports.getAllSessions = async (req, res, next) => {
  try {
    const { courseId, search } = req.query;

    // Build filter object
    let whereClause = {};
    
    if (courseId) {
      whereClause.courseId = courseId;
    }

    if (search) {
      whereClause.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        students: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
          },
          take: 10 // Limit to first 10 students for performance
        }
      },
      orderBy: {
        startYear: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: sessions.length,
      data: {
        sessions
      }
    });
  } catch (error) {
    // Handle Prisma errors
    if (error.code === 'P2025') {
      // Record not found
      return next(new AppError('Sessions not found', 404));
    }
    
    if (error.message && error.message.includes('findMany')) {
      // Handle cases where Prisma findMany operation fails
      return next(new AppError('Failed to retrieve sessions', 400));
    }
    
    next(error);
  }
};

/**
 * Get session by ID
 */
exports.getSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        students: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true,
            status: true
          }
        }
      }
    });

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        session
      }
    });
  } catch (error) {
    // Handle Prisma errors
    if (error.code === 'P2025') {
      // Record not found
      return next(new AppError('Session not found', 404));
    }
    
    // The P2025 error code is already handled above
    
    next(error);
  }
};

/**
 * Update session
 */
exports.updateSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, startYear, endYear, courseId } = req.body;

    // Validate that at least one field is provided for update
    if (!name && startYear === undefined && endYear === undefined && !courseId) {
      return next(new AppError('At least one field must be provided for update: name, startYear, endYear, or courseId', 400));
    }

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    // Validate course exists if courseId is provided
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId }
      });

      if (!course) {
        return next(new AppError('Course not found', 404));
      }
    }

    // Check if session name already exists (excluding current session)
    if (name && name !== session.name) {
      const existingSession = await prisma.session.findFirst({
        where: { name }
      });

      if (existingSession) {
        return next(new AppError('Session with this name already exists', 409));
      }
    }

    // Check if the year range already exists for this course (excluding current session)
    if ((startYear !== undefined && startYear !== session.startYear) || 
        (endYear !== undefined && endYear !== session.endYear) || 
        (courseId && courseId !== session.courseId)) {
      const existingYearRange = await prisma.session.findFirst({
        where: {
          courseId: courseId || session.courseId,
          startYear: startYear !== undefined ? startYear : session.startYear,
          endYear: endYear !== undefined ? endYear : session.endYear,
          id: {
            not: id
          }
        }
      });

      if (existingYearRange) {
        return next(new AppError('A session with this year range already exists for this course', 409));
      }
    }

    // Update session
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        name: name || session.name,
        startYear: startYear !== undefined ? startYear : session.startYear,
        endYear: endYear !== undefined ? endYear : session.endYear,
        courseId: courseId || session.courseId
      },
      include: {
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
        action: 'UPDATE_SESSION',
        entity: 'Session',
        entityId: id,
        payload: JSON.stringify({ name, startYear, endYear, courseId })
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Session updated successfully',
      data: {
        session: updatedSession
      }
    });
  } catch (error) {
    // Handle Prisma errors specifically
    if (error.code === 'P2002') {
      // Unique constraint violation
      return next(new AppError('A session with this name or year range already exists', 409));
    }
    
    if (error.code === 'P2003') {
      // Foreign key constraint violation
      return next(new AppError('Referenced course does not exist', 400));
    }
    
    // Handle Prisma errors specifically
    if (error.code === 'P2002') {
      // Unique constraint violation
      return next(new AppError('A session with this name or year range already exists', 409));
    }
    
    if (error.code === 'P2003') {
      // Foreign key constraint violation
      return next(new AppError('Referenced course does not exist', 400));
    }
    
    next(error);
  }
};

/**
 * Delete session
 */
exports.deleteSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        students: true
      }
    });

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    // Check if session has students assigned to it
    if (session.students.length > 0) {
      return next(new AppError('Cannot delete session with students assigned to it', 400));
    }

    // Delete session
    await prisma.session.delete({
      where: { id }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_SESSION',
        entity: 'Session',
        entityId: id,
        payload: JSON.stringify({ name: session.name, startYear: session.startYear, endYear: session.endYear })
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Session deleted successfully',
      data: null
    });
  } catch (error) {
    // Handle Prisma errors specifically
    if (error.code === 'P2025') {
      // Record to delete does not exist
      return next(new AppError('Session not found', 404));
    }
    
    if (error.code === 'P2006') {
      // Record has dependencies and cannot be deleted
      return next(new AppError('Cannot delete session with associated students', 400));
    }
    
    next(error);
  }
};

/**
 * Get sessions by course
 */
exports.getSessionsByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // Validate course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    const sessions = await prisma.session.findMany({
      where: {
        courseId
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        students: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
          },
          take: 10 // Limit to first 10 students for performance
        }
      },
      orderBy: {
        startYear: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: sessions.length,
      data: {
        sessions
      }
    });
  } catch (error) {
    // Handle Prisma errors
    if (error.code === 'P2025') {
      // Record not found
      return next(new AppError('Course not found', 404));
    }
    
    if (error.message && error.message.includes('findMany')) {
      // Handle cases where Prisma findMany operation fails
      return next(new AppError('Failed to retrieve sessions', 400));
    }
    
    next(error);
  }
};