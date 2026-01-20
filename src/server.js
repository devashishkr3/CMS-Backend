const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const { default: rateLimit } = require("express-rate-limit");
const logger = require("./utils/logger");

// Load Environment Variables
require("dotenv").config();

//
const routes = require("./routes/app");
const AppError = require("./utils/error");
const ErrorHandler = require("./middlewares/errorHandler");
// const { startTokenCleanup } = require("./utils/tokenCleanup");

// Initialize Express App
const app = express();

// API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per `window` (here, per 15 minutes)
  message: {
    status: "error",
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply RateLimiter to API
app.use("/api/v1", apiLimiter);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(morgan("dev"));

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,  // jaise hi "*" hataunga then yaha prr true karna jaruri hai.
  })
);

// Root Endpoints
app.get("/", (req, res) => {
  return res.json({
    status: "success",
    message: "Welcome to College Management System",
    version: "1.0.0",
    health: "/health",
    uptime: process.uptime(),
    timeStamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

//Routes
app.use("/api/v1", routes);

// Handle 404
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Error Handler
app.use(ErrorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// PORT
const PORT = process.env.PORT || 5000;

// Start token cleanup process
// startTokenCleanup();

// Traditional Server
const server = app.listen(PORT, () => {
  logger.info(`Server is Running on PORT ${PORT}`);
  console.log(`Server is Running on PORT ${PORT}`);
});

// Handle unhandled promise rejections
// process.on('unhandledRejection', (err) => {
//   logger.error('Unhandled Rejection! Shutting down...', { error: err.message, stack: err.stack });
//   server.close(() => {
//     process.exit(1);
//   });
// });

// // Handle uncaught exceptions
// process.on('uncaughtException', (err) => {
//   logger.error('Uncaught Exception! Shutting down...', { error: err.message, stack: err.stack });
//   process.exit(1);
// });