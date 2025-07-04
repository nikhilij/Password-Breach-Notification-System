const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const User = require("../models/User");
const Breach = require("../models/Breach");

// Test database
const MONGO_URI =
  process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/breachdb_test";

describe("Breach Endpoints", () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Breach.deleteMany({});

    // Create and authenticate test user
    testUser = new User({
      username: "testuser",
      email: "test@example.com",
      password: "Test123!@#",
      isVerified: true,
    });
    await testUser.save();

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "Test123!@#",
    });

    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("POST /api/breach/check", () => {
    it("should check password breach with authentication", async () => {
      const passwordData = {
        password: "password123", // This should be found in breaches
      };

      const response = await request(app)
        .post("/api/breach/check")
        .set("Authorization", "Bearer " + authToken)
        .send(passwordData);

      expect(response.status).toBeOneOf([200, 500]); // 500 if HIBP API is not available
      expect(response.body.status).toBeDefined();
    });

    it("should require authentication", async () => {
      const passwordData = {
        password: "password123",
      };

      const response = await request(app)
        .post("/api/breach/check")
        .send(passwordData)
        .expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should require password in request body", async () => {
      const response = await request(app)
        .post("/api/breach/check")
        .set("Authorization", "Bearer " + authToken)
        .send({})
        .expect(400);

      expect(response.body.status).toBe("fail");
      expect(response.body.message).toBe("Validation errors");
    });
  });

  describe("GET /api/breach/history", () => {
    beforeEach(async () => {
      // Create some test breach records
      const breach1 = new Breach({
        userId: testUser._id,
        passwordHash: "test-hash-1",
        breachSources: [
          {
            name: "TestBreach1",
            dateFound: new Date(),
            severity: "medium",
          },
        ],
      });

      const breach2 = new Breach({
        userId: testUser._id,
        passwordHash: "test-hash-2",
        breachSources: [
          {
            name: "TestBreach2",
            dateFound: new Date(),
            severity: "high",
          },
        ],
      });

      await breach1.save();
      await breach2.save();
    });

    it("should get user breach history with authentication", async () => {
      const response = await request(app)
        .get("/api/breach/history")
        .set("Authorization", "Bearer " + authToken)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.breaches).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.statistics).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get("/api/breach/history")
        .expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/breach/history?page=1&limit=1")
        .set("Authorization", "Bearer " + authToken)
        .expect(200);

      expect(response.body.data.breaches).toHaveLength(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.page).toBe(1);
    });
  });

  describe("GET /api/breach/:breachId", () => {
    let testBreach;

    beforeEach(async () => {
      testBreach = new Breach({
        userId: testUser._id,
        passwordHash: "test-hash",
        breachSources: [
          {
            name: "TestBreach",
            dateFound: new Date(),
            severity: "medium",
          },
        ],
      });
      await testBreach.save();
    });

    it("should get specific breach details", async () => {
      const response = await request(app)
        .get("/api/breach/" + testBreach._id)
        .set("Authorization", "Bearer " + authToken)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.breach._id).toBe(testBreach._id.toString());
    });

    it("should return 404 for non-existent breach", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get("/api/breach/" + fakeId)
        .set("Authorization", "Bearer " + authToken)
        .expect(404);

      expect(response.body.status).toBe("fail");
      expect(response.body.message).toBe("Breach not found");
    });
  });

  describe("PUT /api/breach/:breachId/acknowledge", () => {
    let testBreach;

    beforeEach(async () => {
      testBreach = new Breach({
        userId: testUser._id,
        passwordHash: "test-hash",
        breachSources: [
          {
            name: "TestBreach",
            dateFound: new Date(),
            severity: "medium",
          },
        ],
        userAcknowledged: false,
      });
      await testBreach.save();
    });

    it("should acknowledge a breach", async () => {
      const response = await request(app)
        .put("/api/breach/" + testBreach._id + "/acknowledge")
        .set("Authorization", "Bearer " + authToken)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.breach.userAcknowledged).toBe(true);
      expect(response.body.data.breach.acknowledgedAt).toBeDefined();
    });
  });
});
