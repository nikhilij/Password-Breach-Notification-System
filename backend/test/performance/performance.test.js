// Performance and load testing
require("../setup");

const { expect } = require("chai");
const request = require("supertest");
const app = require("../../index");
const User = require("../../models/User");
const Breach = require("../../models/Breach");
const jwt = require("jsonwebtoken");

describe("Performance Tests", function () {
  let testUser;
  let authToken;

  beforeEach(async function () {
    // Clean up database
    await User.deleteMany({});
    await Breach.deleteMany({});

    // Create test user
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("TestPassword123!", 12);

    testUser = new User({
      username: "testuser",
      email: "test@example.com",
      password: hashedPassword,
      phone: "+1234567890",
      isVerified: true,
    });

    await testUser.save();

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser._id, email: testUser.email },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "1h" },
    );
  });

  afterEach(async function () {
    await User.deleteMany({});
    await Breach.deleteMany({});
  });

  describe("API Response Times", function () {
    it("should respond to authentication requests quickly", async function () {
      this.timeout(5000);

      const startTime = Date.now();
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body).to.have.property("user");
      expect(responseTime).to.be.below(500); // Should respond within 500ms
    });

    it("should handle password breach checks efficiently", async function () {
      this.timeout(10000);

      const startTime = Date.now();
      const response = await request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          password: "password123",
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body).to.have.property("isBreached");
      expect(responseTime).to.be.below(3000); // Should respond within 3 seconds
    });

    it("should handle database queries efficiently", async function () {
      this.timeout(10000);

      // Create test breach records
      const breaches = [];
      for (let i = 0; i < 100; i++) {
        breaches.push({
          userId: testUser._id,
          password: `hashedPassword${i}`,
          breachCount: Math.floor(Math.random() * 10) + 1,
          riskLevel: ["low", "medium", "high", "critical"][
            Math.floor(Math.random() * 4)
          ],
          severity: ["low", "medium", "high", "critical"][
            Math.floor(Math.random() * 4)
          ],
          isActive: Math.random() > 0.5,
          acknowledged: Math.random() > 0.5,
          lastChecked: new Date(),
          recommendedActions: ["Change password", "Enable 2FA"],
        });
      }

      await Breach.insertMany(breaches);

      const startTime = Date.now();
      const response = await request(app)
        .get("/api/breach/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          severity: "high",
          riskLevel: "critical",
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body).to.have.property("breaches");
      expect(responseTime).to.be.below(2000); // Should respond within 2 seconds
    });
  });

  describe("Concurrent Request Handling", function () {
    it("should handle concurrent authentication requests", async function () {
      this.timeout(15000);

      const concurrentRequests = 20;
      const promises = [];

      // Start timer
      const startTime = Date.now();

      // Create concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${authToken}`),
        );
      }

      // Wait for all requests to complete
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach((response, index) => {
        expect(response.status).to.equal(200, `Request ${index + 1} failed`);
        expect(response.body).to.have.property("user");
      });

      // Should complete within reasonable time
      expect(totalTime).to.be.below(10000); // 10 seconds for 20 requests

      // Average response time should be reasonable
      const averageTime = totalTime / concurrentRequests;
      expect(averageTime).to.be.below(1000); // Average less than 1 second
    });

    it("should handle concurrent password checks", async function () {
      this.timeout(30000);

      const concurrentRequests = 10;
      const promises = [];
      const passwords = [
        "password123",
        "123456",
        "password",
        "admin",
        "test123",
        "qwerty",
        "letmein",
        "welcome",
        "monkey",
        "dragon",
      ];

      // Start timer
      const startTime = Date.now();

      // Create concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post("/api/breach/check")
            .set("Authorization", `Bearer ${authToken}`)
            .send({
              password: passwords[i],
            }),
        );
      }

      // Wait for all requests to complete
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach((response, index) => {
        expect(response.status).to.equal(200, `Request ${index + 1} failed`);
        expect(response.body).to.have.property("isBreached");
        expect(response.body).to.have.property("breachCount");
      });

      // Should complete within reasonable time
      expect(totalTime).to.be.below(20000); // 20 seconds for 10 requests

      // Average response time should be reasonable
      const averageTime = totalTime / concurrentRequests;
      expect(averageTime).to.be.below(5000); // Average less than 5 seconds
    });

    it("should handle mixed concurrent operations", async function () {
      this.timeout(20000);

      const promises = [];
      const operations = [
        // Authentication requests
        () =>
          request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${authToken}`),

        // Password checks
        () =>
          request(app)
            .post("/api/breach/check")
            .set("Authorization", `Bearer ${authToken}`)
            .send({ password: "password123" }),

        // Notification preferences
        () =>
          request(app)
            .get("/api/notifications/preferences")
            .set("Authorization", `Bearer ${authToken}`),

        // Breach history
        () =>
          request(app)
            .get("/api/breach/history")
            .set("Authorization", `Bearer ${authToken}`),
      ];

      // Start timer
      const startTime = Date.now();

      // Create 20 mixed requests
      for (let i = 0; i < 20; i++) {
        const operation = operations[i % operations.length];
        promises.push(operation());
      }

      // Wait for all requests to complete
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach((response, index) => {
        expect(response.status).to.equal(200, `Request ${index + 1} failed`);
      });

      // Should complete within reasonable time
      expect(totalTime).to.be.below(15000); // 15 seconds for 20 mixed requests
    });
  });

  describe("Memory Usage and Cleanup", function () {
    it("should not leak memory during repeated operations", async function () {
      this.timeout(30000);

      const iterations = 50;
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform repeated operations
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        // Force garbage collection every 10 iterations
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      // Check memory usage
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePerOp = memoryIncrease / iterations;

      // Memory increase per operation should be minimal
      expect(memoryIncreasePerOp).to.be.below(100000); // Less than 100KB per operation
    });

    it("should clean up database connections properly", async function () {
      this.timeout(10000);

      const mongoose = require("mongoose");
      const initialConnections = mongoose.connections.length;

      // Perform multiple database operations
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get("/api/breach/history")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);
      }

      // Check that we haven't created additional connections
      const finalConnections = mongoose.connections.length;
      expect(finalConnections).to.equal(initialConnections);
    });
  });

  describe("Error Handling Performance", function () {
    it("should handle invalid requests efficiently", async function () {
      this.timeout(10000);

      const concurrentRequests = 20;
      const promises = [];

      // Start timer
      const startTime = Date.now();

      // Create concurrent invalid requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post("/api/breach/check")
            .set("Authorization", `Bearer ${authToken}`)
            .send({
              password: "", // Invalid empty password
            }),
        );
      }

      // Wait for all requests to complete
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests failed appropriately
      responses.forEach((response, index) => {
        expect(response.status).to.equal(
          400,
          `Request ${index + 1} should have failed`,
        );
        expect(response.body).to.have.property("errors");
      });

      // Should complete quickly even with errors
      expect(totalTime).to.be.below(5000); // 5 seconds for 20 invalid requests
    });

    it("should handle authentication failures efficiently", async function () {
      this.timeout(10000);

      const concurrentRequests = 20;
      const promises = [];

      // Start timer
      const startTime = Date.now();

      // Create concurrent requests with invalid tokens
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get("/api/auth/profile")
            .set("Authorization", "Bearer invalid-token"),
        );
      }

      // Wait for all requests to complete
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests failed appropriately
      responses.forEach((response, index) => {
        expect(response.status).to.equal(
          401,
          `Request ${index + 1} should have failed`,
        );
        expect(response.body).to.have.property("message");
      });

      // Should complete quickly even with auth errors
      expect(totalTime).to.be.below(3000); // 3 seconds for 20 auth failures
    });
  });

  describe("Scalability Tests", function () {
    it("should handle large result sets efficiently", async function () {
      this.timeout(30000);

      // Create a large number of breach records
      const breaches = [];
      for (let i = 0; i < 1000; i++) {
        breaches.push({
          userId: testUser._id,
          password: `hashedPassword${i}`,
          breachCount: Math.floor(Math.random() * 100) + 1,
          riskLevel: ["low", "medium", "high", "critical"][
            Math.floor(Math.random() * 4)
          ],
          severity: ["low", "medium", "high", "critical"][
            Math.floor(Math.random() * 4)
          ],
          isActive: Math.random() > 0.5,
          acknowledged: Math.random() > 0.5,
          lastChecked: new Date(
            Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000,
          ),
          recommendedActions: [
            "Change password",
            "Enable 2FA",
            "Review security",
          ],
        });
      }

      await Breach.insertMany(breaches);

      const startTime = Date.now();
      const response = await request(app)
        .get("/api/breach/history")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          limit: 100,
          page: 1,
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body).to.have.property("breaches");
      expect(response.body.breaches).to.be.an("array");
      expect(response.body.breaches.length).to.be.at.most(100);
      expect(responseTime).to.be.below(3000); // Should handle large datasets within 3 seconds
    });

    it("should maintain performance with complex queries", async function () {
      this.timeout(20000);

      // Create diverse breach records
      const breaches = [];
      for (let i = 0; i < 500; i++) {
        breaches.push({
          userId: testUser._id,
          password: `hashedPassword${i}`,
          breachCount: Math.floor(Math.random() * 50) + 1,
          riskLevel: ["low", "medium", "high", "critical"][
            Math.floor(Math.random() * 4)
          ],
          severity: ["low", "medium", "high", "critical"][
            Math.floor(Math.random() * 4)
          ],
          isActive: Math.random() > 0.3,
          acknowledged: Math.random() > 0.6,
          lastChecked: new Date(
            Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000,
          ),
          recommendedActions: [
            "Change password",
            "Enable 2FA",
            "Review security",
            "Contact support",
          ],
        });
      }

      await Breach.insertMany(breaches);

      const startTime = Date.now();
      const response = await request(app)
        .get("/api/breach/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          severity: "high",
          riskLevel: "critical",
          acknowledged: false,
          active: true,
          dateFrom: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body).to.have.property("breaches");
      expect(response.body.breaches).to.be.an("array");
      expect(responseTime).to.be.below(5000); // Complex queries should complete within 5 seconds
    });
  });
});
