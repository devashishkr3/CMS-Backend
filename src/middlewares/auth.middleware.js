const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const AppError = require('../utils/error');

// Protect routes - check if user is authenticated
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

    // 2. Check if token exists
    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access', 401));
    }

    // 3. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access_secret_key');
    } catch (err) {
      return next(new AppError('Invalid token. Please log in again', 401));
    }

    // 4. Check if user still exists
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists', 401));
    }

    // 5. Check if user is active
    if (!currentUser.isActive) {
      return next(new AppError('This user account has been deactivated', 401));
    }

    // 6. Check if user changed password after the token was issued
    // Not implemented as we don't have passwordChangedAt field in our schema

    // 7. Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

// Restrict to certain roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['ADMIN', 'HOD', 'STAFF']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};