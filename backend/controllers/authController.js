const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");
const logger = require("../utils/logger");
const { catchAsync, AppError } = require("../middlewares/errorHandler");

/**
 * Generate JWT token
 * @param {string} userId - User ID
 * @returns {string} - JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

/**
 * Register a new user
 */
const register = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "fail",
      message: "Validation errors",
      errors: errors.array(),
    });
  }

  const { username, email, password, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    return res.status(400).json({
      status: "fail",
      message: "User already exists with this email or username",
    });
  }

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");

  // Create user
  const user = new User({
    username,
    email,
    password,
    phone,
    verificationToken,
  });

  await user.save();

  // Send welcome email
  try {
    await emailService.sendWelcomeEmail(email, username, verificationToken);
  } catch (error) {
    logger.error("Failed to send welcome email:", error);
  }

  // Generate token
  const token = generateToken(user._id);

  res.status(201).json({
    status: "success",
    message:
      "User registered successfully. Please check your email for verification.",
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isVerified: user.isVerified,
        role: user.role,
      },
      token,
    },
  });
});

/**
 * Login user
 */
const login = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "fail",
      message: "Validation errors",
      errors: errors.array(),
    });
  }

  const { email, password } = req.body;

  // Find user
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({
      status: "fail",
      message: "Invalid email or password",
    });
  }

  // Check if account is locked
  if (user.isLocked) {
    return res.status(423).json({
      status: "fail",
      message: "Account temporarily locked due to failed login attempts",
    });
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    // Increment login attempts
    await user.incLoginAttempts();

    return res.status(401).json({
      status: "fail",
      message: "Invalid email or password",
    });
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  // Update last login
  user.lastLoginAt = new Date();
  await user.save();

  // Generate token
  const token = generateToken(user._id);

  res.json({
    status: "success",
    message: "Login successful",
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isVerified: user.isVerified,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
      token,
    },
  });
});

/**
 * Verify email
 */
const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({
      status: "fail",
      message: "Verification token is required",
    });
  }

  const user = await User.findOne({ verificationToken: token });

  if (!user) {
    return res.status(400).json({
      status: "fail",
      message: "Invalid or expired verification token",
    });
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  res.json({
    status: "success",
    message: "Email verified successfully",
  });
});

/**
 * Forgot password
 */
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      status: "fail",
      message: "User not found with this email",
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  await user.save();

  // Send reset email
  try {
    await emailService.sendPasswordResetEmail(email, resetToken);

    // Send SMS notification if phone is available
    if (user.phone && user.notificationPreferences.sms) {
      await smsService.sendPasswordResetSMS(user.phone);
    }
  } catch (error) {
    logger.error("Failed to send password reset email:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to send password reset email",
    });
  }

  res.json({
    status: "success",
    message: "Password reset email sent",
  });
});

/**
 * Reset password
 */
const resetPassword = catchAsync(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      status: "fail",
      message: "Token and new password are required",
    });
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      status: "fail",
      message: "Invalid or expired reset token",
    });
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({
    status: "success",
    message: "Password reset successfully",
  });
});

/**
 * Get current user
 */
const getCurrentUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  res.json({
    status: "success",
    data: {
      user,
    },
  });
});

/**
 * Update user profile
 */
const updateProfile = catchAsync(async (req, res) => {
  const { username, phone, notificationPreferences } = req.body;

  const user = await User.findById(req.user._id);

  if (username) user.username = username;
  if (phone) user.phone = phone;
  if (notificationPreferences) {
    user.notificationPreferences = {
      ...user.notificationPreferences,
      ...notificationPreferences,
    };
  }

  await user.save();

  res.json({
    status: "success",
    message: "Profile updated successfully",
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        notificationPreferences: user.notificationPreferences,
        isVerified: user.isVerified,
        role: user.role,
      },
    },
  });
});

/**
 * Change password
 */
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);

  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      status: "fail",
      message: "Current password is incorrect",
    });
  }

  user.password = newPassword;
  await user.save();

  res.json({
    status: "success",
    message: "Password changed successfully",
  });
});

/**
 * Logout user (client-side token removal)
 */
const logout = catchAsync(async (req, res) => {
  res.json({
    status: "success",
    message: "Logged out successfully",
  });
});

module.exports = {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  changePassword,
  logout,
};
