const axios = require("axios");
const logger = require("../utils/logger");

class SMSService {
  constructor() {
    this.apiKey = process.env.SMS_API_KEY;
    this.apiUrl = process.env.SMS_API_URL || "https://api.textlocal.in/send/";
    this.sender = process.env.SMS_SENDER || "PBNS";
  }

  /**
   * Send SMS notification
   * @param {string} phone - Recipient phone number
   * @param {string} message - SMS message
   * @returns {Promise<boolean>} - Success status
   */
  async sendSMS(phone, message) {
    try {
      if (!this.apiKey) {
        logger.warn("SMS API key not configured, skipping SMS notification");
        return false;
      }

      const data = {
        apikey: this.apiKey,
        numbers: phone,
        message: message,
        sender: this.sender,
      };

      const response = await axios.post(this.apiUrl, data, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (response.data.status === "success") {
        logger.info(`SMS sent successfully to ${phone}`);
        return true;
      } else {
        logger.error("SMS sending failed:", response.data);
        return false;
      }
    } catch (error) {
      logger.error("Error sending SMS:", error);
      throw new Error("Failed to send SMS notification");
    }
  }

  /**
   * Send breach notification via SMS
   * @param {string} phone - Recipient phone number
   * @param {object} breachData - Breach information
   * @returns {Promise<boolean>} - Success status
   */
  async sendBreachNotificationSMS(phone, breachData) {
    const message = `🚨 SECURITY ALERT: Your password has been found in a data breach! Found ${breachData.count} times. Change your password immediately. Visit our app for more details.`;

    return await this.sendSMS(phone, message);
  }

  /**
   * Send verification code via SMS
   * @param {string} phone - Recipient phone number
   * @param {string} code - Verification code
   * @returns {Promise<boolean>} - Success status
   */
  async sendVerificationCode(phone, code) {
    const message = `Your verification code is: ${code}. This code expires in 10 minutes. Do not share this code with anyone.`;

    return await this.sendSMS(phone, message);
  }

  /**
   * Send password reset notification via SMS
   * @param {string} phone - Recipient phone number
   * @returns {Promise<boolean>} - Success status
   */
  async sendPasswordResetSMS(phone) {
    const message = `Password reset requested for your account. If this wasn't you, please contact support immediately.`;

    return await this.sendSMS(phone, message);
  }

  /**
   * Send account lock notification via SMS
   * @param {string} phone - Recipient phone number
   * @returns {Promise<boolean>} - Success status
   */
  async sendAccountLockSMS(phone) {
    const message = `⚠️ Your account has been temporarily locked due to multiple failed login attempts. Please wait 2 hours or contact support.`;

    return await this.sendSMS(phone, message);
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number to validate
   * @returns {boolean} - Is valid phone number
   */
  isValidPhoneNumber(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Format phone number for SMS service
   * @param {string} phone - Phone number to format
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phone) {
    // Remove any non-digit characters except +
    let formatted = phone.replace(/[^\d+]/g, "");

    // Add country code if missing
    if (!formatted.startsWith("+")) {
      formatted = "+1" + formatted; // Default to US/Canada
    }

    return formatted;
  }
}

module.exports = new SMSService();
