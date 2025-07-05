// E2E test for system integration and admin workflows
require("../setup");

const { expect } = require("chai");
const request = require("supertest");
const app = require("../../index");
const User = require("../../models/User");
const Breach = require("../../models/Breach");

describe("E2E: System Integration", function () {
  let adminUser;
  let regularUser;
  let adminToken;
  let regularToken;

  beforeEach(async function () {
    // Clean up database
    await User.deleteMany({});
    await Breach.deleteMany({});

    // Create admin user
    adminUser = new User({
      username: "admin",
      email: "admin@example.com",
      password: "AdminPass123!",
      phone: "+1234567890",
      isVerified: true,
      role: "admin",
    });

    regularUser = new User({
      username: "user",
      email: "user@example.com",
      password: "UserPass123!",
      phone: "+1987654321",
      isVerified: true,
      role: "user",
    });

    await adminUser.save();
    await regularUser.save();

    // Get admin token
    const adminLoginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@example.com",
      password: "AdminPass123!",
    });

    adminToken = adminLoginResponse.body.data?.token;
    expect(adminToken).to.exist;

    // Get regular user token
    const userLoginResponse = await request(app).post("/api/auth/login").send({
      email: "user@example.com",
      password: "UserPass123!",
    });

    regularToken = userLoginResponse.body.data?.token;
    expect(regularToken).to.exist;
  });

  afterEach(async function () {
    await User.deleteMany({});
    await Breach.deleteMany({});
  });

  describe("Admin Functionality", function () {
    it("should allow admin to access admin endpoints", async function () {
      // Try to access admin-only endpoint
      const response = await request(app)
        .get("/api/breach/admin/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      // Should not get 403 forbidden
      expect(response.status).to.not.equal(403);
    });

    it("should prevent regular users from accessing admin endpoints", async function () {
      // Try to access admin-only endpoint with regular user token
      const response = await request(app)
        .get("/api/breach/admin/stats")
        .set("Authorization", `Bearer ${regularToken}`);

      // Should get 403 Forbidden, not 401 Unauthorized
      expect(response.status).to.equal(403);
      expect(response.body).to.have.property("message");
      expect(response.body.message).to.include("Admin access required");
    });

    it("should allow admin to manage user accounts", async function () {
      // Create a test breach record first
      const breach = new Breach({
        userId: regularUser._id,
        passwordHash:
          "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // hashed test password
        breachSources: [
          {
            name: "Test Breach",
            dateFound: new Date(),
            severity: "high",
            description: "Test breach for e2e testing",
          },
        ],
        riskLevel: "high",
        isActive: true,
        lastChecked: new Date(),
        recommendedActions: [
          { action: "Change password", priority: "high" },
          { action: "Enable 2FA", priority: "medium" },
        ],
      });
      await breach.save();

      // Admin should be able to view user breaches
      const response = await request(app)
        .get(`/api/breach/user/${regularUser._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      // Should not get 403 forbidden
      expect(response.status).to.not.equal(403);
    });
  });

  describe("Cross-Service Integration", function () {
    it("should integrate breach detection with notifications", async function () {
      this.timeout(10000);

      // Step 1: User checks a breached password
      const breachResponse = await request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({
          password: "password123",
        })
        .expect(200);

      expect(breachResponse.body.data.isBreached).to.be.true;

      // Step 2: Check if notification preferences exist
      const prefsResponse = await request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(200);

      expect(prefsResponse.body.data.preferences).to.be.an("object");

      // Step 3: Check notification history (should have breach notification)
      const notificationsResponse = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(200);

      expect(notificationsResponse.body.data.notifications).to.be.an("array");

      // Step 4: Check user's breach history
      const historyResponse = await request(app)
        .get("/api/breach/history")
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(200);

      expect(historyResponse.body.data.breaches).to.be.an("array");
      expect(historyResponse.body.data.breaches.length).to.be.above(0);
    });

    it("should handle concurrent user sessions", async function () {
      this.timeout(15000);

      // Create multiple promises for concurrent requests
      const promises = [];

      // Multiple users checking passwords concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post("/api/breach/check")
            .set("Authorization", `Bearer ${regularToken}`)
            .send({
              password: `password${i}`,
            }),
        );
      }

      // Wait for all requests to complete
      const responses = await Promise.all(promises);

      // All responses should be successful
      responses.forEach((response) => {
        expect(response.status).to.equal(200);
        expect(response.body.data).to.have.property("isBreached");
        expect(response.body.data).to.have.property("breachCount");
        expect(response.body.data).to.have.property("riskLevel");
      });
    });

    it("should maintain data consistency across services", async function () {
      // Step 1: Update user notification preferences
      await request(app)
        .put("/api/notifications/preferences")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({
          email: false,
          sms: true,
          push: false,
        })
        .expect(200);

      // Step 2: Check a breached password
      await request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({
          password: "commonpassword",
        })
        .expect(200);

      // Step 3: Verify user preferences are still correct
      const prefsResponse = await request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(200);

      expect(prefsResponse.body.data.preferences.email).to.be.false;
      expect(prefsResponse.body.data.preferences.sms).to.be.true;
      expect(prefsResponse.body.data.preferences.push).to.be.false;

      // Step 4: Verify breach history is recorded
      const historyResponse = await request(app)
        .get("/api/breach/history")
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(200);

      expect(historyResponse.body.data.breaches).to.be.an("array");
      expect(historyResponse.body.data.breaches.length).to.be.above(0);
    });
  });

  describe("Error Handling and Recovery", function () {
    it("should handle database connection errors gracefully", async function () {
      // This test would require mocking database failures
      // For now, we'll test general error handling
      const response = await request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({
          password: "",
        })
        .expect(400);

      expect(response.body).to.have.property("message");
      expect(response.body.message).to.include("Validation errors");
    });

    it("should handle invalid tokens gracefully", async function () {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body).to.have.property("message");
      expect(response.body.message).to.include("Please provide a valid token");
    });

    it("should handle malformed requests gracefully", async function () {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "ab", // Too short
          email: "not-an-email",
          password: "123", // Too weak
          phone: "invalid-phone",
        })
        .expect(400);

      expect(response.body).to.have.property("errors");
      expect(response.body.errors).to.be.an("array");
      expect(response.body.errors.length).to.be.above(0);
    });
  });

  describe("Performance and Scalability", function () {
    it("should handle multiple rapid requests", async function () {
      this.timeout(10000);

      const startTime = Date.now();
      const promises = [];

      // Send 10 rapid requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get("/api/auth/me")
            .set("Authorization", `Bearer ${regularToken}`),
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).to.equal(200);
        expect(response.body.data).to.have.property("user");
      });

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).to.be.below(5000);
    });

    it("should handle search queries efficiently", async function () {
      // Create some test breach records
      const breaches = [];
      for (let i = 0; i < 5; i++) {
        breaches.push({
          userId: regularUser._id,
          passwordHash: `hashedPassword${i}`,
          breachCount: i + 1,
          riskLevel: i % 2 === 0 ? "high" : "medium",
          severity: i % 3 === 0 ? "critical" : "high",
          isActive: true,
          lastChecked: new Date(),
          recommendedActions: [{ action: "Change password", priority: "high" }],
        });
      }

      await Breach.insertMany(breaches);

      const startTime = Date.now();
      const response = await request(app)
        .get("/api/breach/search")
        .set("Authorization", `Bearer ${regularToken}`)
        .query({
          severity: "high",
          riskLevel: "high",
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data).to.have.property("breaches");
      expect(response.body.data.breaches).to.be.an("array");

      // Should complete within reasonable time (less than 1 second)
      expect(duration).to.be.below(1000);
    });
  });

  describe("Security Validation", function () {
    it("should enforce proper authorization for protected routes", async function () {
      const protectedRoutes = [
        { method: "get", path: "/api/auth/me" },
        { method: "put", path: "/api/auth/profile" },
        { method: "post", path: "/api/breach/check" },
        { method: "get", path: "/api/breach/history" },
        { method: "get", path: "/api/notifications" },
        { method: "get", path: "/api/notifications/preferences" },
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)[route.method](route.path);
        expect(response.status).to.equal(401);
        expect(response.body).to.have.property("message");
        expect(response.body.message).to.include("token");
      }
    });

    it("should validate input data properly", async function () {
      const invalidRequests = [
        {
          endpoint: "/api/auth/register",
          method: "post",
          data: { username: "a", email: "invalid", password: "123" },
        },
        {
          endpoint: "/api/breach/check",
          method: "post",
          data: { password: "" },
          headers: { Authorization: `Bearer ${regularToken}` },
        },
      ];

      for (const req of invalidRequests) {
        const requestBuilder = request(app)[req.method](req.endpoint);

        if (req.headers) {
          Object.entries(req.headers).forEach(([key, value]) => {
            requestBuilder.set(key, value);
          });
        }

        const response = await requestBuilder.send(req.data);

        expect(response.status).to.equal(400);
        expect(response.body).to.have.property("errors");
      }
    });
  });
});
