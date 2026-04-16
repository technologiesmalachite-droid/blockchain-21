import { env } from "../config/env.js";
import { Resend } from "resend";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const maskEmail = (email) => {
  const normalized = normalizeEmail(email);
  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) {
    return "unknown";
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || "*"}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
};

const logInfo = (event, metadata = {}) => {
  console.info(
    JSON.stringify({
      level: "info",
      event,
      ...metadata,
    }),
  );
};

const logError = (event, error, metadata = {}) => {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      ...metadata,
      code: typeof error?.code === "string" ? error.code : null,
      status: typeof error?.status === "number" ? error.status : null,
      message: typeof error?.message === "string" ? error.message : "Unknown error",
      details: typeof error?.details === "string" ? error.details : null,
    }),
  );
};

const ensureResendConfigured = () => {
  if (!env.authEmailOtpResendApiKey) {
    const error = new Error("Email OTP provider API key is not configured.");
    error.code = "CONFIG_EMAIL_OTP_PROVIDER_MISSING";
    throw error;
  }

  if (!env.authEmailOtpFromEmail) {
    const error = new Error("Email OTP sender address is not configured.");
    error.code = "CONFIG_EMAIL_OTP_PROVIDER_MISSING";
    throw error;
  }

  const fromEmail = String(env.authEmailOtpFromEmail).trim();
  if (!fromEmail.includes("@")) {
    const error = new Error("Email OTP sender address is invalid.");
    error.code = "CONFIG_EMAIL_OTP_SENDER_INVALID";
    throw error;
  }
};

const resend = new Resend(process.env.RESEND_API_KEY);

const buildResendFromValue = () => {
  const fromEmail = String(env.authEmailOtpFromEmail || "").trim();
  const fromName = String(env.authEmailOtpFromName || "").trim();
  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
};

const classifyResendFailure = (responseStatus, responseBody) => {
  const responseText = String(responseBody || "").toLowerCase();

  if (
    responseText.includes("onboarding@resend.dev") ||
    responseText.includes("verify your domain") ||
    responseText.includes("verify your email") ||
    responseText.includes("test mode") ||
    responseText.includes("only send") ||
    responseText.includes("restricted")
  ) {
    return "EMAIL_OTP_PROVIDER_RESTRICTED_TEST_SENDER";
  }

  if (responseStatus === 401 || responseStatus === 403) {
    return "EMAIL_OTP_PROVIDER_AUTH_FAILED";
  }

  if (responseStatus === 400 && (responseText.includes("from") || responseText.includes("sender"))) {
    return "CONFIG_EMAIL_OTP_SENDER_INVALID";
  }

  return "EMAIL_OTP_DELIVERY_FAILED";
};

const normalizeProviderErrorCode = (rawCode, statusCode, responseBody) => {
  const classifiedCode = classifyResendFailure(statusCode, responseBody);
  const normalizedRawCode = String(rawCode || "").trim().toLowerCase();

  if (classifiedCode === "EMAIL_OTP_PROVIDER_RESTRICTED_TEST_SENDER") {
    return classifiedCode;
  }

  if (statusCode === 401 || statusCode === 403) {
    return "EMAIL_OTP_PROVIDER_AUTH_FAILED";
  }

  if (
    normalizedRawCode === "unauthorized" ||
    normalizedRawCode === "forbidden" ||
    normalizedRawCode === "invalid_api_key" ||
    normalizedRawCode === "invalid api key" ||
    normalizedRawCode === "api key invalid"
  ) {
    return "EMAIL_OTP_PROVIDER_AUTH_FAILED";
  }

  if (
    normalizedRawCode === "validation_error" ||
    normalizedRawCode === "validation" ||
    normalizedRawCode === "invalid_from" ||
    normalizedRawCode === "invalid sender"
  ) {
    return "CONFIG_EMAIL_OTP_SENDER_INVALID";
  }

  if (classifiedCode && classifiedCode !== "EMAIL_OTP_DELIVERY_FAILED") {
    return classifiedCode;
  }

  if (normalizedRawCode === "aborterror" || normalizedRawCode === "timeout") {
    return "EMAIL_OTP_PROVIDER_NETWORK_FAILED";
  }

  return classifiedCode || "EMAIL_OTP_DELIVERY_FAILED";
};

const sendViaResend = async ({ to, subject, text, html, requestId }) => {
  ensureResendConfigured();
  const normalizedEmail = normalizeEmail(to);
  console.log("email_send_attempt", normalizedEmail);

  logInfo("email_send_attempt", {
    provider: "resend",
    requestId: requestId || null,
    recipient: maskEmail(normalizedEmail),
    subject,
  });

  let timeoutId;
  const sendPromise = resend.emails.send({
    from: buildResendFromValue(),
    to: normalizedEmail,
    subject,
    text,
    html,
  });
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error("Email provider request timed out.");
      timeoutError.code = "EMAIL_OTP_PROVIDER_NETWORK_FAILED";
      reject(timeoutError);
    }, env.authEmailOtpSendTimeoutMs);
  });

  let result;
  try {
    result = await Promise.race([sendPromise, timeoutPromise]);
  } catch (error) {
    const statusCode = Number(error?.statusCode || error?.status || 0);
    const providerCode = normalizeProviderErrorCode(error?.code || error?.name, statusCode, error?.message || "");
    const sendError = new Error("Unable to deliver email OTP.");
    sendError.code = providerCode;
    sendError.status = statusCode || null;
    sendError.details = typeof error?.message === "string" ? error.message : "";
    sendError.cause = error;
    console.error("email_send_failure", error);
    logError("email_send_failure", sendError, {
      provider: "resend",
      requestId: requestId || null,
      recipient: maskEmail(normalizedEmail),
    });
    throw sendError;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (result?.error) {
    const error = new Error("Unable to deliver email OTP.");
    const resendStatus = Number(result.error.statusCode || 0);
    error.code = normalizeProviderErrorCode(result.error.code, resendStatus, result.error.message || "");
    error.status = resendStatus || null;
    error.details = result.error.message || "";
    console.error("email_send_failure", result.error);
    logError("email_send_failure", error, {
      provider: "resend",
      requestId: requestId || null,
      recipient: maskEmail(normalizedEmail),
      responseStatus: resendStatus || null,
    });
    throw error;
  }

  console.log("email_send_success", result);
  logInfo("email_send_success", {
    provider: "resend",
    requestId: requestId || null,
    recipient: maskEmail(normalizedEmail),
    subject,
  });
};

export const sendEmail = async ({ to, subject, text, html, requestId }) => {
  const provider = env.authEmailProvider;

  if (provider === "resend") {
    await sendViaResend({ to, subject, text, html, requestId });
    return;
  }

  const error = new Error(`Unsupported email provider: ${provider}`);
  error.code = "CONFIG_EMAIL_OTP_PROVIDER_MISSING";
  throw error;
};
