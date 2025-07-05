const logger = require("../utils/logger");

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle MongoDB cast errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Handle MongoDB duplicate key errors
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

// Handle MongoDB validation errors
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((val) => val.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

// Handle JWT errors
const handleJWTError = () =>
  new AppError("Invalid token. Please log in again!", 401);

const handleJWTExpiredError = () =>
  new AppError("Your token has expired! Please log in again.", 401);

// Send error response in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error("ERROR:", err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong!",
    });
  }
};

// Enhanced error tracking and monitoring
class ErrorTracker {
  constructor() {
    this.errorCounts = new Map();
    this.recentErrors = [];
    this.maxRecentErrors = 100;
  }

  trackError(error, req = null) {
    const errorKey = `${error.name}:${error.message}`;
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);

    // Track recent errors with context
    const errorInfo = {
      timestamp: new Date(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode || 500,
      },
      request: req
        ? {
            method: req.method,
            url: req.url,
            userAgent: req.get("User-Agent"),
            ip: req.ip,
          }
        : null,
    };

    this.recentErrors.push(errorInfo);

    // Keep only recent errors
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.shift();
    }

    return errorInfo;
  }

  getErrorStats() {
    return {
      totalErrors: this.recentErrors.length,
      errorCounts: Object.fromEntries(this.errorCounts),
      recentErrors: this.recentErrors.slice(-10), // Last 10 errors
    };
  }

  clearStats() {
    this.errorCounts.clear();
    this.recentErrors = [];
  }
}

// Global error tracker instance
const errorTracker = new ErrorTracker();

// Global error handling middleware
const globalErrorHandler = (err, req, res, _next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === "ValidationError")
      error = handleValidationErrorDB(error);
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }

  // Log error
  logger.error(`Error ${err.statusCode}: ${err.message}`, {
    error: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Track error
  errorTracker.trackError(err, req);
};

// Catch async errors wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Handle unhandled routes
const handleUnknownRoutes = (req, res, next) => {
  const err = new AppError(
    `Can't find ${req.originalUrl} on this server!`,
    404,
  );
  next(err);
};

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync,
  handleUnknownRoutes,
};
