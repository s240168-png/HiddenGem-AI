const nodemailer = require('nodemailer');

function getEmailConfig() {
  return {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpSecure: process.env.SMTP_SECURE === 'true',
    from: process.env.EMAIL_FROM || 'HiddenGemsAI <noreply@hiddengemsai.com>',
    baseUrl: (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '')
  };
}

/**
 * Production Email Service using Nodemailer with SMTP & dev console fallback
 */
async function sendVerificationEmail({ email, name, token }) {
  const config = getEmailConfig();
  const verificationUrl = `${config.baseUrl}/login.html?verifyToken=${token}&email=${encodeURIComponent(email)}`;
  const isDev = process.env.NODE_ENV !== 'production';

  const subject = 'Verify your HiddenGemsAI Account';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #d9367b;">Welcome to HiddenGemsAI!</h2>
      <p>Hi ${name || 'Explorer'},</p>
      <p>Thank you for registering. Please verify your email address to activate your account and start discovering Ratnagiri's hidden gems.</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${verificationUrl}" style="background-color: #d9367b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
      </div>
      <p style="font-size: 12px; color: #666666;">Or copy and paste this link into your browser:</p>
      <p style="font-size: 12px; color: #666666; word-break: break-all;">${verificationUrl}</p>
      <p style="font-size: 12px; color: #999999; margin-top: 24px;">This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.</p>
    </div>
  `;

  const isSmtpConfigured = Boolean(config.smtpHost && config.smtpUser && config.smtpPass);

  if (isSmtpConfigured) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass
        }
      });

      await transporter.sendMail({
        from: config.from,
        to: email,
        subject,
        html: htmlContent
      });

      console.log(`[EMAIL SERVICE] Verification email successfully sent to ${email} via SMTP.`);
      return { success: true, mode: 'smtp' };
    } catch (error) {
      console.error(`[EMAIL SERVICE ERROR] Failed to send email via SMTP to ${email}:`, error.message);
      if (!isDev) {
        throw new Error('Failed to send verification email. Please try again later.');
      }
    }
  }

  // Fallback behavior for development environment
  if (isDev) {
    console.log(`\n========================================`);
    console.log(`[DEV EMAIL SERVICE] Verification Email for ${email}`);
    console.log(`[DEV EMAIL SERVICE] To: ${name} <${email}>`);
    console.log(`[DEV EMAIL SERVICE] Subject: ${subject}`);
    console.log(`[DEV EMAIL SERVICE] Verification Link: ${verificationUrl}`);
    console.log(`========================================\n`);
    return { success: true, mode: 'dev-console' };
  }

  // Production mode with unconfigured or failing SMTP: raise an explicit controlled error
  console.error(`[EMAIL SERVICE CRITICAL] SMTP configuration is missing or invalid in production environment.`);
  throw new Error('Email service is currently unavailable. Please contact support.');
}

module.exports = {
  sendVerificationEmail,
  getEmailConfig
};
