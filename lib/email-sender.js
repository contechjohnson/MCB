/**
 * Email Sender Utility
 *
 * Sends weekly analytics reports via Resend API
 * Requires RESEND_API_KEY in environment variables
 *
 * Setup:
 * 1. Sign up at https://resend.com
 * 2. Get API key from dashboard
 * 3. Add to .env.local: RESEND_API_KEY=re_...
 * 4. Verify your sending domain (or use onboarding@resend.dev for testing)
 */

const { Resend } = require('resend');

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send weekly analytics report
 *
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email (or comma-separated list)
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML email content
 * @param {string} options.from - Sender email (defaults to configured sender)
 * @param {string[]} options.cc - CC recipients (optional)
 * @param {string[]} options.bcc - BCC recipients (optional)
 * @param {Object[]} options.attachments - File attachments (optional)
 *
 * @returns {Promise<Object>} - Response from Resend API
 */
async function sendWeeklyReport({
  to,
  subject,
  html,
  from = process.env.RESEND_FROM_EMAIL || 'reports@postpartumcareusa.com',
  cc = [],
  bcc = [],
  attachments = []
}) {
  try {
    // Validate required fields
    if (!to) {
      throw new Error('Recipient email address is required');
    }

    if (!html) {
      throw new Error('Email HTML content is required');
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    console.log(`\n📧 Sending weekly report to: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   From: ${from}\n`);

    // Send email via Resend
    const response = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      cc: cc.length > 0 ? cc : undefined,
      bcc: bcc.length > 0 ? bcc : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      tags: [
        { name: 'report_type', value: 'weekly_analytics' },
        { name: 'automated', value: 'true' }
      ]
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Email ID: ${response.id}`);

    return {
      success: true,
      emailId: response.id,
      message: 'Email sent successfully'
    };

  } catch (error) {
    console.error('❌ Error sending email:', error.message);

    // Handle specific Resend errors
    if (error.message.includes('Invalid API key')) {
      console.error('\n⚠️  Check your RESEND_API_KEY environment variable');
      console.error('   Get your API key from: https://resend.com/api-keys\n');
    }

    if (error.message.includes('domain not verified')) {
      console.error('\n⚠️  Your sending domain needs to be verified');
      console.error('   For testing, use: onboarding@resend.dev as the from address');
      console.error('   For production, verify your domain at: https://resend.com/domains\n');
    }

    throw error;
  }
}

/**
 * Send test email (simple version for testing setup)
 *
 * @param {string} to - Recipient email address
 * @returns {Promise<Object>} - Response from Resend API
 */
async function sendTestEmail(to) {
  const testHTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px; }
    .content { background: #f9fafb; padding: 30px; margin-top: 20px; border-radius: 8px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
    .success { background: #dcfce7; color: #166534; padding: 15px; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ Email System Test</h1>
    <p>Postpartum Care USA Analytics</p>
  </div>
  <div class="content">
    <div class="success">
      <strong>Success!</strong> Your email delivery system is working correctly.
    </div>
    <p>This is a test email from your weekly analytics report system.</p>
    <p><strong>What's working:</strong></p>
    <ul>
      <li>✅ Resend API connection established</li>
      <li>✅ Email templates rendering correctly</li>
      <li>✅ Delivery infrastructure operational</li>
    </ul>
    <p><strong>Next steps:</strong></p>
    <ol>
      <li>Verify you received this email</li>
      <li>Check spam folder if needed</li>
      <li>Test the full weekly report generation</li>
    </ol>
  </div>
  <div class="footer">
    <p>Sent at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: true })}</p>
    <p>Powered by Resend</p>
  </div>
</body>
</html>
  `;

  return sendWeeklyReport({
    to,
    subject: '✅ Test Email - Analytics System',
    html: testHTML
  });
}

/**
 * Validate email configuration
 *
 * @returns {Object} - Configuration status
 */
function validateEmailConfig() {
  const config = {
    resendApiKey: !!process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || 'Not configured (will use default)',
    recipientEmail: process.env.REPORT_RECIPIENT_EMAIL || 'Not configured'
  };

  console.log('\n📧 Email Configuration Status:\n');
  console.log(`RESEND_API_KEY:         ${config.resendApiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`RESEND_FROM_EMAIL:      ${config.fromEmail}`);
  console.log(`REPORT_RECIPIENT_EMAIL: ${config.recipientEmail}`);
  console.log('');

  if (!config.resendApiKey) {
    console.log('⚠️  To configure email sending:');
    console.log('1. Sign up at https://resend.com');
    console.log('2. Get your API key from the dashboard');
    console.log('3. Add to .env.local:');
    console.log('   RESEND_API_KEY=re_your_key_here');
    console.log('   RESEND_FROM_EMAIL=reports@yourdomain.com');
    console.log('   REPORT_RECIPIENT_EMAIL=recipient@email.com');
    console.log('');
  }

  return config;
}

/**
 * Send email to multiple recipients
 *
 * @param {string[]} recipients - Array of email addresses
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @returns {Promise<Object[]>} - Array of responses
 */
async function sendBulkEmails(recipients, subject, html) {
  const results = [];

  for (const recipient of recipients) {
    try {
      const result = await sendWeeklyReport({
        to: recipient,
        subject,
        html
      });
      results.push({ recipient, success: true, ...result });

      // Rate limit: wait 100ms between emails
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      results.push({
        recipient,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

module.exports = {
  sendWeeklyReport,
  sendTestEmail,
  validateEmailConfig,
  sendBulkEmails
};
