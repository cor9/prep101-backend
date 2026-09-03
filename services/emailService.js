const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.host = process.env.SES_SMTP_HOST;
    this.port = Number(process.env.SES_SMTP_PORT || 587);
    this.user = process.env.SES_SMTP_USER;
    this.pass = process.env.SES_SMTP_PASS;
    this.fromEmail = process.env.EMAIL_FROM;

    if (!this.host || !this.user || !this.pass || !this.fromEmail) {
      console.warn(
        '⚠️ Amazon SES SMTP is not fully configured - email sending is disabled. ' +
          'Set SES_SMTP_HOST, SES_SMTP_USER, SES_SMTP_PASS, and EMAIL_FROM.'
      );
      this.client = null;
    } else {
      this.client = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465,
        auth: {
          user: this.user,
          pass: this.pass
        },
        requireTLS: this.port !== 465
      });
      console.log(`📧 Amazon SES email service configured with from: ${this.fromEmail}`);
    }
  }

  isConfigured() {
    return !!this.client;
  }

  async sendGuideEmail({ to, subject, html }) {
    if (!this.client) {
      throw new Error(
        'Email service is not configured. Set SES_SMTP_HOST, SES_SMTP_USER, SES_SMTP_PASS, and EMAIL_FROM.'
      );
    }

    console.log(`📧 Attempting to send email to: ${to}, from: ${this.fromEmail}`);

    try {
      const info = await this.client.sendMail({
        from: `Prep101 <${this.fromEmail}>`,
        to,
        subject,
        html
      });

      console.log(`✅ Email sent successfully via Amazon SES, ID: ${info.messageId}`);
      return info;
    } catch (err) {
      console.error('❌ Amazon SES email send exception:', err.message || err);
      throw err;
    }
  }
}

module.exports = new EmailService();
