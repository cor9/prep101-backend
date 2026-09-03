const nodemailer = require('nodemailer');

const APP_URL = (process.env.FRONTEND_URL || 'https://prep101.childactor101.com').replace(/\/+$/, '');

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const GUIDE_TYPE_LABELS = {
  prep101: 'Prep101 audition guide',
  reader101: 'Reader101 support guide',
  bold_choices: 'Bold Choices guide',
};

/**
 * The "your guide is ready" email.
 *
 * Deliberately short: the guide itself is long, and the only job of this
 * message is to get the actor back to it. The HTML guide rides along as an
 * attachment when one is supplied, so the email is useful even offline —
 * on a phone, in a waiting room, with no login handy.
 */
function buildGuideReadyEmail(guide = {}) {
  const characterName = escapeHtml(guide.characterName || 'your character');
  const productionTitle = escapeHtml(guide.productionTitle || 'your audition');
  const typeLabel = GUIDE_TYPE_LABELS[guide.guideType] || GUIDE_TYPE_LABELS.prep101;
  const guideUrl = guide.id ? `${APP_URL}/guide/${guide.id}` : `${APP_URL}/account`;

  const subject = `Your ${characterName} guide for ${productionTitle} is ready`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2933;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7f72;">Child Actor 101</p>
          <h1 style="margin:0;font-size:22px;line-height:1.3;color:#1f2933;">Your guide is ready</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 0;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
            Your ${escapeHtml(typeLabel)} for <strong>${characterName}</strong> in
            <strong>${productionTitle}</strong> has finished generating and is saved to your account.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
            The full guide is attached to this email, and it's waiting in your dashboard too.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <a href="${guideUrl}" style="display:inline-block;background:#1f2933;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">Open your guide</a>
        </td></tr>
        <tr><td style="padding:0 32px 28px;border-top:1px solid #eee7dd;">
          <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
            Break a leg.<br />— Corey and the Child Actor 101 team
          </p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
        <a href="${APP_URL}/account" style="color:#9ca3af;">Your guides</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

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

  async sendGuideEmail({ to, subject, html, attachments }) {
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
        html,
        ...(attachments && attachments.length ? { attachments } : {}),
      });

      console.log(`✅ Email sent successfully via Amazon SES, ID: ${info.messageId}`);
      return info;
    } catch (err) {
      console.error('❌ Amazon SES email send exception:', err.message || err);
      throw err;
    }
  }

  /**
   * Send the completion email for a finished guide, with the guide HTML
   * attached. Used both by the worker (automatically, on completion) and by
   * the "Email me this guide" button.
   */
  async sendGuideReadyEmail({ to, guide = {}, html }) {
    if (!to) throw new Error('No recipient address for guide email.');

    const { subject, html: body } = buildGuideReadyEmail(guide);
    const guideHtml = html || guide.generatedHtml || '';
    const safeName = String(guide.characterName || 'guide')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'guide';

    return this.sendGuideEmail({
      to,
      subject,
      html: body,
      attachments: guideHtml
        ? [
            {
              filename: `${safeName}-guide.html`,
              content: guideHtml,
              contentType: 'text/html; charset=utf-8',
            },
          ]
        : [],
    });
  }
}

module.exports = new EmailService();
module.exports.buildGuideReadyEmail = buildGuideReadyEmail;
