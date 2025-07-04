// Set up the test environment first
require("../setup");

const { expect } = require("chai");
const sinon = require("sinon");
const axios = require("axios");
const SMSService = require("../../services/smsService");

describe("SMS Service", function () {
  let smsService;

  beforeEach(function () {
    // Create a new instance of the service
    smsService = new SMSService();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Reset environment variables
    delete process.env.NODE_ENV;
    delete process.env.USE_MOCK_SMS;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  describe("sendSMS", function () {
    it("should send an SMS successfully using mock service", async function () {
      // Set up mock environment
      process.env.NODE_ENV = "development";

      const phoneNumber = "+1234567890";
      const message = "Test SMS message";

      const result = await smsService.sendSMS(phoneNumber, message);

      // Verify result - mock service should return true
      expect(result).to.be.true;
    });

    it("should send SMS using real Twilio service when configured", async function () {
      // Set up environment for real Twilio service
      process.env.NODE_ENV = "production";
      process.env.TWILIO_ACCOUNT_SID = "test_sid";
      process.env.TWILIO_AUTH_TOKEN = "test_token";
      process.env.TWILIO_PHONE_NUMBER = "+15555555555";

      // Mock axios for Twilio API call
      const axiosStub = sinon.stub(axios, "post").resolves({
        data: { sid: "test-sms-id", status: "sent" },
      });

      const phoneNumber = "+1234567890";
      const message = "Test SMS message";

      const result = await smsService.sendSMS(phoneNumber, message);

      // Verify axios was called for real Twilio service
      expect(axiosStub.calledOnce).to.be.true;
      expect(result).to.be.true;
    });

    it("should handle validation of phone numbers", function () {
      // Test phone number validation
      expect(smsService.isValidPhoneNumber("+1234567890")).to.be.true;
      expect(smsService.isValidPhoneNumber("1234567890")).to.be.true;
      expect(smsService.isValidPhoneNumber("invalid")).to.be.false;
      expect(smsService.isValidPhoneNumber("")).to.be.false;
    });

    it("should format phone numbers correctly", function () {
      // Test phone number formatting
      expect(smsService.formatPhoneNumber("1234567890")).to.equal(
        "+11234567890",
      );
      expect(smsService.formatPhoneNumber("+1234567890")).to.equal(
        "+1234567890",
      );
      expect(smsService.formatPhoneNumber("(123) 456-7890")).to.equal(
        "+11234567890",
      );
    });
  });

  describe("sendBreachNotificationSMS", function () {
    it("should send a breach notification SMS", async function () {
      // Set up mock environment
      process.env.NODE_ENV = "development";

      const phoneNumber = "+1234567890";
      const breachData = {
        count: 12345,
        severity: "high",
        source: "HaveIBeenPwned",
      };

      const result = await smsService.sendBreachNotificationSMS(
        phoneNumber,
        breachData,
      );

      // Verify result
      expect(result).to.be.true;
    });
  });
});
