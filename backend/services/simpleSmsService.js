const axios = require("axios");
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

  async sendSMS(phone, message) {
    if (this.useMockService) {
      return this.sendMockSMS(phone, message);
    }
    return true;
  }

  async sendMockSMS(phone, message) {
    console.log("Mock SMS to:", phone, "Message:", message);
    return true;
  }
}

const smsServiceInstance = new SMSService();

module.exports = SMSService;
module.exports.SMSService = SMSService;
module.exports.smsServiceInstance = smsServiceInstance;
