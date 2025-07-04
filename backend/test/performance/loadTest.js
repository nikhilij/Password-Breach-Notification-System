// Load testing script for the API
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../index");
const User = require("../../models/User");
const Breach = require("../../models/Breach");

// Configuration
const LOAD_TEST_CONFIG = {
  CONCURRENT_USERS: 10,
  REQUESTS_PER_USER: 5,
  TEST_DURATION: 30000, // 30 seconds
  RAMP_UP_TIME: 5000, // 5 seconds
};

class LoadTester {
  constructor(config) {
    this.config = config;
    this.users = [];
    this.tokens = [];
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      responseTimes: [],
      errors: [],
    };
  }

  async setup() {
    console.log("🚀 Setting up load test environment...");

    // Clean up database
    await User.deleteMany({});
    await Breach.deleteMany({});

    // Create test users
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("LoadTest123!", 12);

    for (let i = 0; i < this.config.CONCURRENT_USERS; i++) {
      const user = new User({
        username: `loaduser${i}`,
        email: `loaduser${i}@example.com`,
        password: hashedPassword,
        phone: `+123456789${i}`,
        isVerified: true,
      });

      await user.save();
      this.users.push(user);

      // Generate auth token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "1h" },
      );

      this.tokens.push(token);
    }

    console.log(`✅ Created ${this.config.CONCURRENT_USERS} test users`);
  }

  async cleanup() {
    console.log("🧹 Cleaning up test environment...");
    await User.deleteMany({});
    await Breach.deleteMany({});
    console.log("✅ Cleanup completed");
  }

  async makeRequest(userIndex, requestType) {
    const token = this.tokens[userIndex];
    const startTime = Date.now();

    try {
      let response;

      switch (requestType) {
        case "auth":
          response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${token}`);
          break;

        case "breach-check":
          response = await request(app)
            .post("/api/breach/check")
            .set("Authorization", `Bearer ${token}`)
            .send({
              password: `password${Math.floor(Math.random() * 1000)}`,
            });
          break;

        case "notifications":
          response = await request(app)
            .get("/api/notifications/preferences")
            .set("Authorization", `Bearer ${token}`);
          break;

        case "breach-history":
          response = await request(app)
            .get("/api/breach/history")
            .set("Authorization", `Bearer ${token}`);
          break;

        default:
          response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${token}`);
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      this.results.totalRequests++;
      this.results.responseTimes.push(responseTime);
      this.results.minResponseTime = Math.min(
        this.results.minResponseTime,
        responseTime,
      );
      this.results.maxResponseTime = Math.max(
        this.results.maxResponseTime,
        responseTime,
      );

      if (response.status >= 200 && response.status < 400) {
        this.results.successfulRequests++;
      } else {
        this.results.failedRequests++;
        this.results.errors.push({
          status: response.status,
          error: response.body.message || "Unknown error",
          requestType,
        });
      }

      return { success: true, responseTime, status: response.status };
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      this.results.totalRequests++;
      this.results.failedRequests++;
      this.results.errors.push({
        error: error.message,
        requestType,
      });

      return { success: false, responseTime, error: error.message };
    }
  }

  async runLoadTest() {
    console.log("🔥 Starting load test...");
    console.log(
      `Configuration: ${this.config.CONCURRENT_USERS} users, ${this.config.REQUESTS_PER_USER} requests per user`,
    );

    const startTime = Date.now();
    const promises = [];

    // Create load test promises
    for (
      let userIndex = 0;
      userIndex < this.config.CONCURRENT_USERS;
      userIndex++
    ) {
      // Stagger user start times (ramp up)
      const delay =
        (userIndex * this.config.RAMP_UP_TIME) / this.config.CONCURRENT_USERS;

      promises.push(this.simulateUser(userIndex, delay));
    }

    // Wait for all users to complete
    await Promise.all(promises);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Calculate statistics
    this.results.averageResponseTime =
      this.results.responseTimes.reduce((sum, time) => sum + time, 0) /
      this.results.responseTimes.length;

    console.log("📊 Load test completed!");
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Total requests: ${this.results.totalRequests}`);
    console.log(`Successful requests: ${this.results.successfulRequests}`);
    console.log(`Failed requests: ${this.results.failedRequests}`);
    console.log(
      `Success rate: ${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%`,
    );
    console.log(
      `Average response time: ${this.results.averageResponseTime.toFixed(2)}ms`,
    );
    console.log(`Min response time: ${this.results.minResponseTime}ms`);
    console.log(`Max response time: ${this.results.maxResponseTime}ms`);
    console.log(
      `Requests per second: ${(this.results.totalRequests / (totalTime / 1000)).toFixed(2)}`,
    );

    if (this.results.errors.length > 0) {
      console.log("❌ Errors encountered:");
      this.results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.error} (${error.requestType})`);
      });
    }

    return this.results;
  }

  async simulateUser(userIndex, delay) {
    // Wait for ramp up delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const requestTypes = [
      "auth",
      "breach-check",
      "notifications",
      "breach-history",
    ];
    const promises = [];

    // Create requests for this user
    for (let i = 0; i < this.config.REQUESTS_PER_USER; i++) {
      const requestType =
        requestTypes[Math.floor(Math.random() * requestTypes.length)];
      promises.push(this.makeRequest(userIndex, requestType));
    }

    // Execute all requests for this user
    await Promise.all(promises);
  }

  async runStressTest() {
    console.log("💪 Starting stress test...");

    const stressConfig = {
      ...this.config,
      CONCURRENT_USERS: 50,
      REQUESTS_PER_USER: 10,
      TEST_DURATION: 60000, // 1 minute
      RAMP_UP_TIME: 10000, // 10 seconds
    };

    const oldConfig = this.config;
    this.config = stressConfig;

    // Need to create more users for stress test
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("StressTest123!", 12);

    for (let i = this.users.length; i < stressConfig.CONCURRENT_USERS; i++) {
      const user = new User({
        username: `stressuser${i}`,
        email: `stressuser${i}@example.com`,
        password: hashedPassword,
        phone: `+123456789${i}`,
        isVerified: true,
      });

      await user.save();
      this.users.push(user);

      // Generate auth token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "1h" },
      );

      this.tokens.push(token);
    }

    const results = await this.runLoadTest();

    // Restore original config
    this.config = oldConfig;

    return results;
  }
}

