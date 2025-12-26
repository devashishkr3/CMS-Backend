const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const bcrypt = require('bcrypt');
require("dotenv").config();

/**
 * Create a new user (HOD or ACCOUNTANT only)
 * Only ADMIN can create users
 */
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // Validate role - only HOD or STAFF allowed
    if (role !== 'HOD' && role !== 'ACCOUNTANT') {
      return next(new AppError('Only HOD or ACCOUNTANT roles can be assigned', 400));
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