const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    // Use verified domain, or fall back to Resend's test domain for development
    this.fromEmail =
      process.env.EMAIL_FROM ||
      process.env.MAILERSEND_FROM_EMAIL ||
      'onboarding@resend.dev'; // Resend's default test sender

    if (!this.apiKey) {
      console.warn('⚠️ Resend API key not configured - email sending is disabled.');
      this.client = null;
    } else {
      this.client = new Resend(this.apiKey);
      console.log(`📧 Email service configured with from: ${this.fromEmail}`);
    }
  }

  isConfigured() {
    return !!this.client;
  }

  async sendGuideEmail({ to, subject, html }) {
    if (!this.client) {
      throw new Error('Email service is not configured. Set RESEND_API_KEY in environment.');
    }

    console.log(`📧 Attempting to send email to: ${to}, from: ${this.fromEmail}`);

    try {
      const { data, error } = await this.client.emails.send({
        from: `Prep101 <${this.fromEmail}>`,
        to,
        subject,
        html
      });

      if (error) {
        console.error('❌ Resend email error:', JSON.stringify(error));
        throw new Error(error.message || 'Failed to send email via Resend');
      }

      console.log(`✅ Email sent successfully, ID: ${data?.id}`);
      return data;
    } catch (err) {
      console.error('❌ Email send exception:', err.message || err);
      throw err;
    }
  }
}

module.exports = new EmailService();


