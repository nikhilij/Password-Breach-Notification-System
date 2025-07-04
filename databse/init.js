const mongoose = require("mongoose");
const logger = require("../backend/utils/logger");

// Load environment variables
require("../backend/config/env");

/**
 * Initialize the database connection and create indexes
 */
async function initializeDatabase() {
  try {
    // Connect to MongoDB
    logger.info("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info("✅ Connected to MongoDB successfully");

    // Get database instance
    const db = mongoose.connection.db;

    // Create indexes for better performance
    logger.info("Creating database indexes...");

    // User collection indexes
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ username: 1 }, { unique: true });
    await db.collection("users").createIndex({ verificationToken: 1 });
    await db.collection("users").createIndex({ resetPasswordToken: 1 });
    await db.collection("users").createIndex({ createdAt: 1 });

    // Breach collection indexes
    await db.collection("breaches").createIndex({ userId: 1 });
    await db.collection("breaches").createIndex({ breachDate: -1 });
    await db.collection("breaches").createIndex({ severity: 1 });
    await db.collection("breaches").createIndex({ status: 1 });
    await db.collection("breaches").createIndex({
      userId: 1,
      breachDate: -1,
    });

    // Compound indexes for common queries
    await db.collection("breaches").createIndex({
      userId: 1,
      status: 1,
      severity: 1,
    });

    logger.info("✅ Database indexes created successfully");

    // Create admin user if it doesn't exist
    const User = require("../backend/models/User");
    const adminExists = await User.findOne({ role: "admin" });

    if (!adminExists) {
      logger.info("Creating default admin user...");
      const adminUser = new User({
        username: "admin",
        email: "admin@breachnotification.com",
        password: "AdminPassword123!",
        role: "admin",
        isVerified: true,
        notificationPreferences: {
          email: true,
          sms: false,
          push: false,
          frequency: "immediate",
        },
      });

      await adminUser.save();
      logger.info("✅ Default admin user created");
      logger.info("Admin credentials:");
      logger.info("  Email: admin@breachnotification.com");
      logger.info("  Password: AdminPassword123!");
    }

    logger.info("✅ Database initialization completed successfully");
  } catch (error) {
    logger.error("❌ Database initialization failed:", error);
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
  initializeDatabase()
    .then(() => {
      logger.info("Database initialization complete");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Database initialization failed:", error);
      process.exit(1);
    });
}

module.exports = {
  initializeDatabase,
  closeDatabase,
};
