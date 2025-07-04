// E2E test for complete user workflow
require("../setup");

const { expect } = require("chai");
const request = require("supertest");
const app = require("../../index");
const User = require("../../models/User");
const Breach = require("../../models/Breach");

describe("E2E: Complete User Workflow", function () {
  let userData;
  let authToken;

  beforeEach(async function () {
    // Clean up database
    await User.deleteMany({});
    await Breach.deleteMany({});

    userData = {
      username: "e2euser",
      email: "e2euser@example.com",
      password: "E2EPassword123!",
      phone: "+1234567890",
    };
  });

  afterEach(async function () {
    await User.deleteMany({});
    await Breach.deleteMany({});
  });

  describe("Complete User Journey", function () {
    it("should complete full user registration to breach detection workflow", async function () {
      this.timeout(10000);

      // Step 1: User Registration
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(registerResponse.body).to.have.property("message");
      expect(registerResponse.body.message).to.include(
        "registered successfully",
      );

      // Step 2: User Login
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginResponse.body).to.have.property("token");
      expect(loginResponse.body).to.have.property("user");
      authToken = loginResponse.body.token;

      // Step 3: Update User Profile
      const profileUpdateResponse = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          phone: "+1987654321",
          username: "updateduser",
        })
        .expect(200);

      expect(profileUpdateResponse.body).to.have.property("message");
      expect(profileUpdateResponse.body.message).to.include(
        "updated successfully",
      );

      // Step 4: Get User Profile
      const profileResponse = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(profileResponse.body.user).to.have.property(
        "phone",
        "+1987654321",
      );
      expect(profileResponse.body.user).to.have.property(
        "username",
        "updateduser",
      );

      // Step 5: Check Password for Breach
      const breachCheckResponse = await request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          password: "password123",
        })
        .expect(200);

      expect(breachCheckResponse.body).to.have.property("isBreached");
      expect(breachCheckResponse.body).to.have.property("breachCount");
      expect(breachCheckResponse.body).to.have.property("riskLevel");

      // Step 6: Get Notification Preferences
      const notificationPrefsResponse = await request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(notificationPrefsResponse.body).to.have.property("preferences");
      expect(notificationPrefsResponse.body.preferences).to.have.property(
        "email",
      );
      expect(notificationPrefsResponse.body.preferences).to.have.property(
        "sms",
      );

      // Step 7: Update Notification Preferences
      const updatePrefsResponse = await request(app)
        .put("/api/notifications/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          email: false,
          sms: true,
          push: false,
        })
        .expect(200);

      expect(updatePrefsResponse.body).to.have.property("message");
      expect(updatePrefsResponse.body.message).to.include(
        "updated successfully",
      );

      // Step 8: Get User Notifications
      const notificationsResponse = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(notificationsResponse.body).to.have.property("notifications");
      expect(notificationsResponse.body.notifications).to.be.an("array");

      // Step 9: Search User's Breaches
      const breachSearchResponse = await request(app)
        .get("/api/breach/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          severity: "high",
          acknowledged: false,
        })
        .expect(200);

      expect(breachSearchResponse.body).to.have.property("breaches");
      expect(breachSearchResponse.body.breaches).to.be.an("array");

      // Step 10: Get User's Breach History
      const breachHistoryResponse = await request(app)
        .get("/api/breach/history")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(breachHistoryResponse.body).to.have.property("breaches");
      expect(breachHistoryResponse.body.breaches).to.be.an("array");
    });

    it("should handle authentication errors gracefully", async function () {
      // Try to access protected endpoint without token
      const response = await request(app).get("/api/auth/profile").expect(401);

      expect(response.body).to.have.property("message");
      expect(response.body.message).to.include("token");
    });

    it("should handle invalid credentials during login", async function () {
      // First register a user
      await request(app).post("/api/auth/register").send(userData).expect(201);

      // Try to login with wrong password
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: "wrongpassword",
        })
        .expect(401);

      expect(response.body).to.have.property("message");
      expect(response.body.message).to.include("Invalid credentials");
    });

    it("should prevent duplicate user registration", async function () {
      // Register first user
      await request(app).post("/api/auth/register").send(userData).expect(201);

      // Try to register same user again
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).to.have.property("message");
      expect(response.body.message).to.include("already exists");
    });

    it("should validate input data properly", async function () {
      // Try to register with invalid email
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "invalid-email",
          password: "ValidPassword123!",
          phone: "+1234567890",
        })
        .expect(400);

      expect(response.body).to.have.property("errors");
      expect(response.body.errors).to.be.an("array");
    });
  });

  describe("Password Breach Detection Workflow", function () {
    beforeEach(async function () {
      // Register and login user
      await request(app).post("/api/auth/register").send(userData).expect(201);

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      authToken = loginResponse.body.token;
    });

    it("should detect and track password breaches", async function () {
      // Check a commonly breached password
      const breachResponse = await request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          password: "password123",
        })
        .expect(200);

      expect(breachResponse.body.isBreached).to.be.true;
      expect(breachResponse.body.breachCount).to.be.above(0);
      expect(breachResponse.body.riskLevel).to.be.oneOf([
        "low",
        "medium",
        "high",
        "critical",
      ]);

      // Check breach history
      const historyResponse = await request(app)
        .get("/api/breach/history")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.breaches).to.have.length.above(0);
    });

    it("should handle secure passwords correctly", async function () {
      // Check a presumably secure password
      const breachResponse = await request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          password: "VerySecurePassword123!@#$%",
        })
        .expect(200);

      expect(breachResponse.body).to.have.property("isBreached");
      expect(breachResponse.body).to.have.property("breachCount");
      expect(breachResponse.body).to.have.property("riskLevel");
    });
  });

  describe("Notification System Workflow", function () {
    beforeEach(async function () {
      // Register and login user
      await request(app).post("/api/auth/register").send(userData).expect(201);

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      authToken = loginResponse.body.token;
    });

    it("should manage notification preferences", async function () {
      // Get initial preferences
      const initialPrefs = await request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(initialPrefs.body.preferences).to.have.property("email");
      expect(initialPrefs.body.preferences).to.have.property("sms");

      // Update preferences
      const updateResponse = await request(app)
        .put("/api/notifications/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          email: false,
          sms: true,
          push: false,
        })
        .expect(200);

      expect(updateResponse.body.message).to.include("updated successfully");

      // Verify preferences were updated
      const updatedPrefs = await request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(updatedPrefs.body.preferences.email).to.be.false;
      expect(updatedPrefs.body.preferences.sms).to.be.true;
    });

    it("should retrieve notification history", async function () {
      const response = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property("notifications");
      expect(response.body.notifications).to.be.an("array");
    });

    it("should provide notification statistics", async function () {
      const response = await request(app)
        .get("/api/notifications/stats")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property("stats");
      expect(response.body.stats).to.be.an("object");
    });
  });
});
