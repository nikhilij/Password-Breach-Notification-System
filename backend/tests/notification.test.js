const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/User");
const Breach = require("../models/Breach");

// Test database
const MONGO_URI =
  process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/breachdb_test";

describe("Notification Endpoints", () => {
  let testUser;
  let testToken;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Breach.deleteMany({});

    // Create test user
    testUser = new User({
      username: "testuser",
      email: "test@example.com",
      password: "Test123!@#",
      phone: "+1234567890",
      isVerified: true,
      notificationPreferences: {
        email: true,
        sms: false,
        push: false,
        frequency: "immediate",
      },
    });
    await testUser.save();

    // Create admin user
    adminUser = new User({
      username: "admin",
      email: "admin@example.com",
      password: "Admin123!@#",
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

    // Get tokens
    const userLogin = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "Test123!@#",
    });
    testToken = userLogin.body.data.token;

    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin@example.com",
      password: "Admin123!@#",
    });
    adminToken = adminLogin.body.data.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("GET /api/notifications/preferences", () => {
    it("should get user notification preferences", async () => {
      const response = await request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.preferences).toBeDefined();
      expect(response.body.data.preferences.email).toBe(true);
      expect(response.body.data.preferences.frequency).toBe("immediate");
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await request(app)
        .get("/api/notifications/preferences")
        .expect(401);

      expect(response.body.status).toBe("error");
      expect(response.body.message).toContain("token");
    });
  });

  describe("PUT /api/notifications/preferences", () => {
    it("should update notification preferences", async () => {
      const newPreferences = {
        email: false,
        sms: true,
        push: true,
        frequency: "daily",
      };

      const response = await request(app)
        .put("/api/notifications/preferences")
        .set("Authorization", `Bearer ${testToken}`)
        .send(newPreferences)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.preferences.email).toBe(false);
      expect(response.body.data.preferences.sms).toBe(true);
      expect(response.body.data.preferences.frequency).toBe("daily");
    });

    it("should validate frequency values", async () => {
      const invalidPreferences = {
        email: true,
        frequency: "invalid",
      };

      const response = await request(app)
        .put("/api/notifications/preferences")
        .set("Authorization", `Bearer ${testToken}`)
        .send(invalidPreferences)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.message).toContain("frequency");
    });
  });

  describe("GET /api/notifications", () => {
    beforeEach(async () => {
      // Create some test breaches with notifications
      await Breach.create([
        {
          userId: testUser._id,
          breachName: "Test Breach 1",
          description: "Test breach 1 description",
          breachDate: new Date(),
          affectedAccounts: 1000,
          dataClasses: ["Email addresses"],
          severity: "high",
          source: "hibp",
          status: "unacknowledged",
        },
        {
          userId: testUser._id,
          breachName: "Test Breach 2",
          description: "Test breach 2 description",
          breachDate: new Date(),
          affectedAccounts: 500,
          dataClasses: ["Passwords"],
          severity: "medium",
          source: "hibp",
          status: "acknowledged",
        },
      ]);
    });

    it("should get user notifications", async () => {
      const response = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.notifications).toBeDefined();
      expect(Array.isArray(response.body.data.notifications)).toBe(true);
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/notifications?page=1&limit=1")
        .set("Authorization", `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });
  });

  describe("GET /api/notifications/stats", () => {
    beforeEach(async () => {
      // Create test breaches for stats
      await Breach.create([
        {
          userId: testUser._id,
          breachName: "High Severity Breach",
          description: "High severity test breach",
          breachDate: new Date(),
          affectedAccounts: 1000,
          dataClasses: ["Email addresses"],
          severity: "high",
          source: "hibp",
          status: "unacknowledged",
        },
        {
          userId: testUser._id,
          breachName: "Medium Severity Breach",
          description: "Medium severity test breach",
          breachDate: new Date(),
          affectedAccounts: 500,
          dataClasses: ["Passwords"],
          severity: "medium",
          source: "hibp",
          status: "acknowledged",
        },
      ]);
    });

    it("should get notification statistics", async () => {
      const response = await request(app)
        .get("/api/notifications/stats")
        .set("Authorization", `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.totalNotifications).toBeDefined();
      expect(response.body.data.stats.unreadNotifications).toBeDefined();
      expect(response.body.data.stats.severityBreakdown).toBeDefined();
    });
  });

  describe("POST /api/notifications/test", () => {
    it("should send test notification", async () => {
      const response = await request(app)
        .post("/api/notifications/test")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          type: "email",
          message: "Test notification message",
        })
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("sent");
    });

    it("should validate notification type", async () => {
      const response = await request(app)
        .post("/api/notifications/test")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          type: "invalid",
          message: "Test message",
        })
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.message).toContain("type");
    });
  });

  describe("PUT /api/notifications/mark-all-read", () => {
    beforeEach(async () => {
      // Create unread notifications
      await Breach.create([
        {
          userId: testUser._id,
          breachName: "Unread Breach 1",
          description: "Unread breach 1",
          breachDate: new Date(),
          affectedAccounts: 1000,
          dataClasses: ["Email addresses"],
          severity: "high",
          source: "hibp",
          status: "unacknowledged",
          isRead: false,
        },
        {
          userId: testUser._id,
          breachName: "Unread Breach 2",
          description: "Unread breach 2",
          breachDate: new Date(),
          affectedAccounts: 500,
          dataClasses: ["Passwords"],
          severity: "medium",
          source: "hibp",
          status: "unacknowledged",
          isRead: false,
        },
      ]);
    });

    it("should mark all notifications as read", async () => {
      const response = await request(app)
        .put("/api/notifications/mark-all-read")
        .set("Authorization", `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.modifiedCount).toBeGreaterThan(0);
    });
  });

  describe("GET /api/notifications/history", () => {
    it("should get notification history", async () => {
      const response = await request(app)
        .get("/api/notifications/history")
        .set("Authorization", `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.history).toBeDefined();
      expect(Array.isArray(response.body.data.history)).toBe(true);
    });

    it("should support date range filtering", async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      const toDate = new Date();

      const response = await request(app)
        .get(
          `/api/notifications/history?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`,
        )
        .set("Authorization", `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.history).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Close database connection to simulate error
      await mongoose.connection.close();

      const response = await request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", `Bearer ${testToken}`)
        .expect(500);

      expect(response.body.status).toBe("error");

      // Reconnect for cleanup
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    });

    it("should handle invalid token", async () => {
      const response = await request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.status).toBe("error");
    });
  });
});
