import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create transporter using Gmail OAuth2 settings from .env
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
});

/**
 * Sends an email with an OTP for verification.
 * Automatically falls back to console.log if SMTP_USER is not configured.
 */
export async function sendOtpEmail(
  to: string,
  otp: string,
  type: "verify" | "reset",
) {
  const isSetup = Boolean(process.env.EMAIL_USER && process.env.GMAIL_PASSWORD);

  if (!isSetup) {
    console.warn(`\n[MAILER MOCK] OAuth credentials missing in .env.`);
    console.warn(`[MAILER MOCK] Sending ${type} OTP to ${to}: ${otp}\n`);
    return;
  }

  const subject =
    type === "verify"
      ? "Verify your ShunyaScape Account"
      : "Reset your ShunyaScape Password";

  let html = "";
  if (type === "verify") {
    html = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; background-color: #050505; color: #fff; border-radius: 10px;">
        <h1 style="color: #06b6d4; text-align: center;">ShunyaScape</h1>
        <p style="font-size: 16px; color: #cbd5e1;">Welcome to ShunyaScape! Please verify your email address to enter the simulation.</p>
        <div style="margin: 30px 0; padding: 20px; background-color: #0f172a; border-radius: 8px; text-align: center;">
          <p style="font-size: 14px; color: #94a3b8; margin-bottom: 10px;">Your Verification Code:</p>
          <p style="font-size: 32px; font-weight: bold; color: #d946ef; letter-spacing: 5px; margin: 0;">${otp}</p>
        </div>
        <p style="font-size: 12px; color: #64748b; text-align: center;">This code will expire in 10 minutes.</p>
      </div>
    `;
  } else {
    html = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; background-color: #050505; color: #fff; border-radius: 10px;">
        <h1 style="color: #06b6d4; text-align: center;">ShunyaScape</h1>
        <p style="font-size: 16px; color: #cbd5e1;">We received a request to reset your ShunyaScape password.</p>
        <div style="margin: 30px 0; padding: 20px; background-color: #0f172a; border-radius: 8px; text-align: center;">
          <p style="font-size: 14px; color: #94a3b8; margin-bottom: 10px;">Your Password Reset Code:</p>
          <p style="font-size: 32px; font-weight: bold; color: #d946ef; letter-spacing: 5px; margin: 0;">${otp}</p>
        </div>
        <p style="font-size: 12px; color: #64748b; text-align: center;">This code will expire in 10 minutes.</p>
      </div>
    `;
  }

  try {
    await transporter.sendMail({
      from:
        process.env.EMAIL_USER || '"ShunyaScape" <noreply@shunyascape.local>',
      to,
      subject,
      html,
    });
    console.log(`[MAILER] Sent ${type} OTP to ${to}`);
  } catch (error) {
    console.error(`[MAILER ERROR] Failed to send email to ${to}:`, error);
    // Even if it fails, we log the OTP so the user can continue testing
    console.log(`[MAILER FALLBACK] OTP for ${to} is: ${otp}`);
  }
}
