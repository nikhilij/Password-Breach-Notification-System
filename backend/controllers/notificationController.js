const User = require("../models/User");
const Breach = require("../models/Breach");
const logger = require("../utils/logger");
const { catchAsync } = require("../middlewares/errorHandler");

/**
 * Get user's notification preferences
 */
const getNotificationPreferences = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "notificationPreferences",
  );

  res.json({
    status: "success",
    data: {
      preferences: user.notificationPreferences,
    },
  });
});

/**
 * Update user's notification preferences
 */
const updateNotificationPreferences = catchAsync(async (req, res) => {
  const { email, sms, push } = req.body;
  const userId = req.user._id;

  const user = await User.findById(userId);

  if (email !== undefined) user.notificationPreferences.email = email;
  if (sms !== undefined) user.notificationPreferences.sms = sms;
  if (push !== undefined) user.notificationPreferences.push = push;

  await user.save();

  res.json({
    status: "success",
    message: "Notification preferences updated successfully",
    data: {
      preferences: user.notificationPreferences,
    },
  });
});

/**
 * Get user's notifications/alerts
 */
const getNotifications = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Get recent breaches as notifications
  const breaches = await Breach.find({
    userId,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Breach.countDocuments({
    userId,
    isActive: true,
  });

  // Transform breaches into notification format
  const notifications = breaches.map((breach) => ({
    id: breach._id,
    type: "breach_alert",
    title: "Password Breach Detected",
    message: `Your password was found in ${breach.breachSources.length} breach source(s)`,
    severity: breach.riskLevel,
    isRead: breach.userAcknowledged,
    createdAt: breach.createdAt,
    data: {
      breachId: breach._id,
      riskLevel: breach.riskLevel,
      sources: breach.breachSources.map((source) => source.name),
      timesFound: breach.timesFound,
      recommendedActions: breach.recommendedActions,
    },
  }));

  res.json({
    status: "success",
    data: {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Mark notification as read
 */
const markNotificationAsRead = catchAsync(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  // Since notifications are based on breaches, mark breach as acknowledged
  const breach = await Breach.findOne({
    _id: notificationId,
    userId,
  });

  if (!breach) {
    return res.status(404).json({
      status: "fail",
      message: "Notification not found",
    });
  }

  breach.userAcknowledged = true;
  breach.acknowledgedAt = new Date();
  await breach.save();

  res.json({
    status: "success",
    message: "Notification marked as read",
  });
});

/**
 * Mark all notifications as read
 */
const markAllNotificationsAsRead = catchAsync(async (req, res) => {
  const userId = req.user._id;

  await Breach.updateMany(
    { userId, userAcknowledged: false },
    {
      userAcknowledged: true,
      acknowledgedAt: new Date(),
    },
  );

  res.json({
    status: "success",
    message: "All notifications marked as read",
  });
});

/**
 * Get notification statistics
 */
const getNotificationStats = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const stats = await Breach.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        unreadNotifications: {
          $sum: { $cond: [{ $eq: ["$userAcknowledged", false] }, 1, 0] },
        },
        criticalNotifications: {
          $sum: { $cond: [{ $eq: ["$riskLevel", "critical"] }, 1, 0] },
        },
        highNotifications: {
          $sum: { $cond: [{ $eq: ["$riskLevel", "high"] }, 1, 0] },
        },
        totalNotificationsSent: { $sum: "$notificationsSent" },
      },
    },
  ]);

  const result = stats[0] || {
    totalNotifications: 0,
    unreadNotifications: 0,
    criticalNotifications: 0,
    highNotifications: 0,
    totalNotificationsSent: 0,
  };

  res.json({
    status: "success",
    data: {
      statistics: result,
    },
  });
});

/**
 * Test notification sending (for development/testing)
 */
const testNotification = catchAsync(async (req, res) => {
  const { type } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      status: "fail",
      message: "User not found",
    });
  }

  try {
    let result = false;

    switch (type) {
      case "email":
        if (user.notificationPreferences.email) {
          const emailService = require("../services/emailService");
          result = await emailService.sendBreachNotification(user.email, {
            count: 12345,
            severity: "high",
            source: "Test Source",
          });
        }
        break;

      case "sms":
        if (user.notificationPreferences.sms && user.phone) {
          const smsService = require("../services/smsService");
          result = await smsService.sendBreachNotificationSMS(user.phone, {
            count: 12345,
            severity: "high",
            source: "Test Source",
          });
        }
        break;

      default:
        return res.status(400).json({
          status: "fail",
          message: 'Invalid notification type. Use "email" or "sms"',
        });
    }

    res.json({
      status: "success",
      message: `Test ${type} notification ${result ? "sent successfully" : "failed to send"}`,
      data: {
        sent: result,
      },
    });
  } catch (error) {
    logger.error("Error sending test notification:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send test notification",
    });
  }
});

/**
 * Get notification delivery history
 */
const getNotificationHistory = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const history = await Breach.find({
    userId,
    notificationsSent: { $gt: 0 },
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select("breachSources notificationsSent createdAt riskLevel");

  const total = await Breach.countDocuments({
    userId,
    notificationsSent: { $gt: 0 },
  });

  res.json({
    status: "success",
    data: {
      history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

module.exports = {
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationStats,
  testNotification,
  getNotificationHistory,
};
