const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const {
  authenticateToken,
  requireVerified,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Validation rules
const registerValidation = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
    ),

  body("phone")
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage("Please provide a valid phone number"),
];

const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("password").notEmpty().withMessage("Password is required"),
];

const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
];

const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
    ),
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
    ),
];

const updateProfileValidation = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("phone")
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage("Please provide a valid phone number"),

  body("notificationPreferences.email")
    .optional()
    .isBoolean()
    .withMessage("Email preference must be a boolean"),

  body("notificationPreferences.sms")
    .optional()
    .isBoolean()
    .withMessage("SMS preference must be a boolean"),

  body("notificationPreferences.push")
    .optional()
    .isBoolean()
    .withMessage("Push preference must be a boolean"),
];

// Public routes
router.post("/register", registerValidation, authController.register);
router.post("/login", loginValidation, authController.login);
router.get("/verify-email", authController.verifyEmail);
router.post(
  "/forgot-password",
  forgotPasswordValidation,
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  resetPasswordValidation,
  authController.resetPassword,
);

// Protected routes
router.use(authenticateToken); // All routes below require authentication

router.get("/me", authController.getCurrentUser);
router.put("/profile", updateProfileValidation, authController.updateProfile);
router.post(
  "/change-password",
  changePasswordValidation,
  authController.changePassword,
);
router.post("/logout", authController.logout);

module.exports = router;
