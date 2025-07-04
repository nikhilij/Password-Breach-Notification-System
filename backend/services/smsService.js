const axios = require("axios");
const logger = require("../utils/logger");
const { URLSearchParams } = require("url"); // For Node.js URL functionality

class SMSService {
  constructor() {}

  get accountSid() {
    return process.env.TWILIO_ACCOUNT_SID;
  }
  get authToken() {
    return process.env.TWILIO_AUTH_TOKEN;
  }
  get phoneNumber() {
    return process.env.TWILIO_PHONE_NUMBER;
  }

  get useMockService() {
    return (
      process.env.NODE_ENV === "development" ||
      process.env.USE_MOCK_SMS === "true"
    );
  }

  /**
   * Send SMS notification - uses mock service in development
   * @param {string} phone - Recipient phone number
   * @param {string} message - SMS message
   * @returns {Promise<boolean>} - Success status
   */
  async sendSMS(phone, message) {
    try {
      // Use mock service for development
      if (this.useMockService) {
        return this.sendMockSMS(phone, message);
      }

      if (!this.accountSid || !this.authToken || !this.phoneNumber) {
        logger.warn("Twilio credentials not configured, using mock service");
        return this.sendMockSMS(phone, message);
      }

      // Ensure phone number has proper format (with country code)
      const formattedPhone = this.formatPhoneNumber(phone);

      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

      // Create URLSearchParams for the form data
      const formData = new URLSearchParams();
      formData.append("To", formattedPhone);
      formData.append("From", this.phoneNumber);
      formData.append("Body", message);

      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
        "base64",
      );

      // In development, log but don't actually send
      if (process.env.NODE_ENV === "development") {
        return this.sendMockSMS(phone, message);
      }

      const response = await axios.post(url, formData.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
      });

      if (response.data.sid) {
        logger.info(
          `SMS sent successfully to ${phone} with SID: ${response.data.sid}`,
        );
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
   * Send mock SMS (for development/testing)
   * @param {string} phone - Recipient phone number
   * @param {string} message - SMS message
   * @returns {Promise<boolean>} - Success status
   */
  async sendMockSMS(phone, message) {
    // Generate a fake message SID like Twilio does (starts with SM)
    const fakeSid = `SM${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    // Log the message details instead of actually sending it
    logger.info("📱 MOCK SMS SENT =====================");
    logger.info(`📱 To: ${this.formatPhoneNumber(phone)}`);
    logger.info(`📱 From: ${this.phoneNumber || "+15555555555"}`);
    logger.info(`📱 Message: ${message}`);
    logger.info(`📱 SID: ${fakeSid}`);
    logger.info("📱 ================================== ");

    return true;
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

// Export the class constructor directly
// This makes it compatible with: const SMSService = require('...')
module.exports = SMSService;
