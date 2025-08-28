const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");

class EmailService {
  constructor() {
    this.mailerSend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });
    
    this.sentFrom = new Sender(
      process.env.MAILERSEND_SENDER_EMAIL || "team@prep101.site", 
      process.env.MAILERSEND_SENDER_NAME || "Prep101 Guide Generator"
    );
  }

  /**
   * Send a guide email to a user
   * @param {string} userEmail - The recipient's email address
   * @param {string} userName - The recipient's name
   * @param {string} guideContent - The HTML content of the guide
   * @param {string} guideTitle - The title of the guide
   * @returns {Promise<Object>} - Result of the email sending operation
   */
  async sendGuideEmail(userEmail, userName, guideContent, guideTitle) {
    try {
      const recipients = [
        new Recipient(userEmail, userName)
      ];

      const emailHtml = this.createGuideEmailTemplate(userName, guideContent, guideTitle);
      const emailText = this.createGuideEmailText(userName, guideTitle);

      const emailParams = new EmailParams()
        .setFrom(this.sentFrom)
        .setTo(recipients)
        .setReplyTo(this.sentFrom)
        .setSubject(`Your Prep101 Guide: ${guideTitle}`)
        .setHtml(emailHtml)
        .setText(emailText);

      const result = await this.mailerSend.email.send(emailParams);
      
      console.log('✅ Guide email sent successfully via MailerSend:', result);
      return {
        success: true,
        messageId: result.body?.data?.id || 'unknown',
        message: 'Guide email sent successfully'
      };
    } catch (error) {
      console.error('❌ MailerSend email sending failed:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Send a welcome email to a new user
   * @param {string} userEmail - The recipient's email address
   * @param {string} userName - The recipient's name
   * @returns {Promise<Object>} - Result of the email sending operation
   */
  async sendWelcomeEmail(userEmail, userName) {
    try {
      const recipients = [
        new Recipient(userEmail, userName)
      ];

      const emailHtml = this.createWelcomeEmailTemplate(userName);
      const emailText = this.createWelcomeEmailText(userName);

      const emailParams = new EmailParams()
        .setFrom(this.sentFrom)
        .setTo(recipients)
        .setReplyTo(this.sentFrom)
        .setSubject('Welcome to Prep101! 🎭')
        .setHtml(emailHtml)
        .setText(emailText);

      const result = await this.mailerSend.email.send(emailParams);
      
      console.log('✅ Welcome email sent successfully via MailerSend:', result);
      return {
        success: true,
        messageId: result.body?.data?.id || 'unknown',
        message: 'Welcome email sent successfully'
      };
    } catch (error) {
      console.error('❌ MailerSend welcome email sending failed:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Send a password reset email
   * @param {string} userEmail - The recipient's email address
   * @param {string} resetToken - The password reset token
   * @returns {Promise<Object>} - Result of the email sending operation
   */
  async sendPasswordResetEmail(userEmail, resetToken) {
    try {
      const recipients = [
        new Recipient(userEmail, 'Prep101 User')
      ];

      const resetUrl = `${process.env.FRONTEND_URL || 'https://prep101.site'}/reset-password?token=${resetToken}`;
      
      const emailHtml = this.createPasswordResetTemplate(resetUrl);
      const emailText = this.createPasswordResetText(resetUrl);

      const emailParams = new EmailParams()
        .setFrom(this.sentFrom)
        .setTo(recipients)
        .setReplyTo(this.sentFrom)
        .setSubject('Reset Your Prep101 Password')
        .setHtml(emailHtml)
        .setText(emailText);

      const result = await this.mailerSend.email.send(emailParams);
      
      console.log('✅ Password reset email sent successfully via MailerSend:', result);
      return {
        success: true,
        messageId: result.body?.data?.id || 'unknown',
        message: 'Password reset email sent successfully'
      };
    } catch (error) {
      console.error('❌ MailerSend password reset email sending failed:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Create the HTML template for guide emails
   */
  createGuideEmailTemplate(userName, guideContent, guideTitle) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Prep101 Guide</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .email-container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
          .content { padding: 30px; }
          .guide-content { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🎭 Prep101 Guide Generator</h1>
            <p>Your personalized acting guide is ready!</p>
          </div>
          <div class="content">
            <h2>Hi ${userName}!</h2>
            <p>Your Prep101 guide "<strong>${guideTitle}</strong>" has been generated and is ready for you to use.</p>
            
            <div class="guide-content">
              ${guideContent}
            </div>
            
            <p>Use this guide to prepare for your audition or performance. Remember to practice regularly and make the character your own!</p>
            
            <a href="${process.env.FRONTEND_URL || 'https://prep101.site'}/dashboard" class="cta-button">Go to Dashboard</a>
          </div>
          <div class="footer">
            <p>This email was sent to ${userEmail}</p>
            <p>© 2024 Prep101. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create the text version for guide emails
   */
  createGuideEmailText(userName, guideTitle) {
    return `
Hi ${userName}!

Your Prep101 guide "${guideTitle}" has been generated and is ready for you to use.

Use this guide to prepare for your audition or performance. Remember to practice regularly and make the character your own!

Visit your dashboard: ${process.env.FRONTEND_URL || 'https://prep101.site'}/dashboard

© 2024 Prep101. All rights reserved.
    `;
  }

  /**
   * Create the HTML template for welcome emails
   */
  createWelcomeEmailTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Prep101!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .email-container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
          .content { padding: 30px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🎭 Welcome to Prep101!</h1>
            <p>Your journey to acting excellence starts here</p>
          </div>
          <div class="content">
            <h2>Hi ${userName}!</h2>
            <p>Welcome to Prep101, the ultimate acting guide generator that will help you prepare for auditions and performances like a pro!</p>
            
            <p>With Prep101, you'll get:</p>
            <ul>
              <li>Personalized character breakdowns</li>
              <li>Scene analysis and tips</li>
              <li>Audition preparation strategies</li>
              <li>Professional acting techniques</li>
            </ul>
            
            <p>Ready to create your first guide? Let's get started!</p>
            
            <a href="${process.env.FRONTEND_URL || 'https://prep101.site'}/dashboard" class="cta-button">Create Your First Guide</a>
          </div>
          <div class="footer">
            <p>© 2024 Prep101. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create the text version for welcome emails
   */
  createWelcomeEmailText(userName) {
    return `
Hi ${userName}!

Welcome to Prep101, the ultimate acting guide generator that will help you prepare for auditions and performances like a pro!

With Prep101, you'll get:
- Personalized character breakdowns
- Scene analysis and tips
- Audition preparation strategies
- Professional acting techniques

Ready to create your first guide? Visit: ${process.env.FRONTEND_URL || 'https://prep101.site'}/dashboard

© 2024 Prep101. All rights reserved.
    `;
  }

  /**
   * Create the HTML template for password reset emails
   */
  createPasswordResetTemplate(resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Prep101 Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .email-container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
          .content { padding: 30px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
            <p>Reset your Prep101 account password</p>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your Prep101 account password. Click the button below to create a new password:</p>
            
            <a href="${resetUrl}" class="cta-button">Reset Password</a>
            
            <p>If you didn't request this password reset, you can safely ignore this email.</p>
            
            <p><strong>Note:</strong> This link will expire in 1 hour for security reasons.</p>
          </div>
          <div class="footer">
            <p>© 2024 Prep101. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create the text version for password reset emails
   */
  createPasswordResetText(resetUrl) {
    return `
Password Reset Request

We received a request to reset your Prep101 account password. Click the link below to create a new password:

${resetUrl}

If you didn't request this password reset, you can safely ignore this email.

Note: This link will expire in 1 hour for security reasons.

© 2024 Prep101. All rights reserved.
    `;
  }

  /**
   * Test the email service configuration
   * @returns {Promise<Object>} - Result of the test
   */
  async testConfiguration() {
    try {
      // Try to send a test email to verify configuration
      const testResult = await this.sendWelcomeEmail('test@example.com', 'Test User');
      
      if (testResult.success) {
        return {
          success: true,
          message: 'MailerSend configuration is working correctly',
          apiKey: process.env.MAILERSEND_API_KEY ? 'Present' : 'Missing'
        };
      } else {
        return {
          success: false,
          error: testResult.error,
          message: 'MailerSend configuration test failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'MailerSend configuration test failed'
      };
    }
  }
}

module.exports = EmailService;
