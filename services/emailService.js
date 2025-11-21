const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail =
      process.env.EMAIL_FROM ||
      process.env.MAILERSEND_FROM_EMAIL ||
      'noreply@prep101.site';

    if (!this.apiKey) {
      console.warn('⚠️ Resend API key not configured - email sending is disabled.');
      this.client = null;
    } else {
      this.client = new Resend(this.apiKey);
    }
  }

  isConfigured() {
    return !!this.client;
  }

  async sendGuideEmail({ to, subject, html }) {
    if (!this.client) {
      throw new Error('Email service is not configured. Set RESEND_API_KEY in environment.');
    }

    const { data, error } = await this.client.emails.send({
      from: `Prep101 <${this.fromEmail}>`,
      to,
      subject,
      html
    });

    if (error) {
      console.error('❌ Resend email error:', error);
      throw new Error(error.message || 'Failed to send email via Resend');
    }

    return data;
  }
}

module.exports = new EmailService();


