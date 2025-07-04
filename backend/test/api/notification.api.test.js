// API tests for notification endpoints
require("../setup");

const { expect } = require("chai");
const request = require("supertest");
const sinon = require("sinon");
const app = require("../../index");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");

describe("Notification API", function () {
  let testUser;
  let authToken;

  beforeEach(async function () {
    // Clean up database
    await User.deleteMany({});

    // Create test user
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("TestPassword123!", 12);

    testUser = new User({
      username: "testuser",
      email: "test@example.com",
      password: hashedPassword,
      phone: "+1234567890",
      isVerified: true,
      notificationPreferences: {
        email: true,
        sms: true,
        push: false,
      },
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
    sinon.restore();
  });

  describe("GET /api/notifications/preferences", function () {
    it("should return user notification preferences", function (done) {
      request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("preferences");
          expect(res.body.preferences).to.have.property("email");
          expect(res.body.preferences).to.have.property("sms");
          expect(res.body.preferences).to.have.property("push");
          expect(res.body.preferences.email).to.be.true;
          expect(res.body.preferences.sms).to.be.true;
          expect(res.body.preferences.push).to.be.false;
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .get("/api/notifications/preferences")
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });
  });

  describe("PUT /api/notifications/preferences", function () {
    it("should update notification preferences", function (done) {
      const newPreferences = {
        email: false,
        sms: true,
        push: true,
      };

      request(app)
        .put("/api/notifications/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send(newPreferences)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("updated successfully");
          done();
        });
    });

    it("should validate preference values", function (done) {
      const invalidPreferences = {
        email: "invalid",
        sms: "not-boolean",
        push: 123,
      };

      request(app)
        .put("/api/notifications/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidPreferences)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("errors");
          expect(res.body.errors).to.be.an("array");
          done();
        });
    });

    it("should allow partial updates", function (done) {
      const partialPreferences = {
        email: false,
      };

      request(app)
        .put("/api/notifications/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send(partialPreferences)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("updated successfully");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .put("/api/notifications/preferences")
        .send({
          email: false,
        })
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });
  });

  describe("GET /api/notifications", function () {
    it("should return user notifications", function (done) {
      request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("notifications");
          expect(res.body.notifications).to.be.an("array");
          done();
        });
    });

    it("should support pagination", function (done) {
      request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          page: 1,
          limit: 10,
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("notifications");
          expect(res.body.notifications).to.be.an("array");
          done();
        });
    });

    it("should support filtering by type", function (done) {
      request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          type: "breach",
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("notifications");
          expect(res.body.notifications).to.be.an("array");
          done();
        });
    });

    it("should support filtering by read status", function (done) {
      request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          read: false,
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("notifications");
          expect(res.body.notifications).to.be.an("array");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .get("/api/notifications")
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });
  });

  describe("GET /api/notifications/stats", function () {
    it("should return notification statistics", function (done) {
      request(app)
        .get("/api/notifications/stats")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("stats");
          expect(res.body.stats).to.be.an("object");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .get("/api/notifications/stats")
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });
  });

  describe("PUT /api/notifications/:id/read", function () {
    it("should mark notification as read", function (done) {
      // This test would need a real notification ID
      // For now, we'll test the endpoint structure
      request(app)
        .put("/api/notifications/123456789012345678901234/read")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404) // Expected since the ID doesn't exist
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .put("/api/notifications/123456789012345678901234/read")
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });

    it("should validate notification ID format", function (done) {
      request(app)
        .put("/api/notifications/invalid-id/read")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          done();
        });
    });
  });

  describe("DELETE /api/notifications/:id", function () {
    it("should delete notification", function (done) {
      // This test would need a real notification ID
      // For now, we'll test the endpoint structure
      request(app)
        .delete("/api/notifications/123456789012345678901234")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404) // Expected since the ID doesn't exist
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .delete("/api/notifications/123456789012345678901234")
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });

    it("should validate notification ID format", function (done) {
      request(app)
        .delete("/api/notifications/invalid-id")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          done();
        });
    });
  });

  describe("POST /api/notifications/test", function () {
    it("should send test email notification", function (done) {
      request(app)
        .post("/api/notifications/test")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          type: "email",
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("Test notification sent");
          done();
        });
    });

    it("should send test SMS notification", function (done) {
      request(app)
        .post("/api/notifications/test")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          type: "sms",
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("Test notification sent");
          done();
        });
    });

    it("should validate notification type", function (done) {
      request(app)
        .post("/api/notifications/test")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          type: "invalid",
        })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("errors");
          expect(res.body.errors).to.be.an("array");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .post("/api/notifications/test")
        .send({
          type: "email",
        })
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });

    it("should handle service errors gracefully", function (done) {
      // Mock the email service to throw an error
      const emailService = require("../../services/emailService");
      sinon
        .stub(emailService.prototype, "sendEmail")
        .throws(new Error("Email service error"));

      request(app)
        .post("/api/notifications/test")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          type: "email",
        })
        .expect(500)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          done();
        });
    });
  });

  describe("DELETE /api/notifications/clear", function () {
    it("should clear all notifications", function (done) {
      request(app)
        .delete("/api/notifications/clear")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("cleared");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .delete("/api/notifications/clear")
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });
  });
});
