// Set up the test environment first
require("../setup");

const { expect } = require("chai");
const sinon = require("sinon");
const axios = require("axios");
const BreachService = require("../../services/breachService");
const { getHashPrefix } = require("../../utils/hashUtil");

describe("Breach Service", function () {
  let breachService;
  let axiosStub;

  beforeEach(function () {
    // Create a new instance of the service for each test
    breachService = new BreachService();

    // Restore any previous stubs
    if (axiosStub) {
      axiosStub.restore();
    }
  });

  afterEach(function () {
    // Restore all stubs after each test
    sinon.restore();
  });

  describe("checkPasswordBreach", function () {
    it("should detect a breached password", async function () {
      // Create a password and its hash parts
      const password = "password123";
      const { prefix, suffix } = getHashPrefix(password);

      // Mock the API response with a breach for our password
      const mockResponse = `${suffix.toUpperCase()}:10`;
      axiosStub = sinon.stub(axios, "get").resolves({
        data: mockResponse,
      });

      const result = await breachService.checkPasswordBreach(password);

      // Verify the API was called with the correct prefix
      expect(axiosStub.calledOnce).to.be.true;
      expect(axiosStub.firstCall.args[0]).to.include(prefix);

      // Verify the breach detection
      expect(result).to.deep.include({
        breached: true,
        count: 10,
        source: "HaveIBeenPwned",
      });
    });

    it("should handle non-breached passwords", async function () {
      const password = "safePassword123";
      const { prefix } = getHashPrefix(password);

      // Mock the API response with no match for our password
      axiosStub = sinon.stub(axios, "get").resolves({
        data: "ABCDEF:5\nGHIJKL:10",
      });

      const result = await breachService.checkPasswordBreach(password);

      expect(axiosStub.calledOnce).to.be.true;
      expect(axiosStub.firstCall.args[0]).to.include(prefix);

      expect(result).to.deep.include({
        breached: false,
        count: 0,
        source: "HaveIBeenPwned",
        severity: "none",
      });
    });

    it("should handle API errors gracefully", async function () {
      const password = "anypassword";

      // Mock an API error
      axiosStub = sinon.stub(axios, "get").rejects(new Error("API Error"));

      try {
        await breachService.checkPasswordBreach(password);
        // Should not reach here
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Failed to check password breach");
      }
    });
  });

  // Add more tests for other breach service methods as needed
});
