import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const extractOtpCode = ({ text, html }) => {
  const merged = `${String(text || "")} ${String(html || "")}`;
  const match = merged.match(/\b([0-9]{6})\b/);
  return match ? match[1] : "";
};

const buildOtpHtml = (otpCode, fallbackHtml = "") => {
  if (otpCode) {
    return `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 12px 0;">Your OTP Code</h2>
        <p style="margin:0 0 8px 0;">Use this code to continue:</p>
        <p style="margin:0 0 12px 0;font-size:22px;font-weight:700;letter-spacing:1px;">${otpCode}</p>
        <p style="margin:0;">If you did not request this code, you can safely ignore this email.</p>
      </div>
    `;
  }

  return fallbackHtml || "<p>Your OTP code is ready.</p>";
};

const createSendFailure = (cause) => {
  const error = new Error("Unable to send OTP. Please try again later.");
  error.code = "EMAIL_OTP_DELIVERY_FAILED";
  error.status = 503;
  error.cause = cause;
  return error;
};

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  return transporter;
};

export const sendEmail = async ({ to, subject: _subject, text, html, requestId }) => {
  const recipient = normalizeEmail(to);
  const fromAddress = String(process.env.EMAIL_FROM || env.authEmailOtpFromEmail || "").trim();
  const otpCode = extractOtpCode({ text, html });
  const timeoutMs = env.authEmailOtpSendTimeoutMs;

  console.log("email_send_attempt", recipient);

  if (!recipient || !recipient.includes("@") || !fromAddress || !fromAddress.includes("@")) {
    const validationError = new Error("Invalid SMTP sender or recipient configuration.");
    validationError.code = "EMAIL_OTP_DELIVERY_FAILED";
    console.error("email_send_failure", validationError);
    throw createSendFailure(validationError);
  }

  let timeoutId;
  const mailPromise = getTransporter().sendMail({
    from: fromAddress,
    to: recipient,
    subject: "Your OTP Code",
    text: text || (otpCode ? `Your OTP code is ${otpCode}.` : "Your OTP code is ready."),
    html: buildOtpHtml(otpCode, html),
    headers: requestId ? { "x-request-id": String(requestId) } : undefined,
  });
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error("SMTP send timed out.");
      timeoutError.code = "EMAIL_OTP_DELIVERY_FAILED";
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    await Promise.race([mailPromise, timeoutPromise]);
    console.log("email_send_success");
  } catch (error) {
    console.error("email_send_failure", error);
    throw createSendFailure(error);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};
