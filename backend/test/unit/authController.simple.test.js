const { expect } = require("chai");
const sinon = require("sinon");
const User = require("../../models/User");
const authController = require("../../controllers/authController");

describe("Auth Controller - Simple Unit Tests", () => {
  let req, res, next;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: null,
      get: sinon.stub(),
      ip: "127.0.0.1",
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      cookie: sinon.stub().returnsThis(),
      clearCookie: sinon.stub().returnsThis(),
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("register", () => {
    beforeEach(() => {
      req.body = {
        username: "testuser",
        email: "test@example.com",
        password: "TestPassword123!",
        phone: "+1234567890",
        firstName: "Test",
        lastName: "User",
      };
    });

    it("should handle existing user correctly", async () => {
      // Mock existing user
      sandbox.stub(User, "findOne").resolves({ email: "test@example.com" });

      // Execute
      await authController.register(req, res, next);

      // Assertions
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.status).to.equal("fail");
      expect(response.message).to.include("already exists");
    });

    it("should handle validation errors", async () => {
      req.body.email = "invalid-email"; // Invalid email

      sandbox.stub(User, "findOne").resolves(null);

      // Execute
      await authController.register(req, res, next);

      // Should handle validation error
      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe("login", () => {
    beforeEach(() => {
      req.body = {
        email: "test@example.com",
        password: "TestPassword123!",
      };
    });

    it("should reject login for non-existent user", async () => {
      sandbox.stub(User, "findOne").resolves(null);

      // Execute
      await authController.login(req, res, next);

      // Assertions
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.status).to.equal("fail");
      expect(response.message).to.include("Invalid credentials");
    });

    it("should handle validation errors", async () => {
      req.body.email = "invalid-email"; // Invalid email

      // Execute
      await authController.login(req, res, next);

      // Should handle validation error
      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe("verifyEmail", () => {
    beforeEach(() => {
      req.params = { token: "valid-token" };
    });

    it("should handle invalid token", async () => {
      sandbox.stub(User, "findOne").resolves(null);

      // Execute
      await authController.verifyEmail(req, res, next);

      // Assertions
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.status).to.equal("fail");
    });
  });

  describe("forgotPassword", () => {
    beforeEach(() => {
      req.body = { email: "test@example.com" };
    });

    it("should handle non-existent user", async () => {
      sandbox.stub(User, "findOne").resolves(null);

      // Execute
      await authController.forgotPassword(req, res, next);

      // Should still return success for security reasons
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.status).to.equal("success");
    });
  });

  describe("resetPassword", () => {
    beforeEach(() => {
      req.params = { token: "valid-token" };
      req.body = { password: "NewPassword123!" };
    });

    it("should handle invalid token", async () => {
      sandbox.stub(User, "findOne").resolves(null);

      // Execute
      await authController.resetPassword(req, res, next);

      // Assertions
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.status).to.equal("fail");
    });
  });

  describe("getCurrentUser", () => {
    beforeEach(() => {
      req.user = { _id: "user123" };
    });

    it("should handle missing user", async () => {
      sandbox.stub(User, "findById").resolves(null);

      // Execute
      await authController.getCurrentUser(req, res, next);

      // Assertions
      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.status).to.equal("fail");
    });
  });

  describe("logout", () => {
    it("should logout successfully", async () => {
      // Execute
      await authController.logout(req, res, next);

      // Assertions
      expect(res.clearCookie.calledWith("token")).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.status).to.equal("success");
      expect(response.message).to.include("Logged out");
    });
  });
});
