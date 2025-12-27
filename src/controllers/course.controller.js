const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { createCourse, updateCourse } = require('../validation/course.validation');

/**
 * Create a new course
 * Access: ADMIN
 */
exports.createCourse = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createCourse.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { name, code, durationYears, departmentId } = value;

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });

    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    // Check if course with this name already exists
    const existingCourse = await prisma.course.findFirst({
      where: { name }
    });

    if (existingCourse) {
      return next(new AppError('Course with this name already exists', 400));
    }

    // Check if course with this code already exists
    const existingCourseByCode = await prisma.course.findFirst({
      where: { code }
    });

    if (existingCourseByCode) {
      return next(new AppError('Course with this code already exists', 400));
    }

    // Create course
    const course = await prisma.course.create({
      data: {
        name,
        code,
        durationYears,
        departmentId
      },
      include: {
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
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_COURSE',
        entity: 'Course',
        entityId: course.id,
        payload: JSON.stringify({ name, code, durationYears, departmentId })
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Course created successfully',
      data: {
        course
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all courses with filtering options
 * Access: ADMIN, HOD
 */
exports.getAllCourses = async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    
    // Build where clause
    const where = {};
    
    if (departmentId) {
      where.departmentId = departmentId;
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        subjects: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: courses.length,
      data: {
        courses
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get course by ID
 * Access: ADMIN, HOD
 */
exports.getCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        subjects: {
          select: {
            id: true,
            code: true,
            name: true,
            credit: true
          }
        },
        semesters: {
          select: {
            id: true,
            number: true
          }
        }
      }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        course
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update course
 * Access: ADMIN
 */
exports.updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = updateCourse.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    const { name, code, durationYears, departmentId } = value;

    // Check if department exists (if provided)
    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId }
      });

      if (!department) {
        return next(new AppError('Department not found', 404));
      }
    }

    // Check if another course with this name already exists
    if (name && name !== course.name) {
      const existingCourse = await prisma.course.findFirst({
        where: { 
          name,
          NOT: { id }
        }
      });

      if (existingCourse) {
        return next(new AppError('Course with this name already exists', 400));
      }
    }

    // Check if another course with this code already exists (if code is provided)
    if (code && code !== course.code) {
      const existingCourseByCode = await prisma.course.findFirst({
        where: { 
          code,
          NOT: { id }
        }
      });

      if (existingCourseByCode) {
        return next(new AppError('Course with this code already exists', 400));
      }
    }

    // Update course
    const updatedCourse = await prisma.course.update({
      where: { id },
      data: {
        name: name || course.name,
        code: code || course.code,
        durationYears: durationYears || course.durationYears,
        departmentId: departmentId || course.departmentId
      },
      include: {
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
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_COURSE',
        entity: 'Course',
        entityId: id,
        payload: JSON.stringify(value)
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Course updated successfully',
      data: {
        course: updatedCourse
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete course
 * Access: ADMIN
 */
exports.deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    // Check if course has associated students
    const studentsCount = await prisma.student.count({
      where: { courseId: id }
    });

    if (studentsCount > 0) {
      return next(new AppError('Cannot delete course with associated students', 400));
    }

    // Check if course has associated semesters
    const semestersCount = await prisma.semester.count({
      where: { courseId: id }
    });

    if (semestersCount > 0) {
      return next(new AppError('Cannot delete course with associated semesters', 400));
    }

    // Delete course
    await prisma.course.delete({
      where: { id }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_COURSE',
        entity: 'Course',
        entityId: id,
        payload: JSON.stringify({ name: course.name, code: course.code })
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Course deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create semesters for a course
 * Access: ADMIN
 */
exports.createSemesters = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { numberOfSemesters } = req.body;

    // Validate input
    if (!numberOfSemesters || numberOfSemesters <= 0) {
      return next(new AppError('Number of semesters must be a positive integer', 400));
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    // Calculate expected number of semesters based on duration
    const expectedSemesters = course.durationYears * 2;
    if (numberOfSemesters > expectedSemesters) {
      return next(new AppError(`Number of semesters cannot exceed ${expectedSemesters} for a ${course.durationYears}-year course`, 400));
    }

    // Check if semesters already exist for this course
    const existingSemesters = await prisma.semester.count({
      where: { courseId: id }
    });

    if (existingSemesters > 0) {
      return next(new AppError('Semesters already exist for this course', 400));
    }

    // Create semesters
    const semestersData = [];
    for (let i = 1; i <= numberOfSemesters; i++) {
      semestersData.push({
        number: i,
        courseId: id
      });
    }

    const semesters = await prisma.semester.createMany({
      data: semestersData
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_SEMESTERS_FOR_COURSE',
        entity: 'Semester',
        entityId: id,
        payload: JSON.stringify({ courseId: id, numberOfSemesters })
      }
    });

    res.status(201).json({
      status: 'success',
      message: `${semesters.count} semesters created successfully for course`,
      data: {
        count: semesters.count
      }
    });
  } catch (error) {
    next(error);
  }
};