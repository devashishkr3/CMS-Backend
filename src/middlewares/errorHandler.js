const AppError = require("../utils/error");

// 🛠 Development: Send detailed error
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

// 🛠 Production: Hide internal details
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  console.error("ERROR :- ", err);
  res.status(500).json({
    status: "error",
    message: "Something went wrong!",
  });
};

// 🛠 Convert known errors to operational
const handleKnownErrors = (err) => {
  // let error = { ...err };
  let error = Object.assign({}, err);
  error.message = err.message;

  // Handle missing body destructuring issue
  if (err instanceof TypeError && err.message.includes("Cannot destructure")) {
    return new AppError("Invalid or missing request body", 400);
  }

  // Joi validation error
  // if (err.name === "ValidationError" && err.details) {
  //   return new AppError(err.details[0].message, 400);
  // }

  // if (err.name === "ValidationError" && err.details) {
  //   const messages = err.details.map(d => d.message);
  //   return new AppError(messages.join(", "), 400);
  // }

  // express-validator
  if (err.errors && Array.isArray(err.errors)) {
    return new AppError(err.errors[0].msg, 400);
  }

  // Prisma unique constraint error
  if (err.code === "P2002") {
    const field = err.meta?.target?.join(", ");
    return new AppError(`Duplicate field value: ${field}`, 400);
  }

  // Prisma record not found
  if (err.code === "P2025") {
    return new AppError("Record not found", 404);
  }

  return error;
};

// 🛠 Global error handler
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = handleKnownErrors(err);

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
    console.log("Error: ", error );
  } else {
    sendErrorProd(error, res);
  }
};