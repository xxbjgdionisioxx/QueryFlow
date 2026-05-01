import nodemailer from 'nodemailer';

const isGmail = process.env.MAIL_HOST?.includes('gmail.com');

const transporter = nodemailer.createTransport(isGmail ? {
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
} : {
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || '587'),
  secure: process.env.MAIL_PORT == '465',
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});

/**
 * Sends an OTP email to the user.
 * @param {string} to - Recipient email
 * @param {string} otp - The 6-digit OTP code
 * @param {string} subject - Optional subject (default: Verification Code)
 */
export async function sendOtpEmail(to, otp, subject = 'Verification Code') {
  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME || 'QueryFlow'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME}>`,
    to: to,
    subject: `QueryFlow: ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #7c6af7; text-align: center;">QueryFlow</h2>
        <p>Hello,</p>
        <p>Thank you for signing up for QueryFlow. Use the following verification code to complete your registration:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #7c6af7; background: #f4f3ff; padding: 10px 20px; border-radius: 5px; border: 1px dashed #7c6af7;">
            ${otp}
          </span>
        </div>
        <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">
          &copy; 2024 QueryFlow. Built for visual SQL mastery.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email Service] OTP sent to ${to}`);
  } catch (error) {
    console.error(`[Email Service] Error sending email to ${to}:`, error);
    // In dev, we still log the OTP to console so the user isn't stuck if credentials are wrong
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUTH DEBUG] Fallback OTP for ${to}: ${otp}`);
    }
    throw new Error(`Email failed: ${error.message}`);
  }
}
