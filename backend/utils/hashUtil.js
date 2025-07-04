const crypto = require("crypto");

/**
 * Generate SHA-1 hash for password (used for Have I Been Pwned API)
 * @param {string} password - The password to hash
 * @returns {string} - The SHA-1 hash in uppercase
 */
const generateSHA1Hash = (password) => {
  return crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
};

/**
 * Generate SHA-256 hash for internal use
 * @param {string} data - The data to hash
 * @returns {string} - The SHA-256 hash in hexadecimal
 */
const generateSHA256Hash = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

/**
 * Get first 5 characters of SHA-1 hash for k-anonymity
 * @param {string} password - The password to hash
 * @returns {object} - Object containing prefix and suffix
 */
const getHashPrefix = (password) => {
  const hash = generateSHA1Hash(password);
  return {
    prefix: hash.substring(0, 5),
    suffix: hash.substring(5),
  };
};

/**
 * Generate random salt
 * @param {number} length - Length of salt (default 16)
 * @returns {string} - Random salt in hexadecimal
 */
const generateSalt = (length = 16) => {
  return crypto.randomBytes(length).toString("hex");
};

module.exports = {
  generateSHA1Hash,
  generateSHA256Hash,
  getHashPrefix,
  generateSalt,
};
