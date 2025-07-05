// Load environment variables first
require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

// Database connection
const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const breachRoutes = require("./routes/breachRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Middleware
const {
  globalErrorHandler,
  handleUnknownRoutes,
} = require("./middlewares/errorHandler");
const logger = require("./utils/logger");

// Initialize Express app
const app = express();

// Connect to database
connectDB();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Rate limiting - disabled in test environment or when explicitly disabled
const rateLimitEnabled =
  process.env.RATE_LIMIT_ENABLED !== "false" && process.env.NODE_ENV !== "test";

if (rateLimitEnabled) {
  const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
    message: {
      error: "Too many requests from this IP, please try again later.",
      retryAfter: Math.ceil(
        (process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000) / 1000,
      ),
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
      // Skip rate limiting for health checks and test endpoints
      return req.path === "/health" || req.path.startsWith("/test");
    },
  });

  app.use(limiter);
  logger.info("🛡️ Rate limiting enabled");
} else {
  logger.info("⚠️ Rate limiting disabled for testing");
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    }),
  );
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Password Breach Notification System is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/breach", breachRoutes);
app.use("/api/notifications", notificationRoutes);

// API documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "Password Breach Notification System API",
    version: "1.0.0",
    endpoints: {
      auth: {
        "POST /api/auth/register": "Register a new user",
        "POST /api/auth/login": "Login user",
        "GET /api/auth/verify-email": "Verify email address",
        "POST /api/auth/forgot-password": "Request password reset",
        "POST /api/auth/reset-password": "Reset password",
        "GET /api/auth/me": "Get current user (protected)",
        "PUT /api/auth/profile": "Update user profile (protected)",
        "POST /api/auth/change-password": "Change password (protected)",
        "POST /api/auth/logout": "Logout user (protected)",
      },
      breach: {
        "POST /api/breach/check": "Check password breach (protected)",
        "GET /api/breach/history": "Get breach history (protected)",
        "GET /api/breach/search": "Search breaches (protected)",
        "GET /api/breach/:breachId": "Get breach details (protected)",
        "PUT /api/breach/:breachId/acknowledge":
          "Acknowledge breach (protected)",
        "PUT /api/breach/:breachId/action-completed":
          "Mark action completed (protected)",
        "GET /api/breach/admin/stats": "Get global breach stats (admin)",
        "GET /api/breach/admin/recent": "Get recent breaches (admin)",
      },
      notifications: {
        "GET /api/notifications/preferences":
          "Get notification preferences (protected)",
        "PUT /api/notifications/preferences":
          "Update notification preferences (protected)",
        "GET /api/notifications": "Get notifications (protected)",
        "GET /api/notifications/stats":
          "Get notification statistics (protected)",
        "GET /api/notifications/history":
          "Get notification history (protected)",
        "PUT /api/notifications/mark-all-read":
          "Mark all notifications as read (protected)",
        "PUT /api/notifications/:notificationId/read":
          "Mark notification as read (protected)",
        "POST /api/notifications/test": "Test notification sending (protected)",
      },
    },
  });
});

// Handle unknown routes
app.all("*", handleUnknownRoutes);

// Global error handling middleware
app.use(globalErrorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 Password Breach Notification System running on port ${PORT}`);
  logger.info(`📱 Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
  logger.info(`📚 API docs: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
