import nodemailer from 'nodemailer';

/**
 * Create a reusable transporter instance
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // or use a custom SMTP server
    auth: {
      user: process.env.EMAIL_USERNAME, // e.g. your Gmail address
      pass: process.env.EMAIL_PASSWORD, // app password if using Gmail
    },
  });
};

/**
 * Send email verification email with 6-digit code
 */
export async function sendVerificationEmail(
  to: string,
  verificationCode: string,
  firstName: string
): Promise<void> {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to,
    subject: 'Verify your email address',
    html: `
      <h2>Email Verification</h2>
      <p>Hello ${firstName},</p>
      <p>Thank you for signing up! Please verify your email address using the code below:</p>
      <h3 style="font-size: 32px; letter-spacing: 8px; text-align: center; margin: 20px 0; color: #007bff;">${verificationCode}</h3>
      <p>This code is valid for 10 minutes.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}
