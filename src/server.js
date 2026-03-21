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
// CORS — support comma-separated FRONTEND_URL values (e.g. http://localhost:5173,http://localhost:5173)
const rawFrontendUrls = process.env.FRONTEND_URL || "*";
const allowedOrigins = rawFrontendUrls.split(",").map((s) => s.trim()).filter(Boolean);
const allowAll = allowedOrigins.includes("*");

// Skip CORS for payment webhook endpoints (callback, return) - these are server-to-server calls
const skipCorsForWebhooks = (req) => {
  return req.path.includes("/api/v1/payments/callback") || 
         req.path.includes("/api/v1/payments/return");
};

app.use(
  cors((req, callback) => {
    // Return/callback endpoints must accept cross-origin browser posts from gateway.
    if (skipCorsForWebhooks(req)) {
      return callback(null, {
        origin: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: false,
      });
    }

    return callback(null, {
      origin: allowAll
        ? "*"
        : function (origin, originCb) {
            // allow server-to-server or same-origin requests with no origin
            if (!origin) return originCb(null, true);

            // direct match from env list
            if (allowedOrigins.indexOf(origin) !== -1) return originCb(null, true);

            // allow any localhost / 127.0.0.1 / IPv6 loopback origins (any port)
            try {
              const parsed = new URL(origin);
              const hostname = parsed.hostname;
              if (
                hostname === "localhost" ||
                hostname === "127.0.0.1" ||
                hostname === "::1"
              ) {
                return originCb(null, true);
              }
            } catch (e) {
              // if origin isn't a valid URL, fall through to deny
            }

            return originCb(new Error("CORS policy: This origin is not allowed."), false);
          },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      // credentials cannot be true when origin is "*"
      credentials: !allowAll,
    });
  })
);


// const rawFrontendUrls = process.env.FRONTEND_URL;

// if (!rawFrontendUrls) {
//   throw new Error("FRONTEND_URL is not defined in env");
// }

// const allowedOrigins = rawFrontendUrls
//   .split(",")
//   .map((s) => s.trim())
//   .filter(Boolean);

// const corsOptions = {
//   origin: function (origin, callback) {
//     // allow server-to-server (no origin)
//     if (!origin) return callback(null, true);

//     // allow whitelisted domains
//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }

//     // allow localhost (DEV only)
//     if (process.env.NODE_ENV !== "production") {
//       try {
//         const parsed = new URL(origin);
//         if (
//           parsed.hostname === "localhost" ||
//           parsed.hostname === "127.0.0.1"
//         ) {
//           return callback(null, true);
//         }
//       } catch (err) {}
//     }

//     logger.warn(`CORS BLOCKED: ${origin}`);
//     return callback(new Error("Not allowed by CORS"));
//   },

//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//   allowedHeaders: ["Content-Type", "Authorization"],

//   credentials: true, // only if using cookies/auth
// };

// app.use(cors(corsOptions));

// CORS
// CORS — support comma-separated FRONTEND_URL values (e.g. http://localhost:5173,http://localhost:5173)
// const rawFrontendUrls = process.env.FRONTEND_URL;
// const allowedOrigins = rawFrontendUrls.split(",").map((s) => s.trim()).filter(Boolean);
// // const allowAll = allowedOrigins.includes("*");

// // Skip CORS for payment webhook endpoints (callback, return) - these are server-to-server calls
// const skipCorsForWebhooks = (req) => {
//   return req.path.includes("/api/v1/payments/callback") || 
//          req.path.includes("/api/v1/payments/return");
// };

// app.use(
//   cors((req, callback) => {
//     // Return/callback endpoints must accept cross-origin browser posts from gateway.
//     if (skipCorsForWebhooks(req)) {
//       return callback(null, {
//         origin: true,
//         methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//         allowedHeaders: ["Content-Type", "Authorization"],
//         credentials: false,
//       });
//     }

//     return callback(null, {
//       origin: allowAll
//         ? "*"
//         : function (origin, originCb) {
//             // allow server-to-server or same-origin requests with no origin
//             if (!origin) return originCb(null, true);

//             // direct match from env list
//             if (allowedOrigins.indexOf(origin) !== -1) return originCb(null, true);

//             // allow any localhost / 127.0.0.1 / IPv6 loopback origins (any port)
//             try {
//               const parsed = new URL(origin);
//               const hostname = parsed.hostname;
//               if (
//                 hostname === "localhost" ||
//                 hostname === "127.0.0.1" ||
//                 hostname === "::1"
//               ) {
//                 return originCb(null, true);
//               }
//             } catch (e) {
//               // if origin isn't a valid URL, fall through to deny
//             }

//             return originCb(new Error("CORS policy: This origin is not allowed."), false);
//           },
//       methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//       allowedHeaders: ["Content-Type", "Authorization"],
//       // credentials cannot be true when origin is "*"
//       credentials: !allowAll,
//     });
//   })
// );

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
