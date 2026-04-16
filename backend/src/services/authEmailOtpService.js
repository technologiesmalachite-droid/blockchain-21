import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { sendEmail } from "./mailerService.js";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const shouldDebugOtpCode = () => env.nodeEnv !== "production" && env.authEmailOtpDebugLogCode;

const buildEmailHtml = (otpCode) => `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
    <h2 style="margin:0 0 12px 0;">Your Login Code</h2>
    <p style="margin:0 0 8px 0;">Your OTP is <strong>${otpCode}</strong>.</p>
    <p style="margin:0 0 8px 0;">It expires in ${env.authEmailOtpExpiryMinutes} minutes.</p>
    <p style="margin:0;">If you did not request this code, you can safely ignore this email.</p>
  </div>
`;

export const generateEmailOtpCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export const hashEmailOtpCode = async (otpCode) => bcrypt.hash(String(otpCode), 10);

export const verifyEmailOtpCode = async ({ otpCode, otpHash }) => {
  if (!otpHash) {
    return false;
  }

  return bcrypt.compare(String(otpCode || ""), otpHash);
};

export const sendLoginOtpEmail = async ({ email, otpCode, requestId }) => {
  const normalizedEmail = normalizeEmail(email);
  const code = String(otpCode || "");

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    const error = new Error("Invalid email.");
    error.code = "AUTH_EMAIL_OTP_INVALID_EMAIL";
    throw error;
  }

  if (shouldDebugOtpCode()) {
    console.log("DEV OTP:", code);
  }

  await sendEmail({
    to: normalizedEmail,
    subject: "Your Login Code",
    text: `Your OTP is ${code}. It expires in ${env.authEmailOtpExpiryMinutes} minutes.`,
    html: buildEmailHtml(code),
    requestId,
  });
};
