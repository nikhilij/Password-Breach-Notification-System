// Set up the test environment first
require("../setup");

const { expect } = require("chai");
const {
  generateSHA1Hash,
  generateSHA256Hash,
  getHashPrefix,
  generateSalt,
} = require("../../utils/hashUtil");

describe("Hash Utility", function () {
  describe("generateSHA1Hash", function () {
    it("should generate correct SHA1 hash", function () {
      // Test with a known password and expected SHA1 hash
      const password = "password123";
      const expectedHash = "CBFDAC6008F9CAB4083784CBD1874F76618D2A97";
      const hash = generateSHA1Hash(password);

      expect(hash).to.equal(expectedHash);
    });

    it("should generate different hashes for different inputs", function () {
      const hash1 = generateSHA1Hash("password1");
      const hash2 = generateSHA1Hash("password2");

      expect(hash1).to.not.equal(hash2);
    });
  });

  describe("generateSHA256Hash", function () {
    it("should generate correct SHA256 hash", function () {
      const data = "test data";
      const expectedHash =
        "916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9";
      const hash = generateSHA256Hash(data);

      expect(hash).to.equal(expectedHash);
    });

    it("should generate different hashes for different inputs", function () {
      const hash1 = generateSHA256Hash("data1");
      const hash2 = generateSHA256Hash("data2");

      expect(hash1).to.not.equal(hash2);
    });
  });

  describe("getHashPrefix", function () {
    it("should correctly split SHA1 hash into prefix and suffix", function () {
      const password = "testpassword";
      const fullHash = generateSHA1Hash(password);
      const { prefix, suffix } = getHashPrefix(password);

      expect(prefix).to.equal(fullHash.substring(0, 5));
      expect(suffix).to.equal(fullHash.substring(5));
      expect(prefix + suffix).to.equal(fullHash);
    });

    it("should return a 5-character prefix", function () {
      const { prefix } = getHashPrefix("anypassword");
      expect(prefix).to.have.lengthOf(5);
    });
  });

  describe("generateSalt", function () {
    it("should generate a salt with default length", function () {
      const salt = generateSalt();
      // Default length is 16 bytes, which gives 32 hex characters
      expect(salt).to.have.lengthOf(32);
    });

    it("should generate a salt with specified length", function () {
      const length = 24; // 24 bytes will give 48 hex characters
      const salt = generateSalt(length);
      expect(salt).to.have.lengthOf(48);
    });

    it("should generate different salts on each call", function () {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).to.not.equal(salt2);
    });
  });
});
