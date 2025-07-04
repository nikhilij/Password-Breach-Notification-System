const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/User");

// Test database
const MONGO_URI =
  process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/breachdb_test";

describe("Authentication Endpoints", () => {
  beforeAll(async () => {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user with valid data", async () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        password: "Test123!@#",
        phone: "+1234567890",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.status).toBe("success");
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.token).toBeDefined();
    });

    it("should return validation error for invalid email", async () => {
      const userData = {
        username: "testuser",
        email: "invalid-email",
        password: "Test123!@#",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.status).toBe("fail");
      expect(response.body.message).toBe("Validation errors");
    });

    it("should return validation error for weak password", async () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        password: "weak",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.status).toBe("fail");
      expect(response.body.message).toBe("Validation errors");
    });

    it("should not register user with duplicate email", async () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        password: "Test123!@#",
      };

      // Register first user
      await request(app).post("/api/auth/register").send(userData).expect(201);

      // Try to register with same email
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          ...userData,
          username: "testuser2",
        })
        .expect(400);

      expect(response.body.status).toBe("fail");
      expect(response.body.message).toContain("already exists");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a test user
      const user = new User({
        username: "testuser",
        email: "test@example.com",
        password: "Test123!@#",
        isVerified: true,
      });
      await user.save();
    });

    it("should login with valid credentials", async () => {
      const loginData = {
        email: "test@example.com",
        password: "Test123!@#",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it("should not login with invalid email", async () => {
      const loginData = {
        email: "wrong@example.com",
        password: "Test123!@#",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body.status).toBe("fail");
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("should not login with invalid password", async () => {
      const loginData = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body.status).toBe("fail");
      expect(response.body.message).toBe("Invalid email or password");
    });
  });

  describe("GET /api/auth/me", () => {
    let token;
    let userId;

    beforeEach(async () => {
      // Create and login a test user
      const user = new User({
        username: "testuser",
        email: "test@example.com",
        password: "Test123!@#",
        isVerified: true,
      });
      await user.save();
      userId = user._id;

      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "Test123!@#",
      });

      token = loginResponse.body.data.token;
    });

    it("should get current user with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer " + token)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.user.email).toBe("test@example.com");
      expect(response.body.data.user.password).toBeUndefined();
    });

    it("should not get current user without token", async () => {
      const response = await request(app).get("/api/auth/me").expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should not get current user with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalidtoken")
        .expect(401);

      expect(response.body.error).toBe("Invalid token");
    });
  });
});
