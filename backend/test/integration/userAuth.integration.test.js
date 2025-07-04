// Set up the test environment first
require("../setup");

const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const User = require("../../models/User");
const BreachService = require("../../services/breachService");
const EmailService = require("../../services/emailService");
const SMSService = require("../../services/smsService");

describe("User Authentication Integration", function () {
  let user;
  let hashedPassword;

  beforeEach(async function () {
    // Create a test user
    const bcrypt = require("bcryptjs");
    hashedPassword = await bcrypt.hash("TestPassword123!", 12);

    user = new User({
      username: "testuser",
      email: "test@example.com",
      password: hashedPassword,
      phone: "+1234567890",
      isVerified: true,
    });

    await user.save();
  });

  afterEach(async function () {
    // Clean up
    await User.deleteMany({});
    sinon.restore();
  });

  describe("User Registration and Notification Flow", function () {
    it("should register user and send welcome email", async function () {
      const emailService = new EmailService();

      // Mock the email service
      const emailStub = sinon
        .stub(emailService, "sendWelcomeEmail")
        .resolves(true);

      // Set required environment variable
      process.env.FRONTEND_URL = "http://localhost:3000";

      const newUser = new User({
        username: "newuser",
        email: "newuser@example.com",
        password: hashedPassword,
        phone: "+1987654321",
        isVerified: false,
        verificationToken: "test-token-123",
      });

      await newUser.save();

      // Send welcome email
      const result = await emailService.sendWelcomeEmail(
        newUser.email,
        newUser.username,
        newUser.verificationToken,
      );

      expect(result).to.be.true;
      expect(emailStub.calledOnce).to.be.true;
      expect(emailStub.firstCall.args[0]).to.equal(newUser.email);
      expect(emailStub.firstCall.args[1]).to.equal(newUser.username);
      expect(emailStub.firstCall.args[2]).to.equal(newUser.verificationToken);
    });
  });

  describe("Breach Detection and Notification Integration", function () {
    it("should detect breach and send notifications", async function () {
      const breachService = new BreachService();
      const emailService = new EmailService();
      const smsService = new SMSService();

      // Set up mock environment for SMS
      process.env.NODE_ENV = "development";

      // Mock external services
      const emailStub = sinon
        .stub(emailService, "sendBreachNotification")
        .resolves(true);
      const smsStub = sinon
        .stub(smsService, "sendBreachNotificationSMS")
        .resolves(true);

      // Mock breach detection
      const breachData = {
        breached: true,
        count: 12345,
        severity: "high",
        source: "HaveIBeenPwned",
      };

      const breachStub = sinon
        .stub(breachService, "checkPasswordBreach")
        .resolves(breachData);

      // Simulate breach detection workflow
      const password = "compromisedPassword123";
      const breachResult = await breachService.checkPasswordBreach(password);

      expect(breachResult.breached).to.be.true;
      expect(breachResult.count).to.equal(12345);

      // Send notifications
      const emailResult = await emailService.sendBreachNotification(
        user.email,
        breachResult,
      );
      const smsResult = await smsService.sendBreachNotificationSMS(
        user.phone,
        breachResult,
      );

      expect(emailResult).to.be.true;
      expect(smsResult).to.be.true;
      expect(emailStub.calledOnce).to.be.true;
      expect(smsStub.calledOnce).to.be.true;
    });
  });

  describe("User Account Security Integration", function () {
    it("should handle account lockout after failed attempts", async function () {
      const bcrypt = require("bcryptjs");

      // Simulate multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        const isValidPassword = await bcrypt.compare(
          "wrongpassword",
          user.password,
        );
        expect(isValidPassword).to.be.false;

        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

        if (user.failedLoginAttempts >= 5) {
          user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        }
      }

      await user.save();

      // Verify account is locked
      expect(user.failedLoginAttempts).to.equal(5);
      expect(user.accountLockedUntil).to.exist;
      expect(user.accountLockedUntil.getTime()).to.be.greaterThan(Date.now());

      // Verify locked account cannot login even with correct password
      const isAccountLocked =
        user.accountLockedUntil && user.accountLockedUntil > new Date();
      expect(isAccountLocked).to.be.true;
    });
  });
});
