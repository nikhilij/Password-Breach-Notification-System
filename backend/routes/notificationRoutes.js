const express = require("express");
const { body } = require("express-validator");
const notificationController = require("../controllers/notificationController");
const {
  authenticateToken,
  requireVerified,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Validation rules
const updatePreferencesValidation = [
  body("email")
    .optional()
    .isBoolean()
    .withMessage("Email preference must be a boolean"),

  body("sms")
    .optional()
    .isBoolean()
    .withMessage("SMS preference must be a boolean"),

  body("push")
    .optional()
    .isBoolean()
    .withMessage("Push preference must be a boolean"),
];

const testNotificationValidation = [
  body("type")
    .isIn(["email", "sms"])
    .withMessage('Notification type must be either "email" or "sms"'),
];

// Apply authentication to all routes
router.use(authenticateToken);

// Notification preference routes
router.get("/preferences", notificationController.getNotificationPreferences);
router.put(
  "/preferences",
  updatePreferencesValidation,
  notificationController.updateNotificationPreferences,
);

// Notification management routes
router.get("/", requireVerified, notificationController.getNotifications);
router.get(
  "/stats",
  requireVerified,
  notificationController.getNotificationStats,
);
router.get(
  "/history",
  requireVerified,
  notificationController.getNotificationHistory,
);
router.put(
  "/mark-all-read",
  requireVerified,
  notificationController.markAllNotificationsAsRead,
);
router.put(
  "/:notificationId/read",
  requireVerified,
  notificationController.markNotificationAsRead,
);

// Testing route (for development)
router.post(
  "/test",
  testNotificationValidation,
  notificationController.testNotification,
);

module.exports = router;
