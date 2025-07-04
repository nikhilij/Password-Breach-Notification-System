const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: process.env.EMAIL_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Send breach notification email
   * @param {string} email - Recipient email
   * @param {object} breachData - Breach information
   * @returns {Promise<boolean>} - Success status
   */
  async sendBreachNotification(email, breachData) {
    try {
      const mailOptions = {
        from: `"Password Breach Alert" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "🚨 Password Breach Alert - Immediate Action Required",
        html: this.generateBreachNotificationHTML(breachData),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Breach notification sent to ${email}:`, info.messageId);
      return true;
    } catch (error) {
      logger.error("Error sending breach notification:", error);
      throw new Error("Failed to send breach notification email");
    }
  }

  /**
   * Send welcome email to new users
   * @param {string} email - Recipient email
   * @param {string} username - User's username
   * @param {string} verificationToken - Email verification token
   * @returns {Promise<boolean>} - Success status
   */
  async sendWelcomeEmail(email, username, verificationToken) {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

      const mailOptions = {
        from: `"Password Breach Notification System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Welcome! Please verify your email address",
        html: this.generateWelcomeHTML(username, verificationUrl),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Welcome email sent to ${email}:`, info.messageId);
      return true;
    } catch (error) {
      logger.error("Error sending welcome email:", error);
      throw new Error("Failed to send welcome email");
    }
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} resetToken - Password reset token
   * @returns {Promise<boolean>} - Success status
   */
  async sendPasswordResetEmail(email, resetToken) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      const mailOptions = {
        from: `"Password Breach Notification System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Password Reset Request",
        html: this.generatePasswordResetHTML(resetUrl),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent to ${email}:`, info.messageId);
      return true;
    } catch (error) {
      logger.error("Error sending password reset email:", error);
      throw new Error("Failed to send password reset email");
    }
  }

  /**
   * Generate HTML for breach notification email
   * @param {object} breachData - Breach information
   * @returns {string} - HTML content
   */
  generateBreachNotificationHTML(breachData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { text-align: center; margin-bottom: 30px; }
              .alert { background-color: #ff4444; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
              .severity-${breachData.severity} { border-left: 5px solid ${this.getSeverityColor(breachData.severity)}; padding-left: 15px; }
              .actions { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-top: 20px; }
              .action-item { margin-bottom: 10px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🚨 Password Breach Alert</h1>
              </div>
              
              <div class="alert">
                  <strong>URGENT:</strong> One of your passwords has been found in a data breach!
              </div>
              
              <div class="severity-${breachData.severity}">
                  <h3>Breach Details:</h3>
                  <p><strong>Severity:</strong> ${breachData.severity.toUpperCase()}</p>
                  <p><strong>Times Found:</strong> ${breachData.count.toLocaleString()}</p>
                  <p><strong>Source:</strong> ${breachData.source}</p>
                  <p><strong>Date Detected:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              
              <div class="actions">
                  <h3>🛡️ Immediate Actions Required:</h3>
                  <div class="action-item">✅ <strong>Change your password immediately</strong></div>
                  <div class="action-item">✅ <strong>Enable Two-Factor Authentication</strong></div>
                  <div class="action-item">✅ <strong>Check for unauthorized account access</strong></div>
                  <div class="action-item">✅ <strong>Update security questions</strong></div>
                  <div class="action-item">✅ <strong>Monitor your accounts closely</strong></div>
              </div>
              
              <p><strong>What happened?</strong> Your password was found in a database of compromised credentials. This means cybercriminals may have access to it.</p>
              
              <p><strong>What should you do?</strong> Change your password immediately on all accounts where you use this password. Use a strong, unique password for each account.</p>
              
              <div class="footer">
                  <p>This email was sent by Password Breach Notification System</p>
                  <p>If you have questions, please contact our support team.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML for welcome email
   * @param {string} username - User's username
   * @param {string} verificationUrl - Verification URL
   * @returns {string} - HTML content
   */
  generateWelcomeHTML(username, verificationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { text-align: center; margin-bottom: 30px; }
              .button { display: inline-block; padding: 15px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔐 Welcome to Password Breach Notification System</h1>
              </div>
              
              <p>Hello ${username},</p>
              
              <p>Thank you for joining our Password Breach Notification System! We're here to help keep your accounts secure by monitoring for password breaches.</p>
              
              <p>To get started, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <p>Once verified, you'll receive notifications if any of your passwords are found in data breaches.</p>
              
              <p><strong>What we do:</strong></p>
              <ul>
                  <li>Monitor your passwords against known breach databases</li>
                  <li>Send instant alerts when breaches are detected</li>
                  <li>Provide security recommendations</li>
                  <li>Help you stay one step ahead of cybercriminals</li>
              </ul>
              
              <div class="footer">
                  <p>This email was sent by Password Breach Notification System</p>
                  <p>If you didn't create this account, please ignore this email.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML for password reset email
   * @param {string} resetUrl - Password reset URL
   * @returns {string} - HTML content
   */
  generatePasswordResetHTML(resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { text-align: center; margin-bottom: 30px; }
              .button { display: inline-block; padding: 15px 30px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔒 Password Reset Request</h1>
              </div>
              
              <p>You requested a password reset for your Password Breach Notification System account.</p>
              
              <p>Click the button below to reset your password:</p>
              
              <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p><strong>This link will expire in 1 hour.</strong></p>
              
              <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
              
              <div class="footer">
                  <p>This email was sent by Password Breach Notification System</p>
                  <p>For security reasons, this link can only be used once.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Get color based on severity level
   * @param {string} severity - Severity level
   * @returns {string} - Color hex code
   */
  getSeverityColor(severity) {
    switch (severity) {
      case "critical":
        return "#dc3545";
      case "high":
        return "#fd7e14";
      case "medium":
        return "#ffc107";
      case "low":
        return "#28a745";
      default:
        return "#6c757d";
    }
  }
}

// Export both the class and instance for testing and usage
module.exports = EmailService;
// Also export an instance for backward compatibility
module.exports.instance = new EmailService();
