const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const AppError = require('../utils/error');

/**
 * Protect middleware to verify JWT access token and attach user to req.user
 */
exports.protect = async (req, res, next) => {
  try {
    // 1. Get token from header
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    // console.log(token);

    // 2. Check if token exists
    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 3. Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // 4. Check if user still exists
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true
      }
    });

    if (!currentUser) {
      return next(
        new AppError(
          'The user belonging to this token does no longer exist.',
          401
        )
      );
    }

    // 5. Check if user is active
    if (!currentUser.isActive) {
      return next(new AppError('This user account has been deactivated.', 403));
    }

    // 6. Attach user to request object
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired! Please log in again.', 401));
    }
    next(error);
  }
};

/**
 * RestrictTo middleware to control access based on user roles
 * @param  {...any} roles - Allowed roles (ADMIN, HOD, ACCOUNTANT)
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if user exists on request
    if (!req.user) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // Check if user's role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};