const mongoose = require("mongoose");
const logger = require("../backend/utils/logger");

// Load environment variables
require("../backend/config/env");

// Import models
const User = require("../backend/models/User");
const Breach = require("../backend/models/Breach");

/**
 * Sample data for seeding the database
 */
const sampleUsers = [
  {
    username: "john_doe",
    email: "john.doe@example.com",
    password: "SecurePassword123!",
    phone: "+1234567890",
    isVerified: true,
    role: "user",
    notificationPreferences: {
      email: true,
      sms: true,
      push: false,
      frequency: "immediate",
    },
  },
  {
    username: "jane_smith",
    email: "jane.smith@example.com",
    password: "AnotherSecurePass456!",
    phone: "+1987654321",
    isVerified: true,
    role: "user",
    notificationPreferences: {
      email: true,
      sms: false,
      push: true,
      frequency: "daily",
    },
  },
  {
    username: "test_user",
    email: "test@example.com",
    password: "TestPassword789!",
    isVerified: false,
    role: "user",
    notificationPreferences: {
      email: true,
      sms: false,
      push: false,
      frequency: "weekly",
    },
  },
];

const sampleBreaches = [
  {
    breachName: "Example Data Breach 2023",
    description: "A simulated data breach for testing purposes",
    breachDate: new Date("2023-01-15"),
    affectedAccounts: 1000000,
    dataClasses: ["Email addresses", "Passwords", "Phone numbers"],
    severity: "high",
    source: "simulation",
    sourceDetails: {
      hibpData: {
        name: "Example Data Breach 2023",
        title: "Example Data Breach 2023",
        domain: "example.com",
        breachDate: "2023-01-15",
        addedDate: "2023-01-20",
        modifiedDate: "2023-01-20",
        pwnCount: 1000000,
        description: "A simulated data breach for testing purposes",
        dataClasses: ["Email addresses", "Passwords", "Phone numbers"],
        isVerified: true,
        isFabricated: false,
        isSensitive: false,
        isRetired: false,
        isSpamList: false,
      },
    },
  },
  {
    breachName: "Test Service Breach",
    description: "Another simulated breach for testing",
    breachDate: new Date("2023-06-10"),
    affectedAccounts: 500000,
    dataClasses: ["Email addresses", "Usernames"],
    severity: "medium",
    source: "simulation",
    sourceDetails: {
      hibpData: {
        name: "Test Service Breach",
        title: "Test Service Breach",
        domain: "testservice.com",
        breachDate: "2023-06-10",
        addedDate: "2023-06-15",
        modifiedDate: "2023-06-15",
        pwnCount: 500000,
        description: "Another simulated breach for testing",
        dataClasses: ["Email addresses", "Usernames"],
        isVerified: true,
        isFabricated: false,
        isSensitive: false,
        isRetired: false,
        isSpamList: false,
      },
    },
  },
];

/**
 * Seed the database with sample data
 */
async function seedDatabase() {
  try {
    // Connect to MongoDB
    logger.info("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info("✅ Connected to MongoDB successfully");

    // Clear existing data (optional - uncomment if you want to reset)
    // logger.info('Clearing existing data...');
    // await User.deleteMany({ role: { $ne: 'admin' } });
    // await Breach.deleteMany({});

    // Seed users
    logger.info("Seeding users...");
    const createdUsers = [];

    for (const userData of sampleUsers) {
      const existingUser = await User.findOne({
        $or: [{ email: userData.email }, { username: userData.username }],
      });

      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        createdUsers.push(user);
        logger.info(`✅ Created user: ${user.username}`);
      } else {
        logger.info(`⚠️  User already exists: ${userData.username}`);
        createdUsers.push(existingUser);
      }
    }

    // Seed breaches
    logger.info("Seeding breaches...");
    const createdBreaches = [];

    for (const breachData of sampleBreaches) {
      const existingBreach = await Breach.findOne({
        breachName: breachData.breachName,
      });

      if (!existingBreach) {
        const breach = new Breach(breachData);
        await breach.save();
        createdBreaches.push(breach);
        logger.info(`✅ Created breach: ${breach.breachName}`);
      } else {
        logger.info(`⚠️  Breach already exists: ${breachData.breachName}`);
        createdBreaches.push(existingBreach);
      }
    }

    // Create user-specific breach entries
    logger.info("Creating user-specific breach entries...");

    for (const user of createdUsers) {
      for (const breach of createdBreaches) {
        const existingUserBreach = await Breach.findOne({
          userId: user._id,
          breachName: breach.breachName,
        });

        if (!existingUserBreach) {
          const userBreach = new Breach({
            userId: user._id,
            breachName: breach.breachName,
            description: breach.description,
            breachDate: breach.breachDate,
            affectedAccounts: breach.affectedAccounts,
            dataClasses: breach.dataClasses,
            severity: breach.severity,
            source: "user_check",
            status: Math.random() > 0.5 ? "acknowledged" : "unacknowledged",
            actionTaken: Math.random() > 0.7,
            sourceDetails: breach.sourceDetails,
          });

          await userBreach.save();
          logger.info(
            `✅ Created user breach entry for ${user.username}: ${breach.breachName}`,
          );
        }
      }
    }

    logger.info("✅ Database seeding completed successfully");

    // Display summary
    const totalUsers = await User.countDocuments();
    const totalBreaches = await Breach.countDocuments();

    logger.info("\n📊 Database Summary:");
    logger.info(`👥 Total Users: ${totalUsers}`);
    logger.info(`🔴 Total Breach Entries: ${totalBreaches}`);
    logger.info(
      `🛡️  Admin Users: ${await User.countDocuments({ role: "admin" })}`,
    );
    logger.info(
      `🔍 Global Breaches: ${await Breach.countDocuments({ userId: { $exists: false } })}`,
    );
    logger.info(
      `👤 User-specific Breaches: ${await Breach.countDocuments({ userId: { $exists: true } })}`,
    );
  } catch (error) {
    logger.error("❌ Database seeding failed:", error);
    throw error;
  }
}

/**
 * Clear all seeded data (except admin users)
 */
async function clearSeedData() {
  try {
    logger.info("Clearing seeded data...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Delete non-admin users and all breaches
    await User.deleteMany({ role: { $ne: "admin" } });
    await Breach.deleteMany({});

    logger.info("✅ Seeded data cleared successfully");
  } catch (error) {
    logger.error("❌ Error clearing seeded data:", error);
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

  if (command === "clear") {
    clearSeedData()
      .then(() => closeDatabase())
      .then(() => {
        logger.info("Database clearing complete");
        process.exit(0);
      })
      .catch((error) => {
        logger.error("Database clearing failed:", error);
        process.exit(1);
      });
  } else {
    seedDatabase()
      .then(() => closeDatabase())
      .then(() => {
        logger.info("Database seeding complete");
        process.exit(0);
      })
      .catch((error) => {
        logger.error("Database seeding failed:", error);
        process.exit(1);
      });
  }
}

module.exports = {
  seedDatabase,
  clearSeedData,
  closeDatabase,
};
