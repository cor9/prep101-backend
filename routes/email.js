const express = require('express');
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');
const router = express.Router();

// Initialize MailerSend client
const mailerSend = new MailerSend({ 
  apiKey: process.env.MAILERSEND_API_KEY 
});

// IMPORTANT: use a verified sender address from your MailerSend domain/sender
const FROM_EMAIL = process.env.MAILERSEND_SENDER_EMAIL || "team@prep101.site";
const FROM_NAME = process.env.MAILERSEND_SENDER_NAME || "Prep101";

// Test email configuration
router.post("/test", async (req, res) => {
  try {
    console.log('🧪 Testing MailerSend configuration...');
    console.log('🔑 API Key:', process.env.MAILERSEND_API_KEY ? 'Present' : 'Missing');
    console.log('📧 From Email:', FROM_EMAIL);
    console.log('👤 From Name:', FROM_NAME);
    
    // Test with a simple email to verify configuration
    const emailParams = new EmailParams()
      .setFrom(new Sender(FROM_EMAIL, FROM_NAME))
      .setTo([new Recipient("test@example.com", "Test User")])
      .setSubject("MailerSend Test")
      .setHtml("<h1>Test Email</h1><p>This is a test from Prep101.</p>")
      .setText("Test Email - This is a test from Prep101.");

    const result = await mailerSend.email.send(emailParams);
    console.log('✅ Test email sent successfully:', result);
    res.json({ success: true, message: 'MailerSend configuration test passed', result });
    
  } catch (error) {
    console.error('❌ MailerSend test failed:', error);
    
    if (error.body) {
      console.error('Response Body:', JSON.stringify(error.body, null, 2));
    }
    
    if (error.statusCode) {
      console.error('Status Code:', error.statusCode);
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'MailerSend test failed',
      details: error.body || error
    });
  }
});

// Send guide email to authenticated user
router.post("/send-guide", async (req, res) => {
  try {
    // Ensure user is authenticated (req.user should be set by auth middleware)
    if (!req.user || !req.user.email) {
      return res.status(401).json({ error: "Not authenticated or user email not found" });
    }

    const { subject, html, text, guideTitle } = req.body || {};
    
    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }

    console.log(`📧 Sending guide email to: ${req.user.email}`);
    console.log(`📧 From: ${FROM_EMAIL} (${FROM_NAME})`);
    console.log(`📧 Subject: ${subject || 'Your Prep101 guide is ready'}`);

    const emailParams = new EmailParams()
      .setFrom(new Sender(FROM_EMAIL, FROM_NAME))
      .setTo([new Recipient(req.user.email, req.user.name || "Prep101 User")])
      .setReplyTo(new Sender(FROM_EMAIL, FROM_NAME))
      .setSubject(subject || "Your Prep101 guide is ready")
      .setHtml(html)
      .setText(text || html.replace(/<[^>]+>/g, "")); // plain text fallback

    const result = await mailerSend.email.send(emailParams);
    
    console.log('✅ Guide email sent successfully to:', req.user.email);
    console.log('📊 Result:', result);
    
    res.json({ 
      success: true, 
      message: 'Guide email sent successfully',
      recipient: req.user.email,
      result 
    });
    
  } catch (error) {
    console.error('❌ Guide email failed:', error);
    
    if (error.body) {
      console.error('Response Body:', JSON.stringify(error.body, null, 2));
    }
    
    if (error.statusCode) {
      console.error('Status Code:', error.statusCode);
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send guide email',
      details: error.body || error
    });
  }
});

// Send welcome email to authenticated user
router.post("/welcome", async (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({ error: "Not authenticated or user email not found" });
    }

    const welcomeHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome to Prep101! 🎭</h1>
        <p>Hi ${req.user.name || 'there'},</p>
        <p>Welcome to Prep101! We're excited to help you create amazing acting guides.</p>
        <p>Your account is now active and ready to use.</p>
        <p>Best regards,<br>The Prep101 Team</p>
      </div>
    `;

    const emailParams = new EmailParams()
      .setFrom(new Sender(FROM_EMAIL, FROM_NAME))
      .setTo([new Recipient(req.user.email, req.user.name || "Prep101 User")])
      .setReplyTo(new Sender(FROM_EMAIL, FROM_NAME))
      .setSubject("Welcome to Prep101!")
      .setHtml(welcomeHtml)
      .setText("Welcome to Prep101! We're excited to help you create amazing acting guides.");

    const result = await mailerSend.email.send(emailParams);
    
    console.log('✅ Welcome email sent successfully to:', req.user.email);
    res.json({ success: true, message: 'Welcome email sent successfully' });
    
  } catch (error) {
    console.error('❌ Welcome email failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send welcome email' 
    });
  }
});

module.exports = router;
