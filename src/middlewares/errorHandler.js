const AppError = require("../utils/error");
const logger = require("../utils/logger");

// 🛠 Development: Send detailed error
const sendErrorDev = (err, res) => {
  // Log error for monitoring
  logger.error("API Error (Development)", {
    message: err.message,
    statusCode: err.statusCode,
    isOperational: err.isOperational,
    stack: err.stack,
    name: err.name
  });

  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

// 🛠 Production: Hide internal details
const sendErrorProd = (err, res) => {
  // Log all errors for monitoring
  logger.error("API Error", {
    message: err.message,
    statusCode: err.statusCode,
    isOperational: err.isOperational,
    stack: err.stack,
    name: err.name
  });

  // Operational errors are trusted and can be sent to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // Log unexpected errors for debugging
  logger.error("UNEXPECTED ERROR", {
    error: err.message,
    stack: err.stack,
    name: err.name
  });
  
  // Don't leak internal details in production
  res.status(500).json({
    status: "error",
    message: "Something went wrong! Please try again later.",
  });
};

// 🛠 Convert known errors to operational
const handleKnownErrors = (err) => {
  // Create a copy of the error
  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;

  // Handle missing body destructuring issue
  if (err instanceof TypeError && err.message.includes("Cannot destructure")) {
    return new AppError("Invalid or missing request body", 400);
  }

  // Joi validation error
  if (err.name === "ValidationError") {
    const messages = err.details ? err.details.map(d => d.message) : [err.message];
    return new AppError(`Validation error: ${messages.join(", ")}`, 400);
  }

  // express-validator
  if (err.errors && Array.isArray(err.errors)) {
    const messages = err.errors.map(e => e.msg);
    return new AppError(`Validation error: ${messages.join(", ")}`, 400);
  }

  // Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    // Unique constraint violation
    if (err.code === "P2002") {
      const field = err.meta?.target?.join(", ");
      return new AppError(`Duplicate field value: ${field}`, 400);
    }
    
    // Record not found
    if (err.code === "P2025") {
      return new AppError("Record not found", 404);
    }
    
    // Foreign key constraint violation
    if (err.code === "P2003") {
      return new AppError("Foreign key constraint violation", 400);
    }
    
    // Invalid argument
    if (err.code === "P2009") {
      return new AppError("Invalid query argument", 400);
    }
  }
  
  // Prisma client initialization error
  if (err.name === "PrismaClientInitializationError") {
    return new AppError("Database connection error", 500);
  }
  
  // Prisma client runtime error
  if (err.name === "PrismaClientRustPanicError") {
    return new AppError("Database error", 500);
  }

  // JSON parsing error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new AppError("Invalid JSON in request body", 400);
  }

  // Cast error (e.g., invalid ObjectId)
  if (err.name === "CastError") {
    return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return new AppError("Invalid token", 401);
  }
  
  if (err.name === "TokenExpiredError") {
    return new AppError("Token expired", 401);
  }

  return error;
};

// 🛠 Global error handler
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = handleKnownErrors(err);

  // Add request context to error for better debugging
  error.request = {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user.id : null
  };

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
    console.log("Error: ", error);
  } else {
    sendErrorProd(error, res);
  }
};