// Set up the test environment first
require("../setup");

const { expect } = require("chai");
const sinon = require("sinon");
const axios = require("axios");
const { setTimeout } = require("timers/promises");
const BreachService = require("../../services/breachService");
const EmailService = require("../../services/emailService");

describe("Service Integration Tests", function () {
  let breachService;
  let emailService;

  beforeEach(function () {
    breachService = new BreachService();
    emailService = new EmailService();
  });

  afterEach(function () {
    sinon.restore();
  });

  describe("Breach Detection Pipeline", function () {
    it("should perform end-to-end breach check and notification", async function () {
      // Mock the HaveIBeenPwned API response
      // The SHA-1 hash of "password" is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
      // Prefix: 5BAA6, Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
      const mockAxiosResponse = {
        data: "1E4C9B93F3F0682250B6CF8331B7EE68FD8:10\nAB87D24BDC7452E55738DEB5F868E1BCDB2312345543DA:5",
      };

      const axiosStub = sinon.stub(axios, "get").resolves(mockAxiosResponse);

      // Mock email service
      const emailStub = sinon
        .stub(emailService, "sendBreachNotification")
        .resolves(true);

      // Test a password that would be found in the mocked response
      const password = "password"; // This hashes to 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8

      // Perform breach check
      const breachResult = await breachService.checkPasswordBreach(password);

      // Verify breach detection
      expect(breachResult.breached).to.be.true;
      expect(breachResult.count).to.equal(10);
      expect(breachResult.severity).to.exist;
      expect(breachResult.source).to.equal("HaveIBeenPwned");

      // Send notification based on breach result
      if (breachResult.breached) {
        const notificationResult = await emailService.sendBreachNotification(
          "user@example.com",
          breachResult,
        );
        expect(notificationResult).to.be.true;
        expect(emailStub.calledOnce).to.be.true;
      }

      // Verify API was called correctly
      expect(axiosStub.calledOnce).to.be.true;
      const apiUrl = axiosStub.firstCall.args[0];
      expect(apiUrl).to.include("api.pwnedpasswords.com");
    });

    it("should handle multiple password checks efficiently", async function () {
      // Mock API responses for different passwords
      const axiosStub = sinon.stub(axios, "get");

      // First password is breached (password -> 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8)
      // Prefix: 5BAA6, Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
      axiosStub.onFirstCall().resolves({
        data: "1E4C9B93F3F0682250B6CF8331B7EE68FD8:1000",
      });

      // Second password is not breached (securePassword123!@# -> 3A927B924CD9ACAA4172C990D48F195AF9132726)
      // Prefix: 3A927, Suffix: B924CD9ACAA4172C990D48F195AF9132726
      // We'll return different suffixes so it's not found
      axiosStub.onSecondCall().resolves({
        data: "ABCDEF1234567890:5\nFEDCBA0987654321:10",
      });

      const passwords = ["password", "securePassword123!@#"];
      const results = [];

      for (const pwd of passwords) {
        const result = await breachService.checkPasswordBreach(pwd);
        results.push(result);

        // Add small delay as the service does
        await setTimeout(50);
      }

      // Verify results
      expect(results).to.have.lengthOf(2);
      expect(results[0].breached).to.be.true;
      expect(results[0].count).to.equal(1000);
      expect(results[1].breached).to.be.false;

      // Verify API was called twice
      expect(axiosStub.calledTwice).to.be.true;
    });
  });

  describe("Error Handling Integration", function () {
    it("should handle service failures gracefully", async function () {
      // Mock API failure
      const axiosStub = sinon
        .stub(axios, "get")
        .rejects(new Error("Network error"));

      try {
        await breachService.checkPasswordBreach("testpassword");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Failed to check password breach");
      }

      expect(axiosStub.calledOnce).to.be.true;
    });

    it("should handle email service failures during breach notification", async function () {
      // Mock successful breach detection
      const breachData = {
        breached: true,
        count: 5000,
        severity: "high",
        source: "HaveIBeenPwned",
      };

      // Mock email service failure
      const emailStub = sinon
        .stub(emailService, "sendBreachNotification")
        .rejects(new Error("Email service unavailable"));

      try {
        await emailService.sendBreachNotification(
          "user@example.com",
          breachData,
        );
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Email service unavailable");
      }

      expect(emailStub.calledOnce).to.be.true;
    });
  });

  describe("Performance Integration", function () {
    it("should handle concurrent breach checks", async function () {
      this.timeout(10000); // Increase timeout for concurrent operations

      // Mock API response
      const axiosStub = sinon.stub(axios, "get").resolves({
        data: "5E884898DA28047151D0E56F8DC6292773603D0D6AABBDD62A11EF721D1542D8:100",
      });

      const passwords = [
        "password1",
        "password2",
        "password3",
        "password4",
        "password5",
      ];

      const startTime = Date.now();

      // Perform concurrent breach checks
      const promises = passwords.map((pwd) =>
        breachService.checkPasswordBreach(pwd),
      );
      const results = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all results
      expect(results).to.have.lengthOf(5);
      results.forEach((result) => {
        expect(result).to.have.property("breached");
        expect(result).to.have.property("source");
      });

      // Verify performance (should complete within reasonable time)
      expect(duration).to.be.lessThan(5000); // 5 seconds max

      // Verify API was called for each password
      expect(axiosStub.callCount).to.equal(5);
    });
  });
});
