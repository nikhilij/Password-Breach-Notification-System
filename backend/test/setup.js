const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const sinon = require("sinon");

// Set test environment
process.env.NODE_ENV = "test";
process.env.RATE_LIMIT_ENABLED = "false";
process.env.JWT_SECRET = "test_jwt_secret_key_for_testing_only";

// In-memory MongoDB server for testing
let mongod = null;

// Enhanced global utilities and helpers for testing
global.testUtils = {
  // Enhanced test user creation
  createTestUser: (overrides = {}) => ({
    username: "testuser",
    email: "test@example.com",
    password: "Test123!@#",
    phone: "+1234567890",
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
  }),

  // Enhanced test breach creation
  createTestBreach: (overrides = {}) => ({
    breachName: "Test Breach",
    description: "Test breach description",
    breachDate: new Date(),
    affectedAccounts: 1000,
    dataClasses: ["Email addresses", "Passwords"],
    severity: "high",
    riskLevel: "high",
    source: "hibp",
    passwordHash: "test_hash_" + Date.now(),
    breachCount: 1,
    sources: ["test_source"],
    recommendedActions: [
      { action: "Change password immediately", completed: false },
      { action: "Enable two-factor authentication", completed: false },
    ],
    acknowledged: false,
    discoveredAt: new Date(),
    ...overrides,
  }),

  // Performance testing utilities
  performanceMonitor: {
    createPerformanceMonitor: () => ({
      requests: 0,
      totalTime: 0,
      errors: 0,
      startTime: Date.now(),
      start: function () {
        this.startTime = Date.now();
      },
      recordRequest: function (duration, isError = false) {
        this.requests++;
        this.totalTime += duration;
        if (isError) this.errors++;
      },
      getMetrics: function () {
        return {
          requests: this.requests,
          totalTime: this.totalTime,
          errors: this.errors,
          avgResponseTime:
            this.requests > 0 ? this.totalTime / this.requests : 0,
          errorRate:
            this.requests > 0 ? (this.errors / this.requests) * 100 : 0,
          requestsPerSecond:
            this.requests / ((Date.now() - this.startTime) / 1000),
        };
      },
    }),
  },

  // Database utilities placeholder
  testDB: null,
};

// No need to import Mocha hooks, they're globally available

// Utility for cleaning up the database
global.cleanupDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
};

// Database connection helper
global.connectTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri);
  console.warn("Connected to in-memory MongoDB server");

  return mongoServer;
};

// Database disconnection helper
global.disconnectTestDB = async (mongoServer) => {
  try {
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.warn("Closed MongoDB connection and stopped MongoDB server");
  } catch (error) {
    console.error("Error during MongoDB shutdown:", error);
  }
};
