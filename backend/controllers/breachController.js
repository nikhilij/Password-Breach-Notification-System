const { validationResult } = require("express-validator");
const User = require("../models/User");
const Breach = require("../models/Breach");
const BreachService = require("../services/breachService");
const EmailService = require("../services/emailService");
const SmsService = require("../services/smsService");
const { generateSHA1Hash } = require("../utils/hashUtil");
const logger = require("../utils/logger");
const { catchAsync, AppError } = require("../middlewares/errorHandler");

// Create service instances
const breachService = new BreachService();
const emailService = new EmailService();
const smsService = new SmsService();

/**
 * Check if a password has been breached
 */
const checkPasswordBreach = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "fail",
      message: "Validation errors",
      errors: errors.array(),
    });
  }

  const { password } = req.body;
  const userId = req.user._id;

  // Check password breach
  const breachResult = await breachService.checkPasswordBreach(password);

  if (breachResult.isBreached) {
    // Generate password hash for storage
    const passwordHash = generateSHA1Hash(password);

    // Check if this breach already exists for the user
    let existingBreach = await Breach.findOne({
      userId,
      passwordHash,
    });

    if (existingBreach) {
      // Update existing breach
      existingBreach.timesFound += 1;
      existingBreach.lastChecked = new Date();
      existingBreach.isActive = true;

      // Add new breach source if not already present
      const existingSource = existingBreach.breachSources.find(
        (source) => source.name === breachResult.source,
      );

      if (!existingSource) {
        existingBreach.breachSources.push({
          name: breachResult.source,
          dateFound: new Date(),
          severity: breachResult.severity,
          description: "Password found " + breachResult.count + " times",
          affectedAccounts: breachResult.count,
        });
      }

      await existingBreach.save();
    } else {
      // Create new breach record
      const newBreach = new Breach({
        userId,
        passwordHash,
        breachSources: [
          {
            name: breachResult.source,
            dateFound: new Date(),
            severity: breachResult.severity,
            description: "Password found " + breachResult.count + " times",
            affectedAccounts: breachResult.count,
          },
        ],
        timesFound: 1,
      });

      await newBreach.save();
      existingBreach = newBreach;
    }

    // Send notifications if user preferences allow
    const user = await User.findById(userId);

    try {
      if (user.notificationPreferences.email) {
        await emailService.sendBreachNotification(user.email, {
          ...breachResult,
          riskLevel: existingBreach.riskLevel,
          recommendedActions: existingBreach.recommendedActions,
        });
        existingBreach.notificationsSent += 1;
      }

      if (user.notificationPreferences.sms && user.phone) {
        await smsService.sendBreachNotificationSMS(user.phone, breachResult);
      }

      await existingBreach.save();
    } catch (error) {
      logger.error("Failed to send breach notifications:", error);
    }

    return res.json({
      status: "success",
      message: "Password breach detected",
      data: {
        breached: true,
        count: breachResult.count,
        severity: breachResult.severity,
        source: breachResult.source,
        riskLevel: existingBreach.riskLevel,
        recommendedActions: existingBreach.recommendedActions,
        suggestMfa:
          existingBreach.riskLevel === "critical" ||
          existingBreach.riskLevel === "high",
        breachId: existingBreach._id,
      },
    });
  }

  res.json({
    status: "success",
    message: "Password not found in breach databases",
    data: {
      breached: false,
      count: 0,
      source: breachResult.source,
      lastChecked: breachResult.details.lastChecked,
    },
  });
});

/**
 * Get user's breach history
 */
const getBreachHistory = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const breaches = await Breach.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "username email");

  const total = await Breach.countDocuments({ userId });

  // Get breach statistics
  const stats = await breachService.getUserBreachStats(userId);

  res.json({
    status: "success",
    data: {
      breaches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      statistics: stats,
    },
  });
});

/**
 * Get breach details by ID
 */
const getBreachById = catchAsync(async (req, res) => {
  const { breachId } = req.params;
  const userId = req.user._id;

  const breach = await Breach.findOne({
    _id: breachId,
    userId,
  });

  if (!breach) {
    return res.status(404).json({
      status: "fail",
      message: "Breach not found",
    });
  }

  res.json({
    status: "success",
    data: {
      breach,
    },
  });
});

/**
 * Acknowledge a breach
 */
const acknowledgeBreach = catchAsync(async (req, res) => {
  const { breachId } = req.params;
  const userId = req.user._id;

  const breach = await Breach.findOne({
    _id: breachId,
    userId,
  });

  if (!breach) {
    return res.status(404).json({
      status: "fail",
      message: "Breach not found",
    });
  }

  breach.userAcknowledged = true;
  breach.acknowledgedAt = new Date();
  await breach.save();

  res.json({
    status: "success",
    message: "Breach acknowledged successfully",
    data: {
      breach,
    },
  });
});

/**
 * Mark recommended action as completed
 */
const markActionCompleted = catchAsync(async (req, res) => {
  const { breachId } = req.params;
  const { actionIndex } = req.body;
  const userId = req.user._id;

  const breach = await Breach.findOne({
    _id: breachId,
    userId,
  });

  if (!breach) {
    return res.status(404).json({
      status: "fail",
      message: "Breach not found",
    });
  }

  if (actionIndex < 0 || actionIndex >= breach.recommendedActions.length) {
    return res.status(400).json({
      status: "fail",
      message: "Invalid action index",
    });
  }

  breach.recommendedActions[actionIndex].completed = true;
  await breach.save();

  res.json({
    status: "success",
    message: "Action marked as completed",
    data: {
      breach,
    },
  });
});

/**
 * Get breach statistics for admin
 */
const getGlobalBreachStats = catchAsync(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== "admin") {
    return res.status(403).json({
      status: "fail",
      message: "Admin access required",
    });
  }

  const stats = await breachService.getGlobalBreachStats();

  res.json({
    status: "success",
    data: {
      statistics: stats,
    },
  });
});

/**
 * Get recent breaches for admin dashboard
 */
const getRecentBreaches = catchAsync(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== "admin") {
    return res.status(403).json({
      status: "fail",
      message: "Admin access required",
    });
  }

  const limit = parseInt(req.query.limit) || 20;

  const recentBreaches = await Breach.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "username email")
    .select("-passwordHash"); // Don't expose password hashes

  res.json({
    status: "success",
    data: {
      breaches: recentBreaches,
    },
  });
});

/**
 * Search breaches by various criteria
 */
const searchBreaches = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const {
    severity,
    riskLevel,
    acknowledged,
    active,
    dateFrom,
    dateTo,
    source,
  } = req.query;

  const query = { userId };

  if (severity) query["breachSources.severity"] = severity;
  if (riskLevel) query.riskLevel = riskLevel;
  if (acknowledged !== undefined)
    query.userAcknowledged = acknowledged === "true";
  if (active !== undefined) query.isActive = active === "true";
  if (source) query["breachSources.name"] = source;

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const breaches = await Breach.find(query).sort({ createdAt: -1 }).limit(50);

  res.json({
    status: "success",
    data: {
      breaches,
      count: breaches.length,
    },
  });
});

module.exports = {
  checkPasswordBreach,
  getBreachHistory,
  getBreachById,
  acknowledgeBreach,
  markActionCompleted,
  getGlobalBreachStats,
  getRecentBreaches,
  searchBreaches,
};
