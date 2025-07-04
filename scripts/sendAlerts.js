const mongoose = require("mongoose");
const logger = require("../backend/utils/logger");

// Load environment variables
require("../backend/config/env");

// Import models and services
const User = require("../backend/models/User");
const Breach = require("../backend/models/Breach");
const emailService = require("../backend/services/emailService");
const smsService = require("../backend/services/smsService");

/**
 * Send alerts for unacknowledged breaches
 */
async function sendAlerts() {
  try {
    logger.info("🚀 Starting breach alert notification process...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info("✅ Connected to MongoDB successfully");

    // Get all users with notification preferences
    const users = await User.find({
      isVerified: true,
      "notificationPreferences.email": true,
    }).select("username email phone notificationPreferences");

    logger.info(
      `📧 Found ${users.length} users with email notifications enabled`,
    );

    let alertsSent = 0;
    let emailsSent = 0;
    let smsSent = 0;
    let errors = 0;

    // Process each user
    for (const user of users) {
      try {
        // Get unacknowledged breaches for this user
        const unacknowledgedBreaches = await Breach.find({
          userId: user._id,
          status: "unacknowledged",
          notificationSent: { $ne: true },
        }).sort({ breachDate: -1 });

        if (unacknowledgedBreaches.length === 0) {
          logger.info(
            `✅ No unacknowledged breaches for user: ${user.username}`,
          );
          continue;
        }

        logger.info(
          `🔴 Found ${unacknowledgedBreaches.length} unacknowledged breaches for user: ${user.username}`,
        );

        // Prepare breach summary
        const breachSummary = unacknowledgedBreaches.map((breach) => ({
          name: breach.breachName,
          date: breach.breachDate.toDateString(),
          severity: breach.severity,
          dataClasses: breach.dataClasses,
        }));

        // Send email notification
        if (user.notificationPreferences.email) {
          try {
            await emailService.sendBreachAlert(user.email, {
              username: user.username,
              breaches: breachSummary,
              totalBreaches: unacknowledgedBreaches.length,
            });

            emailsSent++;
            logger.info(`📧 Email sent to ${user.email}`);
          } catch (emailError) {
            logger.error(
              `❌ Failed to send email to ${user.email}:`,
              emailError.message,
            );
            errors++;
          }
        }

        // Send SMS notification if enabled and phone number exists
        if (user.notificationPreferences.sms && user.phone) {
          try {
            const smsMessage = `🔴 BREACH ALERT: ${unacknowledgedBreaches.length} new data breach(es) detected for your account. Please check your dashboard for details. Reply STOP to opt out.`;

            await smsService.sendSMS(user.phone, smsMessage);
            smsSent++;
            logger.info(`📱 SMS sent to ${user.phone}`);
          } catch (smsError) {
            logger.error(
              `❌ Failed to send SMS to ${user.phone}:`,
              smsError.message,
            );
            errors++;
          }
        }

        // Mark breaches as notification sent
        await Breach.updateMany(
          {
            _id: { $in: unacknowledgedBreaches.map((b) => b._id) },
          },
          {
            $set: {
              notificationSent: true,
              notificationSentDate: new Date(),
            },
          },
        );

        alertsSent++;
        logger.info(`✅ Processed alerts for user: ${user.username}`);
      } catch (userError) {
        logger.error(
          `❌ Error processing user ${user.username}:`,
          userError.message,
        );
        errors++;
      }
    }

    // Send summary report to admin
    try {
      await sendAdminSummary({
        totalUsers: users.length,
        alertsSent,
        emailsSent,
        smsSent,
        errors,
      });
    } catch (adminError) {
      logger.error("❌ Failed to send admin summary:", adminError.message);
    }

    logger.info("\n📊 Alert Summary:");
    logger.info(`👥 Total users checked: ${users.length}`);
    logger.info(`🚨 Alerts sent: ${alertsSent}`);
    logger.info(`📧 Emails sent: ${emailsSent}`);
    logger.info(`📱 SMS sent: ${smsSent}`);
    logger.info(`❌ Errors: ${errors}`);
    logger.info("✅ Breach alert process completed successfully");
  } catch (error) {
    logger.error("❌ Breach alert process failed:", error);
    throw error;
  }
}

/**
 * Send weekly digest to users
 */
async function sendWeeklyDigest() {
  try {
    logger.info("📰 Starting weekly digest process...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get users with weekly digest preference
    const users = await User.find({
      isVerified: true,
      "notificationPreferences.email": true,
      "notificationPreferences.frequency": "weekly",
    }).select("username email notificationPreferences");

    logger.info(`📧 Found ${users.length} users subscribed to weekly digest`);

    let digestsSent = 0;
    let errors = 0;

    // Get date range for this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    for (const user of users) {
      try {
        // Get breach statistics for this user
        const totalBreaches = await Breach.countDocuments({ userId: user._id });
        const weeklyBreaches = await Breach.countDocuments({
          userId: user._id,
          createdAt: { $gte: weekAgo },
        });
        const unacknowledgedBreaches = await Breach.countDocuments({
          userId: user._id,
          status: "unacknowledged",
        });

        // Only send digest if there's something to report
        if (totalBreaches > 0 || weeklyBreaches > 0) {
          await emailService.sendWeeklyDigest(user.email, {
            username: user.username,
            totalBreaches,
            weeklyBreaches,
            unacknowledgedBreaches,
          });

          digestsSent++;
          logger.info(`📰 Weekly digest sent to ${user.email}`);
        }
      } catch (userError) {
        logger.error(
          `❌ Error sending digest to ${user.username}:`,
          userError.message,
        );
        errors++;
      }
    }

    logger.info("\n📊 Weekly Digest Summary:");
    logger.info(`👥 Total users checked: ${users.length}`);
    logger.info(`📰 Digests sent: ${digestsSent}`);
    logger.info(`❌ Errors: ${errors}`);
    logger.info("✅ Weekly digest process completed successfully");
  } catch (error) {
    logger.error("❌ Weekly digest process failed:", error);
    throw error;
  }
}

/**
 * Send admin summary report
 */
async function sendAdminSummary(stats) {
  try {
    // Get admin users
    const adminUsers = await User.find({ role: "admin" }).select(
      "email username",
    );

    for (const admin of adminUsers) {
      try {
        await emailService.sendAdminSummary(admin.email, {
          adminName: admin.username,
          date: new Date().toDateString(),
          ...stats,
        });

        logger.info(`📧 Admin summary sent to ${admin.email}`);
      } catch (error) {
        logger.error(
          `❌ Failed to send admin summary to ${admin.email}:`,
          error.message,
        );
      }
    }
  } catch (error) {
    logger.error("❌ Error sending admin summary:", error);
  }
}

/**
 * Send test notification
 */
async function sendTestNotification(email) {
  try {
    logger.info(`🧪 Sending test notification to ${email}...`);

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const user = await User.findOne({ email }).select("username email phone");

    if (!user) {
      throw new Error("User not found");
    }

    // Send test email
    await emailService.sendTestNotification(user.email, {
      username: user.username,
      timestamp: new Date().toISOString(),
    });

    logger.info(`✅ Test notification sent to ${email}`);
  } catch (error) {
    logger.error("❌ Test notification failed:", error);
    throw error;
  }
}

/**
 * Clean up database connection
 */
async function closeDatabase() {
  try {
    await mongoose.connection.close();
    logger.info("✅ Database connection closed");
  } catch (error) {
    logger.error("❌ Error closing database connection:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const command = process.argv[2];
  const param = process.argv[3];

  switch (command) {
    case "alerts":
      sendAlerts()
        .then(() => closeDatabase())
        .then(() => {
          logger.info("Alert process complete");
          process.exit(0);
        })
        .catch((error) => {
          logger.error("Alert process failed:", error);
          process.exit(1);
        });
      break;

    case "digest":
      sendWeeklyDigest()
        .then(() => closeDatabase())
        .then(() => {
          logger.info("Weekly digest process complete");
          process.exit(0);
        })
        .catch((error) => {
          logger.error("Weekly digest process failed:", error);
          process.exit(1);
        });
      break;

    case "test":
      if (!param) {
        logger.error("Please provide an email address for test notification");
        process.exit(1);
      }
      sendTestNotification(param)
        .then(() => closeDatabase())
        .then(() => {
          logger.info("Test notification complete");
          process.exit(0);
        })
        .catch((error) => {
          logger.error("Test notification failed:", error);
          process.exit(1);
        });
      break;

    default:
      logger.info("Usage:");
      logger.info("  node sendAlerts.js alerts    - Send breach alerts");
      logger.info("  node sendAlerts.js digest    - Send weekly digest");
      logger.info("  node sendAlerts.js test <email> - Send test notification");
      process.exit(1);
  }
}

module.exports = {
  sendAlerts,
  sendWeeklyDigest,
  sendTestNotification,
  closeDatabase,
};
