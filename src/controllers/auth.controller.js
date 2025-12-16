const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const tokenGenerator = require("../utils/tokenGenerator");
require("dotenv").config();

// Register a new user
exports.registerUser = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, accessPassword } = req.body;

    if (!accessPassword || accessPassword !== process.env.ACCESS_PASSWORD) {
        return next(new AppError("Invalid access password", 403));
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

    // Send response
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.passwordHash) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Check if password is correct
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError('Account is deactivated. Please contact admin.', 403));
    }

    // Generate tokens
    // const { accessToken, refreshToken } = tokenGenerator.generateTokens(user.id, role);
    const refreshToken = tokenGenerator.generateRefreshToken(user.id, user.role);
    const accessToken = tokenGenerator.generateAccessToken(user.id, user.role);

    // Send response
    res.status(200).json({
      status: 'success',
      message: 'Logged in successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isActive: user.isActive
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token
exports.refreshToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("AuthHeader is required", 400));
  }

  // extracting refresh token from auth header
  const refreshToken = authHeader && authHeader.split(" ")[1];

    // check if refresh token is provided
    if (!refreshToken) {
        return next(new AppError("Refresh token is required", 400));
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return next(new AppError('Invalid refresh token', 401));
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError('Account is deactivated. Please contact admin.', 403));
    }

    // Check if token is blacklisted
    const blacklistedToken = await prisma.blacklistedToken.findUnique({
      where: { token: refreshToken }
    });

    if (blacklistedToken) {
      return next(new AppError('Refresh token has been revoked', 401));
    }

    // Generate new tokens
    const newAccessToken = tokenGenerator.generateAccessToken(user.id, user.role)

    // Send response
    res.status(200).json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        accessToken : newAccessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// Logout user
exports.logoutUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next(new AppError("AuthHeader is required", 400));
    }

    // extracting refresh token from auth header
    const refreshToken = authHeader && authHeader.split(" ")[1];

    // check if refresh token is provided
    if (!refreshToken) {
        return next(new AppError("Refresh token is required", 400));
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return next(new AppError('Invalid refresh token', 401));
    }

    // Add token to blacklist
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await prisma.blacklistedToken.create({
      data: {
        token: refreshToken,
        expiresAt
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};