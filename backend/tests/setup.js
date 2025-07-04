// Jest setup file
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Increase timeout for all tests
jest.setTimeout(30000);

// Mock console.log in tests unless explicitly testing logging
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock external services
jest.mock("../services/emailService", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendBreachAlert: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWeeklyDigest: jest.fn().mockResolvedValue(true),
  sendTestNotification: jest.fn().mockResolvedValue(true),
  sendAdminSummary: jest.fn().mockResolvedValue(true),
}));

jest.mock("../services/smsService", () => ({
  sendSMS: jest.fn().mockResolvedValue(true),
  sendBreachAlert: jest.fn().mockResolvedValue(true),
}));

jest.mock("../services/breachService", () => ({
  checkBreachesForEmail: jest.fn().mockResolvedValue([]),
  checkBreachesForPassword: jest.fn().mockResolvedValue({ breached: false }),
  getBreachStats: jest.fn().mockResolvedValue({
    totalBreaches: 0,
    recentBreaches: 0,
    severityBreakdown: { high: 0, medium: 0, low: 0 },
  }),
}));

// Global test utilities
global.testUtils = {
  createTestUser: (overrides = {}) => ({
    username: "testuser",
    email: "test@example.com",
    password: "Test123!@#",
    phone: "+1234567890",
    isVerified: true,
    ...overrides,
  }),

  createTestBreach: (overrides = {}) => ({
    breachName: "Test Breach",
    description: "Test breach description",
    breachDate: new Date(),
    affectedAccounts: 1000,
    dataClasses: ["Email addresses"],
    severity: "high",
    source: "hibp",
    ...overrides,
  }),
};

// Clean up function
global.cleanupDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  }
};
