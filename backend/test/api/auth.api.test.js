// Set up the test environment first
require("../setup");

const { expect } = require("chai");
const request = require("supertest");
const sinon = require("sinon");
const app = require("../../index"); // Import the Express app
        .expect(401)// Import the Express app
const User = require("../../models/User");
const jwt = require("jsonwebtoken");

describe("Authentication API", function () {
  let testUser;
  let authToken;

  beforeEach(async function () {
    // Create a test user
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
    sinon.restore();
  });

  describe("POST /api/auth/register", function () {
    it("should register a new user successfully", function (done) {
      const newUser = {
        username: "newuser",
        email: "newuser@example.com",
        password: "NewPassword123!",
        phone: "+1987654321",
      };

      request(app)
        .post("/api/auth/register")
        .send(newUser)
        .expect(201)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property("message");
          expect(res.body).to.have.property("data");
          expect(res.body.data).to.have.property("user");
          expect(res.body.data.user.email).to.equal(newUser.email);
          expect(res.body.data.user.username).to.equal(newUser.username);
          expect(res.body.data.user).to.not.have.property("password");

          done();
        });
    });

    it("should reject registration with invalid email", function (done) {
      const invalidUser = {
        username: "testuser2",
        email: "invalid-email",
        password: "TestPassword123!",
        phone: "+1234567890",
      };

      request(app)
        .post("/api/auth/register")
        .send(invalidUser)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property("errors");
          done();
        });
    });

    it("should reject registration with weak password", function (done) {
      const weakPasswordUser = {
        username: "testuser3",
        email: "test3@example.com",
        password: "weak",
        phone: "+1234567890",
      };

      request(app)
        .post("/api/auth/register")
        .send(weakPasswordUser)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property("errors");
          done();
        });
    });
  });

  describe("POST /api/auth/login", function () {
    it("should login with valid credentials", function (done) {
      const credentials = {
        email: "test@example.com",
        password: "TestPassword123!",
      };

      request(app)
        .post("/api/auth/login")
        .send(credentials)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property("status", "success");
          expect(res.body).to.have.property("data");
          expect(res.body.data).to.have.property("token");
          expect(res.body.data).to.have.property("user");
          expect(res.body.data.user.email).to.equal(credentials.email);

          done();
        });
    });

    it("should reject login with invalid password", function (done) {
      const invalidCredentials = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      request(app)
        .post("/api/auth/login")
        .send(invalidCredentials)
        .expect(401)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property("message");
          done();
        });
    });

    it("should reject login with non-existent user", function (done) {
      const nonExistentUser = {
        email: "nonexistent@example.com",
        password: "TestPassword123!",
      };

      request(app)
        .post("/api/auth/login")
        .send(nonExistentUser)
        .expect(401)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property("message");
          done();
        });
    });
  });

  describe("GET /api/auth/me", function () {
    it("should get user profile with valid token", function (done) {
      request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property("status", "success");
          expect(res.body).to.have.property("data");
          expect(res.body.data).to.have.property("user");
          expect(res.body.data.user.email).to.equal(testUser.email);
          expect(res.body.data.user).to.not.have.property("password");

          done();
        });
    });

    it("should reject request without token", function (done) {
      request(app)
        .get("/api/auth/me")
        .expect(401)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property("message");
          done();
        });
    });

    it("should reject request with invalid token", function (done) {
      request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid-token")
        .expect(401)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property("message");
          done();
        });
    });
  });
});
