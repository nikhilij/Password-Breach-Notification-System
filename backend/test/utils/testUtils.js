// const logger = require('../../utils/logger');nhanced test utilities for better test coverage and performance
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const logger = require("../utils/logger");

class TestUtils {
  constructor() {
    this.mongoServer = null;
    this.testUsers = new Map();
    this.testData = new Map();
  }

  /**
   * Initialize test database with optimized settings
   */
  async initializeTestDB() {
    try {
      // Close existing connections
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }

      // Start in-memory MongoDB server
      this.mongoServer = await MongoMemoryServer.create({
        instance: {
          port: 27018, // Use different port to avoid conflicts
          dbName: "test_password_breach_db",
        },
        binary: {
          version: "7.0.0",
        },
      });

      const mongoUri = this.mongoServer.getUri();

      // Connect with optimized settings for testing
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0,
        bufferCommands: false,
      });

      logger.info("✅ Test database connected successfully");
      return mongoUri;
    } catch (error) {
      logger.error("❌ Test database connection failed:", error);
      throw error;
    }
  }

  /**
   * Clean up test database
   */
  async cleanupTestDB() {
    try {
      if (mongoose.connection.readyState !== 0) {
        // Clear all collections
        const collections = await mongoose.connection.db.collections();
        await Promise.all(
          collections.map((collection) => collection.deleteMany({})),
        );

        await mongoose.connection.close();
      }

      if (this.mongoServer) {
        await this.mongoServer.stop();
        this.mongoServer = null;
      }

      // Clear test data
      this.testUsers.clear();
      this.testData.clear();

      logger.info("✅ Test database cleaned up successfully");
    } catch (error) {
      logger.error("❌ Test database cleanup failed:", error);
      throw error;
    }
  }

  /**
   * Create test user with enhanced data
   */
  async createTestUser(overrides = {}) {
    const User = require("../models/User");
    const bcrypt = require("bcryptjs");

    const defaultUser = {
      email: `test${Date.now()}@example.com`,
      password: "TestPassword123!",
      firstName: "Test",
      lastName: "User",
      isVerified: true,
      role: "user",
      notificationPreferences: {
        email: true,
        sms: false,
        push: true,
      },
      ...overrides,
    };

    // Hash password
    if (defaultUser.password) {
      defaultUser.password = await bcrypt.hash(defaultUser.password, 10);
    }

    const user = new User(defaultUser);
    await user.save();

    // Store for cleanup
    this.testUsers.set(user._id.toString(), user);

    return user;
  }

  /**
   * Create test admin user
   */
  async createTestAdmin(overrides = {}) {
    return this.createTestUser({
      email: `admin${Date.now()}@example.com`,
      role: "admin",
      isVerified: true,
      ...overrides,
    });
  }

  /**
   * Create test breach data
   */
  async createTestBreach(userId, overrides = {}) {
    const Breach = require("../models/Breach");

    const defaultBreach = {
      userId: userId,
      passwordHash: "test_hash_" + Date.now(),
      breachCount: 1,
      severity: "medium",
      riskLevel: "medium",
      sources: ["test_source"],
      recommendedActions: [
        { action: "Change password immediately", completed: false },
        { action: "Enable two-factor authentication", completed: false },
      ],
      acknowledged: false,
      discoveredAt: new Date(),
      ...overrides,
    };

    const breach = new Breach(defaultBreach);
    await breach.save();

    // Store for cleanup
    this.testData.set(breach._id.toString(), breach);

    return breach;
  }

  /**
   * Generate JWT token for test user
   */
  generateTestToken(user) {
    const jwt = require("jsonwebtoken");
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "test_secret",
      { expiresIn: "1h" },
    );
  }

  /**
   * Wait for async operations to complete
   */
  async waitFor(ms = 100) {
    return new Promise((resolve) => global.setTimeout(resolve, ms));
  }

  /**
   * Create multiple test users for concurrent testing
   */
  async createTestUsers(count = 5) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser({
        email: `testuser${i}${Date.now()}@example.com`,
      });
      users.push(user);
    }
    return users;
  }

  /**
   * Mock external services for testing
   */
  setupMocks() {
    const sinon = require("sinon");
    const emailService = require("../services/emailService");
    const smsService = require("../services/smsService");
    const breachService = require("../services/breachService");

    // Mock email service
    const emailStub = sinon.stub(emailService, "sendEmail").resolves({
      success: true,
      messageId: "test_message_id",
    });

    // Mock SMS service
    const smsStub = sinon.stub(smsService, "sendSMS").resolves({
      success: true,
      sid: "test_sms_sid",
    });

    // Mock breach service for API calls
    const breachStub = sinon
      .stub(breachService, "checkPasswordBreach")
      .resolves({
        isBreached: true,
        breachCount: 1489,
        sources: ["test_source"],
      });

    return {
      email: emailStub,
      sms: smsStub,
      breach: breachStub,
      restore: () => {
        emailStub.restore();
        smsStub.restore();
        breachStub.restore();
      },
    };
  }

  /**
   * Performance monitoring utilities
   */
  createPerformanceMonitor() {
    const metrics = {
      requests: 0,
      totalTime: 0,
      errors: 0,
      startTime: Date.now(),
    };

    return {
      start: () => {
        metrics.startTime = Date.now();
      },
      recordRequest: (duration, isError = false) => {
        metrics.requests++;
        metrics.totalTime += duration;
        if (isError) metrics.errors++;
      },
      getMetrics: () => ({
        ...metrics,
        avgResponseTime:
          metrics.requests > 0 ? metrics.totalTime / metrics.requests : 0,
        errorRate:
          metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0,
        requestsPerSecond:
          metrics.requests / ((Date.now() - metrics.startTime) / 1000),
      }),
    };
  }

  /**
   * Database query optimization for tests
   */
  async optimizeForTesting() {
    if (mongoose.connection.readyState === 1) {
      // Disable some mongoose features for faster testing
      mongoose.set("bufferCommands", false);
      mongoose.set("bufferMaxEntries", 0);

      // Create indexes for faster queries
      const User = require("../models/User");
      const Breach = require("../models/Breach");

      await Promise.all([User.createIndexes(), Breach.createIndexes()]);
    }
  }
}

// Export singleton instance
module.exports = new TestUtils();
