const axios = require("axios");
const { getHashPrefix } = require("../utils/hashUtil");
const logger = require("../utils/logger");

class BreachService {
  constructor() {
    // This is the free Pwned Passwords API endpoint that uses k-anonymity
    this.pwnedPasswordsApiUrl = "https://api.pwnedpasswords.com/range/";
  }

  /**
   * Check if a password has been breached using Pwned Passwords API
   * @param {string} password - The password to check
   * @returns {Promise<object>} - Breach information
   */
  async checkPasswordBreach(password) {
    try {
      const { prefix, suffix } = getHashPrefix(password);

      const response = await axios.get(
        `${this.pwnedPasswordsApiUrl}${prefix}`,
        {
          timeout: 10000,
          headers: {
            "User-Agent": "Password-Breach-Notification-System",
          },
        },
      );

      const hashes = response.data.split("\n");
      const breachedHash = hashes.find(
        (hash) => hash.split(":")[0].toUpperCase() === suffix.toUpperCase(),
      );

      if (breachedHash) {
        const count = parseInt(breachedHash.split(":")[1]);
        return {
          breached: true,
          count,
          severity: this.calculateSeverity(count),
          source: "HaveIBeenPwned",
        };
      }

      return {
        breached: false,
        count: 0,
        source: "HaveIBeenPwned",
        severity: "none",
      };
    } catch (error) {
      logger.error("Error checking password breach:", error);
      throw new Error("Failed to check password breach");
    }
  }

  /**
   * Calculate severity based on breach count
   * @param {number} count - Number of times password was found
   * @returns {string} - Severity level
   */
  calculateSeverity(count) {
    if (count >= 100000) return "critical";
    if (count >= 10000) return "high";
    if (count >= 1000) return "medium";
    return "low";
  }

  /**
   * Check multiple passwords for breaches
   * @param {Array<string>} passwords - Array of passwords to check
   * @returns {Promise<Array<object>>} - Array of breach results
   */
  async checkMultiplePasswords(passwords) {
    const results = [];

    for (const password of passwords) {
      try {
        const result = await this.checkPasswordBreach(password);
        results.push(result);

        // Add delay to avoid rate limiting
        await this.delay(100);
      } catch (error) {
        logger.error(`Error checking password: ${error.message}`);
        results.push({
          isBreached: false,
          error: error.message,
          source: "HaveIBeenPwned",
        });
      }
    }

    return results;
  }

  /**
   * Get breach statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<object>} - Breach statistics
   */
  async getUserBreachStats(userId) {
    try {
      const Breach = require("../models/Breach");

      const stats = await Breach.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: null,
            totalBreaches: { $sum: 1 },
            activeBreaches: { $sum: { $cond: ["$isActive", 1, 0] } },
            acknowledgedBreaches: {
              $sum: { $cond: ["$userAcknowledged", 1, 0] },
            },
            criticalBreaches: {
              $sum: { $cond: [{ $eq: ["$riskLevel", "critical"] }, 1, 0] },
            },
            highBreaches: {
              $sum: { $cond: [{ $eq: ["$riskLevel", "high"] }, 1, 0] },
            },
            mediumBreaches: {
              $sum: { $cond: [{ $eq: ["$riskLevel", "medium"] }, 1, 0] },
            },
            lowBreaches: {
              $sum: { $cond: [{ $eq: ["$riskLevel", "low"] }, 1, 0] },
            },
          },
        },
      ]);

      return (
        stats[0] || {
          totalBreaches: 0,
          activeBreaches: 0,
          acknowledgedBreaches: 0,
          criticalBreaches: 0,
          highBreaches: 0,
          mediumBreaches: 0,
          lowBreaches: 0,
        }
      );
    } catch (error) {
      logger.error("Error getting user breach stats:", error);
      throw new Error("Failed to get breach statistics");
    }
  }

  /**
   * Get global breach statistics
   * @returns {Promise<object>} - Global breach statistics
   */
  async getGlobalBreachStats() {
    try {
      const Breach = require("../models/Breach");

      const stats = await Breach.aggregate([
        {
          $group: {
            _id: null,
            totalBreaches: { $sum: 1 },
            activeBreaches: { $sum: { $cond: ["$isActive", 1, 0] } },
            uniqueUsers: { $addToSet: "$userId" },
            averageTimesFound: { $avg: "$timesFound" },
            totalNotificationsSent: { $sum: "$notificationsSent" },
          },
        },
        {
          $project: {
            totalBreaches: 1,
            activeBreaches: 1,
            uniqueUsers: { $size: "$uniqueUsers" },
            averageTimesFound: { $round: ["$averageTimesFound", 2] },
            totalNotificationsSent: 1,
          },
        },
      ]);

      return (
        stats[0] || {
          totalBreaches: 0,
          activeBreaches: 0,
          uniqueUsers: 0,
          averageTimesFound: 0,
          totalNotificationsSent: 0,
        }
      );
    } catch (error) {
      logger.error("Error getting global breach stats:", error);
      throw new Error("Failed to get global breach statistics");
    }
  }

  /**
   * Utility function to add delay
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise((resolve) => global.setTimeout(resolve, ms));
  }
}

// Export the class constructor directly
// This makes it compatible with: const BreachService = require('...')
module.exports = BreachService;
