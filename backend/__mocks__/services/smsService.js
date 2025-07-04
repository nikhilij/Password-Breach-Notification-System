// Mock implementation of the SMSService
module.exports = class SMSService {
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

  async sendSMS(to, message) {
    if (this.useMockService) {
      return true;
    }
    return true;
  }

  async sendMockSMS(_phone, _message) {
    return true;
  }

  async sendBreachNotificationSMS(to, details) {
    return this.sendSMS(
      to,
      `Security Alert: ${details.severity} breach detected`,
    );
  }

  formatPhoneNumber(phone) {
    let formatted = phone.replace(/\D/g, "");
    if (!formatted.startsWith("+")) {
      formatted = "+1" + formatted;
    }
    return formatted;
  }
};
