const prisma = require('../config/prisma');
const AppError = require('../utils/error');

/**
 * Create a new session
 */
exports.createSession = async (req, res, next) => {
  try {
    const { name, startYear, endYear } = req.body;

    // Check if session name already exists
    const existingSession = await prisma.session.findFirst({
      where: { name }
    });

    if (existingSession) {
      return next(new AppError('Session with this name already exists', 409));
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        name,
        startYear,
        endYear
      }
    });

    // If courseId is provided, create the association
    if (courseId) {
      // Validate course exists
      const course = await prisma.course.findUnique({
        where: { id: courseId }
      });

      if (!course) {
        return next(new AppError('Course not found', 404));
      }
      
      // Create the association between session and course
      await prisma.courseSession.create({
        data: {
          sessionId: session.id,
          courseId: courseId
        }
      });
      
      // Fetch the session with course data for response
      const sessionWithCourse = await prisma.session.findUnique({
        where: { id: session.id },
        include: {
          courses: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  code: true
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
          session: sessionWithCourse
        }
      });
      return;
    }
    
    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_SESSION',
        entity: 'Session',
        entityId: session.id,
        payload: JSON.stringify({ name, startYear, endYear })
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
      whereClause = {
        courses: {
          some: {
            courseId: courseId
          }
        }
      };
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
        courses: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
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
        courses: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
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

    // Check if session name already exists (excluding current session)
    if (name && name !== session.name) {
      const existingSession = await prisma.session.findFirst({
        where: { name }
      });

      if (existingSession) {
        return next(new AppError('Session with this name already exists', 409));
      }
    }

    // Update session
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        name: name || session.name,
        startYear: startYear !== undefined ? startYear : session.startYear,
        endYear: endYear !== undefined ? endYear : session.endYear
      }
    });
    
    // If courseId is provided, update the association
    if (courseId) {
      // Validate course exists
      const course = await prisma.course.findUnique({
        where: { id: courseId }
      });

      if (!course) {
        return next(new AppError('Course not found', 404));
      }
      
      // Check if association already exists
      const existingAssociation = await prisma.courseSession.findUnique({
        where: {
          courseId_sessionId: {
            courseId,
            sessionId: id
          }
        }
      });
      
      if (!existingAssociation) {
        // Create the association between session and course
        await prisma.courseSession.create({
          data: {
            sessionId: id,
            courseId: courseId
          }
        });
      }
      
      // Fetch the session with course data for response
      const sessionWithCourse = await prisma.session.findUnique({
        where: { id: updatedSession.id },
        include: {
          courses: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  code: true
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
          session: sessionWithCourse
        }
      });
      return;
    }

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

    // Delete all CourseSession associations first
    await prisma.courseSession.deleteMany({
      where: {
        sessionId: id
      }
    });

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
        courses: {
          some: {
            courseId: courseId
          }
        }
      },
      include: {
        courses: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
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

/**
 * Associate a session with a course
 */
exports.associateSessionWithCourse = async (req, res, next) => {
  try {
    const { sessionId, courseId } = req.body;

    // Validate session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    // Validate course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    // Check if association already exists
    const existingAssociation = await prisma.courseSession.findUnique({
      where: {
        courseId_sessionId: {
          courseId,
          sessionId
        }
      }
    });

    if (existingAssociation) {
      return next(new AppError('Session is already associated with this course', 409));
    }

    // Create the association between session and course
    const courseSession = await prisma.courseSession.create({
      data: {
        sessionId,
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
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ASSOCIATE_SESSION_WITH_COURSE',
        entity: 'CourseSession',
        entityId: courseSession.id,
        payload: JSON.stringify({ sessionId, courseId })
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Session associated with course successfully',
      data: {
        courseSession
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Remove association between a session and a course
 */
exports.removeSessionCourseAssociation = async (req, res, next) => {
  try {
    const { sessionId, courseId } = req.params;

    // Check if association exists
    const association = await prisma.courseSession.findUnique({
      where: {
        courseId_sessionId: {
          courseId,
          sessionId
        }
      }
    });

    if (!association) {
      return next(new AppError('Session is not associated with this course', 404));
    }

    // Delete the association
    await prisma.courseSession.delete({
      where: {
        courseId_sessionId: {
          courseId,
          sessionId
        }
      }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'REMOVE_SESSION_COURSE_ASSOCIATION',
        entity: 'CourseSession',
        entityId: association.id,
        payload: JSON.stringify({ sessionId, courseId })
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Session course association removed successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get all sessions associated with a course
 */
exports.getSessionsForCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // Validate course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    const courseSessions = await prisma.courseSession.findMany({
      where: {
        courseId
      },
      include: {
        session: {
          include: {
            students: {
              select: {
                id: true,
                name: true,
                email: true,
                reg_no: true
              },
              take: 10 // Limit to first 10 students for performance
            }
          }
        }
      },
      orderBy: {
        session: {
          startYear: 'desc'
        }
      }
    });

    res.status(200).json({
      status: 'success',
      results: courseSessions.length,
      data: {
        courseSessions
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get all courses associated with a session
 */
exports.getCoursesForSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Validate session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    const courseSessions = await prisma.courseSession.findMany({
      where: {
        sessionId
      },
      include: {
        course: {
          include: {
            students: {
              select: {
                id: true,
                name: true,
                email: true,
                reg_no: true
              },
              take: 10 // Limit to first 10 students for performance
            }
          }
        }
      },
      orderBy: {
        course: {
          name: 'asc'
        }
      }
    });

    res.status(200).json({
      status: 'success',
      results: courseSessions.length,
      data: {
        courseSessions
      }
    });

  } catch (error) {
    next(error);
  }
};
