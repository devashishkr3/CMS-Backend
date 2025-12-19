const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const bcrypt = require('bcrypt');
require("dotenv").config();

/**
 * Create a new user (HOD or STAFF only)
 * Only ADMIN can create users
 */
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // Validate role - only HOD or STAFF allowed
    if (role !== 'HOD' && role !== 'STAFF') {
      return next(new AppError('Only HOD or STAFF roles can be assigned', 400));
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return next(new AppError('User with this email already exists', 400));
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        phone,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_USER',
        entity: 'User',
        entityId: user.id,
        payload: JSON.stringify({ name, email, role, phone })
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users (excluding passwords)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user status (activate/deactivate)
 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Prevent deactivating ADMIN users
    if (user.role === 'ADMIN' && !isActive) {
      return next(new AppError('Cannot deactivate an ADMIN user', 400));
    }

    // Prevent changing status of own account
    if (user.id === req.user.id) {
      return next(new AppError('You cannot change your own status', 400));
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_USER_STATUS',
        entity: 'User',
        entityId: id,
        payload: JSON.stringify({ isActive })
      }
    });

    res.status(200).json({
      status: 'success',
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create admission window
 */
exports.createAdmissionWindow = async (req, res, next) => {
  try {
    const { courseId, departmentId, startDate, endDate } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return next(new AppError('End date must be after start date', 400));
    }

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
        courseId,
        departmentId,
        startDate: start,
        endDate: end,
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
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_ADMISSION_WINDOW',
        entity: 'AdmissionWindow',
        entityId: admissionWindow.id,
        payload: JSON.stringify({ courseId, departmentId, startDate, endDate })
      }
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
 * Update admission window status (enable/disable)
 */
exports.updateAdmissionWindowStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    // Check if admission window exists
    const admissionWindow = await prisma.admissionWindow.findUnique({
      where: { id }
    });

    if (!admissionWindow) {
      return next(new AppError('Admission window not found', 404));
    }

    // Update admission window status
    const updatedWindow = await prisma.admissionWindow.update({
      where: { id },
      data: { enabled },
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
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_ADMISSION_WINDOW_STATUS',
        entity: 'AdmissionWindow',
        entityId: id,
        payload: JSON.stringify({ enabled })
      }
    });

    res.status(200).json({
      status: 'success',
      message: `Admission window ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        admissionWindow: updatedWindow
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all admissions with filtering options
 */
exports.getAdmissions = async (req, res, next) => {
  try {
    const { status, courseId, departmentId } = req.query;

    // Build where clause
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (courseId) {
      where.courseId = courseId;
    }
    
    if (departmentId) {
      where.departmentId = departmentId;
    }

    // Get admissions
    const admissions = await prisma.admission.findMany({
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
 * Update admission status with lifecycle enforcement
 */
exports.updateAdmissionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Get current admission
    const admission = await prisma.admission.findUnique({
      where: { id }
    });

    if (!admission) {
      return next(new AppError('Admission not found', 404));
    }

    // Validate status transition
    const validTransitions = {
      'DRAFT': ['SUBMITTED'],
      'SUBMITTED': ['APPROVED', 'REJECTED'],
      'APPROVED': ['PAYMENT_PENDING'],
      'PAYMENT_PENDING': ['PAID'],
      'REJECTED': [],
      'PAID': []
    };

    // Check if current status allows transition to new status
    const allowedTransitions = validTransitions[admission.status] || [];
    
    if (!allowedTransitions.includes(status)) {
      return next(new AppError(
        `Invalid status transition from ${admission.status} to ${status}`, 
        400
      ));
    }

    // REJECTED cannot be changed again
    if (admission.status === 'REJECTED') {
      return next(new AppError('Rejected admissions cannot be modified', 400));
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
            changedById: req.user.id
          }
        }
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
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_ADMISSION_STATUS',
        entity: 'Admission',
        entityId: id,
        payload: JSON.stringify({ fromStatus: admission.status, toStatus: status })
      }
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