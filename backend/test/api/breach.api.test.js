// API tests for breach endpoints
require("../setup");

const { expect } = require("chai");
const request = require("supertest");
const sinon = require("sinon");
const app = require("../../index");
const User = require("../../models/User");
const Breach = require("../../models/Breach");
const jwt = require("jsonwebtoken");

describe("Breach API", function () {
  let testUser;
  let authToken;
  let adminUser;
  let adminToken;

  beforeEach(async function () {
    // Clean up database
    await User.deleteMany({});
    await Breach.deleteMany({});

    // Create test users
    testUser = new User({
      username: "testuser",
      email: "test@example.com",
      password: "TestPassword123!",
      phone: "+1234567890",
      isVerified: true,
      role: "user",
    });

    adminUser = new User({
      username: "admin",
      email: "admin@example.com",
      password: "AdminPassword123!",
      phone: "+1987654321",
      isVerified: true,
      role: "admin",
    });

    await testUser.save();
    await adminUser.save();

    // Generate auth tokens
    authToken = jwt.sign(
      { userId: testUser._id, email: testUser.email },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "1h" },
    );

    adminToken = jwt.sign(
      { userId: adminUser._id, email: adminUser.email },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "1h" },
    );
  });

  afterEach(async function () {
    await User.deleteMany({});
    await Breach.deleteMany({});
    sinon.restore();
  });

  describe("POST /api/breach/check", function () {
    it("should check password for breaches", function (done) {
      request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          password: "password123",
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.data).to.have.property("isBreached");
          expect(res.body.data).to.have.property("breachCount");
          expect(res.body.data).to.have.property("riskLevel");
          expect(res.body.data).to.have.property("recommendedActions");
          expect(res.body.data.isBreached).to.be.a("boolean");
          expect(res.body.data.breachCount).to.be.a("number");
          expect(res.body.data.riskLevel).to.be.oneOf([
            "none",
            "low",
            "medium",
            "high",
            "critical",
          ]);
          expect(res.body.data.recommendedActions).to.be.an("array");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .post("/api/breach/check")
        .send({
          password: "password123",
        })
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });

    it("should validate password input", function (done) {
      request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          password: "",
        })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("errors");
          expect(res.body.errors).to.be.an("array");
          done();
        });
    });

    it("should handle API errors gracefully", function (done) {
      // Mock the breach service to throw an error
      const breachService = require("../../services/breachService");
      sinon
        .stub(breachService.prototype, "checkPasswordBreach")
        .throws(new Error("API Error"));

      request(app)
        .post("/api/breach/check")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          password: "password123",
        })
        .expect(500)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          done();
        });
    });
  });

  describe("GET /api/breach/history", function () {
    beforeEach(async function () {
      // Create test breach records
      const breaches = [
        {
          userId: testUser._id,
          passwordHash: "da39a3ee5e6b4b0d3255bfef95601890afd80709", // SHA1 of "test1"
          breachSources: [
            {
              name: "Test Breach Database 1",
              dateFound: new Date(),
              severity: "high",
              description: "Password found in data breach",
              affectedAccounts: 5,
            },
          ],
          riskLevel: "high",
          isActive: true,
          lastChecked: new Date(),
          recommendedActions: [
            {
              action: "Change password",
              priority: "high",
              completed: false,
            },
            {
              action: "Enable 2FA",
              priority: "medium",
              completed: false,
            },
          ],
        },
        {
          userId: testUser._id,
          passwordHash: "356a192b7913b04c54574d18c28d46e6395428ab", // SHA1 of "test2"
          breachSources: [
            {
              name: "Test Breach Database 2",
              dateFound: new Date(),
              severity: "medium",
              description: "Password found in data breach",
              affectedAccounts: 2,
            },
          ],
          riskLevel: "medium",
          isActive: true,
          lastChecked: new Date(),
          recommendedActions: [
            {
              action: "Change password",
              priority: "medium",
              completed: false,
            },
          ],
        },
      ];

      await Breach.insertMany(breaches);
    });

    it("should return user's breach history", function (done) {
      request(app)
        .get("/api/breach/history")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("data");
          expect(res.body.data).to.have.property("breaches");
          expect(res.body.data.breaches).to.be.an("array");
          expect(res.body.data.breaches.length).to.equal(2);
          expect(res.body.data.breaches[0]).to.have.property("riskLevel");
          expect(res.body.data.breaches[0]).to.have.property("breachSources");
          expect(res.body.data.breaches[0].breachSources).to.be.an("array");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .get("/api/breach/history")
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });

    it("should handle pagination", function (done) {
      request(app)
        .get("/api/breach/history")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          page: 1,
          limit: 1,
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("breaches");
          expect(res.body.breaches).to.be.an("array");
          expect(res.body.breaches.length).to.be.at.most(1);
          done();
        });
    });
  });

  describe("GET /api/breach/search", function () {
    beforeEach(async function () {
      // Create test breach records with different properties
      const breaches = [
        {
          userId: testUser._id,
          passwordHash: "da39a3ee5e6b4b0d3255bfef95601890afd80709", // SHA1 of "test1"
          breachSources: [
            {
              name: "Critical Breach DB",
              dateFound: new Date(),
              severity: "critical",
              description: "Password found in critical breach",
              affectedAccounts: 10,
            },
          ],
          riskLevel: "critical",
          isActive: true,
          userAcknowledged: false,
          lastChecked: new Date(),
          recommendedActions: [
            {
              action: "Change password immediately",
              priority: "high",
              completed: false,
            },
          ],
        },
        {
          userId: testUser._id,
          passwordHash: "356a192b7913b04c54574d18c28d46e6395428ab", // SHA1 of "test2"
          breachSources: [
            {
              name: "Medium Breach DB",
              dateFound: new Date(),
              severity: "medium",
              description: "Password found in medium breach",
              affectedAccounts: 3,
            },
          ],
          riskLevel: "medium",
          isActive: true,
          userAcknowledged: true,
          lastChecked: new Date(),
          recommendedActions: [
            {
              action: "Change password",
              priority: "medium",
              completed: false,
            },
          ],
        },
      ];

      await Breach.insertMany(breaches);
    });

    it("should search breaches by severity", function (done) {
      request(app)
        .get("/api/breach/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          severity: "critical",
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("data");
          expect(res.body.data).to.have.property("breaches");
          expect(res.body.data.breaches).to.be.an("array");
          expect(res.body.data.breaches.length).to.be.above(0);
          expect(res.body.data.breaches[0]).to.have.property("breachSources");
          expect(res.body.data.breaches[0].breachSources[0]).to.have.property("severity", "critical");
          done();
        });
    });

    it("should search breaches by risk level", function (done) {
      request(app)
        .get("/api/breach/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          riskLevel: "medium",
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("data");
          expect(res.body.data).to.have.property("breaches");
          expect(res.body.data.breaches).to.be.an("array");
          expect(res.body.data.breaches.length).to.be.above(0);
          expect(res.body.data.breaches[0]).to.have.property("riskLevel", "medium");
          done();
        });
    });

    it("should search breaches by acknowledged status", function (done) {
      request(app)
        .get("/api/breach/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          acknowledged: false,
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("breaches");
          expect(res.body.breaches).to.be.an("array");
          expect(res.body.breaches.length).to.be.above(0);
          expect(res.body.breaches[0]).to.have.property("acknowledged", false);
          done();
        });
    });

    it("should validate search parameters", function (done) {
      request(app)
        .get("/api/breach/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({
          severity: "invalid-severity",
        })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("errors");
          expect(res.body.errors).to.be.an("array");
          done();
        });
    });
  });

  describe("PUT /api/breach/:id/acknowledge", function () {
    let breachId;

    beforeEach(async function () {
      // Create a test breach
      const breach = new Breach({
        userId: testUser._id,
        passwordHash: "da39a3ee5e6b4b0d3255bfef95601890afd80709", // SHA1 of "test"
        breachSources: [
          {
            name: "Test Breach DB",
            dateFound: new Date(),
            severity: "high",
            description: "Password found in breach",
            affectedAccounts: 5,
          },
        ],
        riskLevel: "high",
        isActive: true,
        userAcknowledged: false,
        lastChecked: new Date(),
        recommendedActions: [
          {
            action: "Change password",
            priority: "high",
            completed: false,
          },
        ],
      });

      await breach.save();
      breachId = breach._id;
    });

    it("should acknowledge a breach", function (done) {
      request(app)
        .put(`/api/breach/${breachId}/acknowledge`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("acknowledged");
          done();
        });
    });

    it("should require authentication", function (done) {
      request(app)
        .put(`/api/breach/${breachId}/acknowledge`)
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("token");
          done();
        });
    });

    it("should validate breach ID", function (done) {
      request(app)
        .put("/api/breach/invalid-id/acknowledge")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          done();
        });
    });

    it("should not allow acknowledging other users' breaches", function (done) {
      // Create another user's breach
      const otherUser = new User({
        username: "otheruser",
        email: "other@example.com",
        password: "hashedPassword",
        phone: "+1111111111",
        isVerified: true,
      });

      otherUser
        .save()
        .then(() => {
          const otherBreach = new Breach({
            userId: otherUser._id,
            password: "hashedPassword",
            breachCount: 3,
            riskLevel: "medium",
            severity: "medium",
            isActive: true,
            acknowledged: false,
            lastChecked: new Date(),
            recommendedActions: ["Change password"],
          });

          return otherBreach.save();
        })
        .then((otherBreach) => {
          request(app)
            .put(`/api/breach/${otherBreach._id}/acknowledge`)
            .set("Authorization", `Bearer ${authToken}`)
            .expect(403)
            .end((err, res) => {
              if (err) return done(err);
              expect(res.body).to.have.property("message");
              done();
            });
        })
        .catch(done);
    });
  });

  describe("POST /api/breach/:id/action", function () {
    let breachId;

    beforeEach(async function () {
      // Create a test breach with recommended actions
      const breach = new Breach({
        userId: testUser._id,
        password: "hashedPassword",
        breachCount: 5,
        riskLevel: "high",
        severity: "high",
        isActive: true,
        acknowledged: false,
        lastChecked: new Date(),
        recommendedActions: [
          "Change password",
          "Enable 2FA",
          "Review account security",
        ],
      });

      await breach.save();
      breachId = breach._id;
    });

    it("should mark action as completed", function (done) {
      request(app)
        .post(`/api/breach/${breachId}/action`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          actionIndex: 0,
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          expect(res.body.message).to.include("marked as completed");
          done();
        });
    });

    it("should validate action index", function (done) {
      request(app)
        .post(`/api/breach/${breachId}/action`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          actionIndex: -1,
        })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("errors");
          expect(res.body.errors).to.be.an("array");
          done();
        });
    });

    it("should handle invalid action index", function (done) {
      request(app)
        .post(`/api/breach/${breachId}/action`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          actionIndex: 99,
        })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("message");
          done();
        });
    });
  });

  describe("Admin Endpoints", function () {
    describe("GET /api/breach/admin/stats", function () {
      it("should return breach statistics for admin", function (done) {
        request(app)
          .get("/api/breach/admin/stats")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body).to.have.property("status", "success");
            expect(res.body).to.have.property("data");
            expect(res.body.data).to.have.property("statistics");
            expect(res.body.data.statistics).to.be.an("object");
            done();
          });
      });

      it("should require admin privileges", function (done) {
        request(app)
          .get("/api/breach/admin/stats")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(403)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body).to.have.property("message");
            expect(res.body.message).to.include("Admin access required");
            done();
          });
      });
    });

    describe("GET /api/breach/user/:userId", function () {
      it("should allow admin to view user breaches", function (done) {
        request(app)
          .get(`/api/breach/user/${testUser._id}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body).to.have.property("data");
            expect(res.body.data).to.have.property("breaches");
            expect(res.body.data).to.have.property("user");
            expect(res.body.data.breaches).to.be.an("array");
            expect(res.body.data.user).to.have.property("id");
            expect(res.body.data.user).to.have.property("username");
            expect(res.body.data.user).to.have.property("email");
            done();
          });
      });

      it("should require admin privileges", function (done) {
        request(app)
          .get(`/api/breach/user/${testUser._id}`)
          .set("Authorization", `Bearer ${authToken}`)
          .expect(403)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body).to.have.property("message");
            expect(res.body.message).to.include("Admin access required");
            done();
          });
      });
    });
  });
});
