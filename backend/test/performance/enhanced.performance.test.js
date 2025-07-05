const supertest = require("supertest");
const app = require("../../index");
const { expect } = require("chai");
const testUtils = require("../utils/testUtils");

describe("Enhanced Performance Tests", () => {
  let request;
  let testUsers = [];
  let authTokens = [];

  before(async function () {
    this.timeout(60000);

    // Initialize test environment
    await testUtils.initializeTestDB();
    await testUtils.optimizeForTesting();

    request = supertest(app);

    // Pre-create test users for performance testing
    console.log("Creating test users for performance tests...");
    testUsers = await testUtils.createTestUsers(10);

    // Generate auth tokens for all test users
    authTokens = testUsers.map((user) => testUtils.generateTestToken(user));

    console.log("Performance test setup completed");
  });

  after(async function () {
    this.timeout(30000);
    await testUtils.cleanupTestDB();
  });

  describe("Authentication Performance", () => {
    it("should handle login requests efficiently", async function () {
      this.timeout(10000);

      const performanceMonitor = testUtils.createPerformanceMonitor();
      performanceMonitor.start();

      const loginRequests = testUsers.slice(0, 5).map(async (user, index) => {
        const startTime = Date.now();

        try {
          const response = await request.post("/api/auth/login").send({
            email: user.email,
            password: "TestPassword123!", // Raw password before hashing
          });

          const duration = Date.now() - startTime;
          performanceMonitor.recordRequest(duration, response.status !== 200);

          return {
            status: response.status,
            duration,
            index,
          };
        } catch (error) {
          const duration = Date.now() - startTime;
          performanceMonitor.recordRequest(duration, true);

          return {
            status: error.status || 500,
            duration,
            index,
            error: error.message,
          };
        }
      });

      const results = await Promise.allSettled(loginRequests);
      const metrics = performanceMonitor.getMetrics();

      console.log("Login Performance Metrics:", metrics);

      // Performance assertions
      expect(metrics.avgResponseTime).to.be.lessThan(2000); // Average response time < 2s
      expect(metrics.errorRate).to.be.lessThan(20); // Error rate < 20%

      // Check individual results
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const { status, duration } = result.value;
          console.log(`Login ${index + 1}: ${status} - ${duration}ms`);
          expect(duration).to.be.lessThan(5000); // Individual request < 5s
        }
      });
    });

    it("should handle user profile requests efficiently", async function () {
      this.timeout(10000);

      const performanceMonitor = testUtils.createPerformanceMonitor();
      performanceMonitor.start();

      const profileRequests = authTokens
        .slice(0, 5)
        .map(async (token, index) => {
          const startTime = Date.now();

          try {
            const response = await request
              .get("/api/auth/me")
              .set("Authorization", `Bearer ${token}`);

            const duration = Date.now() - startTime;
            performanceMonitor.recordRequest(duration, response.status !== 200);

            return {
              status: response.status,
              duration,
              index,
            };
          } catch (error) {
            const duration = Date.now() - startTime;
            performanceMonitor.recordRequest(duration, true);

            return {
              status: error.status || 500,
              duration,
              index,
              error: error.message,
            };
          }
        });

      const results = await Promise.allSettled(profileRequests);
      const metrics = performanceMonitor.getMetrics();

      console.log("Profile Request Metrics:", metrics);

      // Performance assertions
      expect(metrics.avgResponseTime).to.be.lessThan(1000); // Average response time < 1s
      expect(metrics.errorRate).to.be.lessThan(10); // Error rate < 10%
    });
  });

  describe("Breach Detection Performance", () => {
    it("should handle breach checks efficiently", async function () {
      this.timeout(15000);

      const performanceMonitor = testUtils.createPerformanceMonitor();
      performanceMonitor.start();

      const passwords = [
        "password123",
        "admin123",
        "test123",
        "user123",
        "demo123",
      ];

      const breachRequests = passwords.map(async (password, index) => {
        const startTime = Date.now();
        const token = authTokens[index % authTokens.length];

        try {
          const response = await request
            .post("/api/breach/check")
            .set("Authorization", `Bearer ${token}`)
            .send({ password });

          const duration = Date.now() - startTime;
          performanceMonitor.recordRequest(duration, response.status !== 200);

          return {
            status: response.status,
            duration,
            index,
            password,
          };
        } catch (error) {
          const duration = Date.now() - startTime;
          performanceMonitor.recordRequest(duration, true);

          return {
            status: error.status || 500,
            duration,
            index,
            password,
            error: error.message,
          };
        }
      });

      const results = await Promise.allSettled(breachRequests);
      const metrics = performanceMonitor.getMetrics();

      console.log("Breach Check Metrics:", metrics);

      // Performance assertions
      expect(metrics.avgResponseTime).to.be.lessThan(5000); // Average response time < 5s
      expect(metrics.errorRate).to.be.lessThan(20); // Error rate < 20%
    });
  });

  describe("Notification Performance", () => {
    it("should handle notification preference updates efficiently", async function () {
      this.timeout(10000);

      const performanceMonitor = testUtils.createPerformanceMonitor();
      performanceMonitor.start();

      const updateRequests = authTokens
        .slice(0, 5)
        .map(async (token, index) => {
          const startTime = Date.now();

          try {
            const response = await request
              .put("/api/notifications/preferences")
              .set("Authorization", `Bearer ${token}`)
              .send({
                email: index % 2 === 0,
                sms: index % 3 === 0,
                push: true,
              });

            const duration = Date.now() - startTime;
            performanceMonitor.recordRequest(duration, response.status !== 200);

            return {
              status: response.status,
              duration,
              index,
            };
          } catch (error) {
            const duration = Date.now() - startTime;
            performanceMonitor.recordRequest(duration, true);

            return {
              status: error.status || 500,
              duration,
              index,
              error: error.message,
            };
          }
        });

      const results = await Promise.allSettled(updateRequests);
      const metrics = performanceMonitor.getMetrics();

      console.log("Notification Update Metrics:", metrics);

      // Performance assertions
      expect(metrics.avgResponseTime).to.be.lessThan(1500); // Average response time < 1.5s
      expect(metrics.errorRate).to.be.lessThan(10); // Error rate < 10%
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle mixed concurrent operations efficiently", async function () {
      this.timeout(20000);

      const performanceMonitor = testUtils.createPerformanceMonitor();
      performanceMonitor.start();

      // Mix of different operations
      const operations = [
        // Profile requests
        ...authTokens.slice(0, 3).map((token) => ({
          type: "profile",
          execute: () =>
            request.get("/api/auth/me").set("Authorization", `Bearer ${token}`),
        })),
        // Notification preferences
        ...authTokens.slice(0, 2).map((token) => ({
          type: "notifications",
          execute: () =>
            request
              .get("/api/notifications/preferences")
              .set("Authorization", `Bearer ${token}`),
        })),
        // Breach history
        ...authTokens.slice(0, 2).map((token) => ({
          type: "history",
          execute: () =>
            request
              .get("/api/breach/history")
              .set("Authorization", `Bearer ${token}`),
        })),
      ];

      const mixedRequests = operations.map(async (operation, index) => {
        const startTime = Date.now();

        try {
          const response = await operation.execute();
          const duration = Date.now() - startTime;
          performanceMonitor.recordRequest(duration, response.status >= 400);

          return {
            type: operation.type,
            status: response.status,
            duration,
            index,
          };
        } catch (error) {
          const duration = Date.now() - startTime;
          performanceMonitor.recordRequest(duration, true);

          return {
            type: operation.type,
            status: error.status || 500,
            duration,
            index,
            error: error.message,
          };
        }
      });

      const results = await Promise.allSettled(mixedRequests);
      const metrics = performanceMonitor.getMetrics();

      console.log("Mixed Operations Metrics:", metrics);

      // Performance assertions
      expect(metrics.avgResponseTime).to.be.lessThan(3000); // Average response time < 3s
      expect(metrics.errorRate).to.be.lessThan(25); // Error rate < 25%
      expect(metrics.requestsPerSecond).to.be.greaterThan(1); // At least 1 request per second
    });
  });

  describe("Database Performance", () => {
    it("should handle database queries efficiently", async function () {
      this.timeout(15000);

      // Create test breach data
      const testBreaches = [];
      for (let i = 0; i < 5; i++) {
        const breach = await testUtils.createTestBreach(testUsers[0]._id, {
          severity: ["low", "medium", "high"][i % 3],
          riskLevel: ["low", "medium", "high"][i % 3],
        });
        testBreaches.push(breach);
      }

      const performanceMonitor = testUtils.createPerformanceMonitor();
      performanceMonitor.start();

      const token = authTokens[0];

      // Test various query types
      const queryRequests = [
        // Basic history
        request
          .get("/api/breach/history")
          .set("Authorization", `Bearer ${token}`),
        // Paginated history
        request
          .get("/api/breach/history?page=1&limit=2")
          .set("Authorization", `Bearer ${token}`),
        // Search by severity
        request
          .get("/api/breach/search?severity=high")
          .set("Authorization", `Bearer ${token}`),
        // Search by risk level
        request
          .get("/api/breach/search?riskLevel=medium")
          .set("Authorization", `Bearer ${token}`),
        // Search by acknowledged status
        request
          .get("/api/breach/search?acknowledged=false")
          .set("Authorization", `Bearer ${token}`),
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(queryRequests);
      const totalDuration = Date.now() - startTime;

      console.log(`Database queries completed in ${totalDuration}ms`);

      // Performance assertions
      expect(totalDuration).to.be.lessThan(10000); // All queries < 10s

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          expect(result.value.status).to.be.oneOf([200, 404]); // Allow 404 for empty results
        } else {
          console.error(`Query ${index + 1} failed:`, result.reason);
        }
      });
    });
  });

  describe("Memory and Resource Management", () => {
    it("should not have memory leaks during repeated operations", async function () {
      this.timeout(20000);

      const initialMemory = process.memoryUsage();
      console.log("Initial memory usage:", initialMemory);

      // Perform repeated operations
      for (let i = 0; i < 10; i++) {
        const token = authTokens[i % authTokens.length];

        try {
          await request
            .get("/api/auth/me")
            .set("Authorization", `Bearer ${token}`);

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        } catch (error) {
          // Ignore errors for memory test
        }
      }

      const finalMemory = process.memoryUsage();
      console.log("Final memory usage:", finalMemory);

      // Memory should not increase dramatically
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapIncreasePercent = (heapIncrease / initialMemory.heapUsed) * 100;

      console.log(
        `Heap increase: ${heapIncrease} bytes (${heapIncreasePercent.toFixed(2)}%)`,
      );

      // Allow some memory increase but not excessive
      expect(heapIncreasePercent).to.be.lessThan(50); // Less than 50% increase
    });
  });
});
