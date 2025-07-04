const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const sinon = require("sinon");
// We'll use axios in tests, no need to require here

// In-memory MongoDB server for testing
let mongod = null;

// Global utilities and helpers for testing
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

// No need to import Mocha hooks, they're globally available

// Setup in-memory MongoDB server before all tests
before(async function () {
  this.timeout(30000); // Extended timeout for MongoDB setup
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  try {
    await mongoose.connect(uri);
    console.warn("Connected to in-memory MongoDB server");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
});

// Clear all collections after each test
afterEach(async function () {
  try {
    if (mongoose.connection.readyState === 1) {
      const collections = await mongoose.connection.db.collections();
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }
    // Reset all sinon stubs, mocks, and spies after each test
    sinon.restore();
  } catch (error) {
    console.error("Error cleaning database:", error);
  }
});

// Close MongoDB connection after all tests
after(async function () {
  try {
    await mongoose.connection.close();
    await mongod.stop();
    console.warn("Closed MongoDB connection and stopped MongoDB server");
  } catch (error) {
    console.error("Error during MongoDB shutdown:", error);
  }
});

// Utility for cleaning up the database
global.cleanupDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
};
