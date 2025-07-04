// Mock implementation of the BreachService
module.exports = class BreachService {
  constructor() {
    this.pwnedPasswordsApiUrl = "https://api.pwnedpasswords.com/range/";
  }

  async checkPasswordBreach(_password) {
    return {
      breached: false,
      count: 0,
      source: "HaveIBeenPwned",
      severity: "none",
    };
  }

  calculateSeverity(count) {
    if (count >= 100000) return "critical";
    if (count >= 10000) return "high";
    if (count >= 1000) return "medium";
    return "low";
  }

  async checkMultiplePasswords(_passwords) {
    return [];
  }

  async getUserBreachStats(_userId) {
    return {
      totalBreaches: 0,
      activeBreaches: 0,
      acknowledgedBreaches: 0,
      criticalBreaches: 0,
      highBreaches: 0,
      mediumBreaches: 0,
      lowBreaches: 0,
    };
  }

  async getGlobalBreachStats() {
    return {
      totalBreaches: 0,
      activeBreaches: 0,
      uniqueUsers: 0,
      averageTimesFound: 0,
      totalNotificationsSent: 0,
    };
  }

  delay(ms) {
    return new Promise((resolve) => global.setTimeout(resolve, ms));
  }
};