// Main execution
async function main() {
  console.log("🧪 Starting API Load Testing Suite");
  console.log("===================================");

  const loadTester = new LoadTester(LOAD_TEST_CONFIG);

  try {
    // Setup
    await loadTester.setup();

    // Run basic load test
    console.log("\n1. Running basic load test...");
    const loadResults = await loadTester.runLoadTest();

    // Run stress test
    console.log("\n2. Running stress test...");
    const stressResults = await loadTester.runStressTest();

    // Performance analysis
    console.log("\n📈 Performance Analysis:");
    console.log("========================");

    console.log(
      `Load Test Success Rate: ${((loadResults.successfulRequests / loadResults.totalRequests) * 100).toFixed(2)}%`,
    );
    console.log(
      `Stress Test Success Rate: ${((stressResults.successfulRequests / stressResults.totalRequests) * 100).toFixed(2)}%`,
    );

    console.log(
      `Load Test Avg Response Time: ${loadResults.averageResponseTime.toFixed(2)}ms`,
    );
    console.log(
      `Stress Test Avg Response Time: ${stressResults.averageResponseTime.toFixed(2)}ms`,
    );

    // Performance thresholds
    const performanceThresholds = {
      minSuccessRate: 95,
      maxAverageResponseTime: 2000,
      maxFailureRate: 5,
    };

    console.log("\n🎯 Performance Thresholds:");
    console.log(
      `Minimum Success Rate: ${performanceThresholds.minSuccessRate}%`,
    );
    console.log(
      `Maximum Average Response Time: ${performanceThresholds.maxAverageResponseTime}ms`,
    );
    console.log(
      `Maximum Failure Rate: ${performanceThresholds.maxFailureRate}%`,
    );

    // Check if performance meets thresholds
    const loadSuccessRate =
      (loadResults.successfulRequests / loadResults.totalRequests) * 100;
    const stressSuccessRate =
      (stressResults.successfulRequests / stressResults.totalRequests) * 100;

    if (
      loadSuccessRate >= performanceThresholds.minSuccessRate &&
      stressSuccessRate >= performanceThresholds.minSuccessRate &&
      loadResults.averageResponseTime <=
        performanceThresholds.maxAverageResponseTime &&
      stressResults.averageResponseTime <=
        performanceThresholds.maxAverageResponseTime
    ) {
      console.log("\n✅ All performance thresholds met!");
    } else {
      console.log("\n❌ Some performance thresholds not met!");
    }
  } catch (error) {
    console.error("💥 Load test failed:", error);
    process.exit(1);
  } finally {
    // Cleanup
    await loadTester.cleanup();
  }

  console.log("\n🏁 Load testing completed!");
  process.exit(0);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { LoadTester, LOAD_TEST_CONFIG };
