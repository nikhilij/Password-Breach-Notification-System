const express = require("express");
const { body, query } = require("express-validator");
const breachController = require("../controllers/breachController");
const {
  authenticateToken,
  requireVerified,
  requireAdmin,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Validation rules
const checkPasswordValidation = [
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 1 })
    .withMessage("Password cannot be empty"),
];

const markActionValidation = [
  body("actionIndex")
    .isInt({ min: 0 })
    .withMessage("Action index must be a non-negative integer"),
];

const searchValidation = [
  query("severity")
    .optional()
    .isIn(["low", "medium", "high", "critical"])
    .withMessage("Invalid severity level"),

  query("riskLevel")
    .optional()
    .isIn(["low", "medium", "high", "critical"])
    .withMessage("Invalid risk level"),

  query("acknowledged")
    .optional()
    .isBoolean()
    .withMessage("Acknowledged must be a boolean"),

  query("active")
    .optional()
    .isBoolean()
    .withMessage("Active must be a boolean"),

  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format for dateFrom"),

  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format for dateTo"),

  query("source")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Source cannot be empty"),
];

// Apply authentication to all routes
router.use(authenticateToken);

// User routes (require verified account)
router.post(
  "/check",
  requireVerified,
  checkPasswordValidation,
  breachController.checkPasswordBreach,
);
router.get("/history", requireVerified, breachController.getBreachHistory);
router.get(
  "/search",
  requireVerified,
  searchValidation,
  breachController.searchBreaches,
);
router.get("/:breachId", requireVerified, breachController.getBreachById);
router.put(
  "/:breachId/acknowledge",
  requireVerified,
  breachController.acknowledgeBreach,
);
router.post(
  "/:breachId/action",
  requireVerified,
  markActionValidation,
  breachController.markActionCompleted,
);
router.put(
  "/:breachId/action-completed",
  requireVerified,
  markActionValidation,
  breachController.markActionCompleted,
);

// Admin routes
router.get("/admin/stats", requireAdmin, breachController.getGlobalBreachStats);
router.get("/admin/recent", requireAdmin, breachController.getRecentBreaches);
router.get("/user/:userId", requireAdmin, breachController.getUserBreaches);

module.exports = router;
