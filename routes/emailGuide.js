const express = require('express');
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');

const router = express.Router();

const mailerSend = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY });
const FROM_EMAIL = process.env.MAILERSEND_SENDER_EMAIL; // must be verified in MailerSend
const FROM_NAME = process.env.MAILERSEND_SENDER_NAME || "Prep101";
const APP_BASE = process.env.APP_BASE_URL || "http://localhost:3000";

router.post("/:id/email", async (req, res) => {
  const guideId = req.params.id;

  try {
    // sanity logs
    console.log("[email] hit", { guideId });
    console.log("[email] env", {
      hasKey: !!process.env.MAILERSEND_API_KEY,
      from: FROM_EMAIL,
      appBase: APP_BASE
    });

    // auth
    const user = req.user;
    console.log("[email] user", { email: user?.email });
    if (!user?.email) return res.status(401).json({ error: "Not authenticated" });
    if (!FROM_EMAIL) return res.status(500).json({ error: "MAILERSEND_SENDER_EMAIL not set" });
    if (!process.env.MAILERSEND_API_KEY) return res.status(500).json({ error: "MAILERSEND_API_KEY not set" });

    // build email
    const viewUrl = `${APP_BASE}/guides/${guideId}`;
    const subject = req.body?.subject || "Your Prep101 guide is ready";
    const html = req.body?.html || `<p>Your guide is ready. <a href="${viewUrl}">Open</a></p>`;
    const text = (req.body?.text) || html.replace(/<[^>]+>/g, "");

    const params = new EmailParams()
      .setFrom(new Sender(FROM_EMAIL, FROM_NAME))
      .setTo([new Recipient(user.email, user.name || "Prep101 User")])
      .setReplyTo(new Sender(FROM_EMAIL, FROM_NAME))
      .setSubject(subject)
      .setHtml(html)
      .setText(text);

    // if you were attaching a file, comment it out for now to eliminate path errors
    // params.setAttachments([{ filename: 'guide.pdf', content: base64Pdf, disposition: 'attachment' }]);

    let resp;
    try {
      resp = await mailerSend.email.send(params);
      console.log("[email] MailerSend response", resp);
    } catch (e) {
      console.error("[email] MailerSend error", e?.response?.body || e);
      // surface provider message to client for now
      return res.status(500).json({ error: e?.response?.body || e?.message || "MailerSend failed" });
    }

    return res.json({ ok: true, id: resp?.messageId || resp });
  } catch (err) {
    console.error("[email] server error", err);
    return res.status(500).json({ error: err?.message || "Email failed" });
  }
});

module.exports = router;
