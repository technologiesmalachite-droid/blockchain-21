import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer backend/.env for local backend runs, then fall back to root .env and process env.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const parseOrigins = (value) =>
  (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const mergeUnique = (...groups) => [...new Set(groups.flat().filter(Boolean))];

const parsePatterns = (value) =>
  (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseCsv = (value, fallback = []) => {
  const values = (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return values.length ? values : fallback;
};

const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return fallback;
};

const parseNullablePositiveNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseSameSite = (value, fallback = "lax") => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "lax" || normalized === "strict" || normalized === "none") {
    return normalized;
  }

  return fallback;
};

const parseAuthEmailProvider = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "resend") {
    return "resend";
  }

  if (!normalized) {
    return "resend";
  }

  throw new Error("AUTH_EMAIL_PROVIDER must be set to 'resend'.");
};

const parseWalletDepositProvider = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return "sandbox";
  }

  if (normalized === "sandbox" || normalized === "mock") {
    return "sandbox";
  }

  return normalized;
};

const configuredClientUrls = mergeUnique(
  parseOrigins(process.env.CLIENT_URLS),
  parseOrigins(process.env.FRONTEND_URLS),
);
const fallbackClientUrls = mergeUnique(
  parseOrigins(process.env.CLIENT_URL),
  parseOrigins(process.env.FRONTEND_URL),
);
const configuredClientPatterns = parsePatterns(process.env.CLIENT_URL_PATTERNS);
const nodeEnv = process.env.NODE_ENV || "development";
const developmentClientUrls = ["http://localhost:3000", "http://localhost:3001"];
const defaultProductionClientPatterns = ["https://*.vercel.app"];

const baseClientUrls = configuredClientUrls.length
  ? configuredClientUrls
  : fallbackClientUrls.length
    ? fallbackClientUrls
    : nodeEnv === "development"
      ? developmentClientUrls
      : [];

const resolvedClientUrls = nodeEnv === "development" ? mergeUnique(baseClientUrls, developmentClientUrls) : baseClientUrls;
const resolvedClientPatterns = configuredClientPatterns.length
  ? configuredClientPatterns
  : nodeEnv === "production"
    ? defaultProductionClientPatterns
    : [];

const jwtSecret = process.env.JWT_SECRET || "replace_with_secure_jwt_secret";
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || "replace_with_secure_refresh_secret";
const encryptionKey = process.env.ENCRYPTION_KEY || "replace_with_32_byte_encryption_key";
const databaseUrl = process.env.DATABASE_URL || "";
const dbSslModeRaw = (process.env.DB_SSL_MODE || (nodeEnv === "production" ? "require" : "disable")).toLowerCase();
const dbSslMode = ["require", "disable"].includes(dbSslModeRaw) ? dbSslModeRaw : (nodeEnv === "production" ? "require" : "disable");
const dbSslRejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);
const configurationWarnings = [];
const kycAllowedGovernmentIds = parseCsv(process.env.KYC_ALLOWED_GOV_ID_TYPES, ["passport", "driving_license", "voter_id"]);
const kycAllowedMimeTypes = parseCsv(process.env.KYC_ALLOWED_MIME_TYPES, [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const authEmailProvider = parseAuthEmailProvider(process.env.AUTH_EMAIL_PROVIDER || process.env.AUTH_EMAIL_OTP_PROVIDER || "resend");
const authEmailOtpResendApiKey = process.env.RESEND_API_KEY || "";
const authEmailOtpFromEmail = process.env.AUTH_EMAIL_OTP_FROM_EMAIL || process.env.EMAIL_FROM || "";
const authEmailOtpFromName = process.env.AUTH_EMAIL_OTP_FROM_NAME || "MalachiteX Security";
const walletDepositProvider = parseWalletDepositProvider(process.env.WALLET_DEPOSIT_PROVIDER);
const walletDepositWebhookSecret = process.env.WALLET_DEPOSIT_WEBHOOK_SECRET || "";
const walletDepositWebhookSignatureHeader = (process.env.WALLET_DEPOSIT_WEBHOOK_SIGNATURE_HEADER || "x-wallet-signature")
  .trim()
  .toLowerCase();
const maskApiKey = (value) => {
  const key = String(value || "").trim();
  if (!key) {
    return "missing";
  }
  if (key.length <= 8) {
    return `${key.slice(0, 2)}***`;
  }
  return `${key.slice(0, 4)}***${key.slice(-4)}`;
};

console.info(
  JSON.stringify({
    level: "info",
    event: "auth_email_provider_config",
    provider: authEmailProvider,
    resendApiKey: maskApiKey(authEmailOtpResendApiKey),
    hasEmailFrom: Boolean(authEmailOtpFromEmail),
  }),
);

if (nodeEnv === "production") {
  if (!authEmailOtpResendApiKey) {
    throw new Error("RESEND_API_KEY is required for email OTP delivery.");
  }

  if (!authEmailOtpFromEmail) {
    throw new Error("EMAIL_FROM (or AUTH_EMAIL_OTP_FROM_EMAIL) is required for email OTP delivery.");
  }
} else {
  if (!authEmailOtpResendApiKey) {
    configurationWarnings.push("RESEND_API_KEY is not set. Email OTP delivery may fail; use debug OTP fallback for local testing.");
  }

  if (!authEmailOtpFromEmail) {
    configurationWarnings.push("EMAIL_FROM is not set. Email OTP delivery may fail; use debug OTP fallback for local testing.");
  }
}

const assertProductionSecret = (name, value, minLength) => {
  if (nodeEnv !== "production") {
    return;
  }

  const trimmed = typeof value === "string" ? value.trim() : "";
  const weakDefaults = new Set([
    "replace_with_secure_jwt_secret",
    "replace_with_secure_refresh_secret",
    "replace_with_32_byte_encryption_key",
  ]);

  if (!trimmed || weakDefaults.has(trimmed) || trimmed.length < minLength) {
    configurationWarnings.push(`${name} is not securely configured for production.`);
  }
};

if (nodeEnv === "production" && !databaseUrl) {
  configurationWarnings.push("DATABASE_URL is not configured for production.");
}

if (nodeEnv === "production" && authEmailProvider === "resend") {
  if (!authEmailOtpResendApiKey) {
    configurationWarnings.push("RESEND_API_KEY is not configured for production.");
  }

  if (!authEmailOtpFromEmail) {
    configurationWarnings.push("EMAIL_FROM (or AUTH_EMAIL_OTP_FROM_EMAIL) is not configured for production.");
  }
}

if (nodeEnv === "production" && !walletDepositWebhookSecret) {
  configurationWarnings.push("WALLET_DEPOSIT_WEBHOOK_SECRET is not configured for secure deposit webhooks.");
}

assertProductionSecret("JWT_SECRET", jwtSecret, 32);
assertProductionSecret("JWT_REFRESH_SECRET", jwtRefreshSecret, 32);
assertProductionSecret("ENCRYPTION_KEY", encryptionKey, 24);

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv,
  clientUrls: resolvedClientUrls,
  clientUrlPatterns: resolvedClientPatterns,
  jwtSecret,
  jwtRefreshSecret,
  encryptionKey,
  databaseUrl,
  dbSslMode,
  dbSslRejectUnauthorized,
  authCookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
  authCookieSecure: parseBoolean(process.env.AUTH_COOKIE_SECURE, nodeEnv === "production"),
  authCookieSameSite: parseSameSite(process.env.AUTH_COOKIE_SAMESITE, nodeEnv === "production" ? "none" : "lax"),
  redisUrl: process.env.REDIS_URL || "",
  objectStorageBucket: process.env.OBJECT_STORAGE_BUCKET || "",
  identityProviderUrl: process.env.IDENTITY_PROVIDER_URL || "",
  digilockerProviderUrl: process.env.DIGILOCKER_PROVIDER_URL || "",
  sanctionsProviderUrl: process.env.SANCTIONS_PROVIDER_URL || "",
  custodyProviderUrl: process.env.CUSTODY_PROVIDER_URL || "",
  paymentProviderUrl: process.env.PAYMENT_PROVIDER_URL || "",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 200),
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 900000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  outboxPollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS || 1500),
  outboxBatchSize: Number(process.env.OUTBOX_BATCH_SIZE || 20),
  kycOtpExpiryMinutes: parsePositiveNumber(process.env.KYC_OTP_EXPIRY_MINUTES, 10),
  kycOtpCooldownSeconds: parsePositiveNumber(process.env.KYC_OTP_COOLDOWN_SECONDS, 60),
  kycOtpMaxAttempts: parsePositiveNumber(process.env.KYC_OTP_MAX_ATTEMPTS, 5),
  kycOtpMaxResends: parsePositiveNumber(process.env.KYC_OTP_MAX_RESENDS, 5),
  kycOtpDebug: process.env.KYC_OTP_DEBUG === "true",
  kycRetentionDays: parsePositiveNumber(process.env.KYC_RETENTION_DAYS, 365),
  kycPrivacyNoticeVersion: process.env.KYC_PRIVACY_NOTICE_VERSION || "v1",
  kycStorageBackend: process.env.KYC_STORAGE_BACKEND || "local",
  kycUploadDir: process.env.KYC_UPLOAD_DIR || "storage/kyc",
  kycAllowedGovernmentIds,
  kycAllowedMimeTypes,
  kycDocumentMaxSizeBytes: parsePositiveNumber(process.env.KYC_DOC_MAX_SIZE_BYTES, 10 * 1024 * 1024),
  kycMalwareScanCommand: process.env.KYC_MALWARE_SCAN_COMMAND || "",
  twoFactorLoginTokenTtlSeconds: parsePositiveNumber(process.env.AUTH_2FA_LOGIN_TOKEN_TTL_SECONDS, 300),
  twoFactorTotpWindow: parsePositiveNumber(process.env.AUTH_2FA_TOTP_WINDOW, 1),
  twoFactorTotpIssuer: process.env.AUTH_2FA_ISSUER || "MalachiteX",
  authEmailOtpExpiryMinutes: parsePositiveNumber(process.env.AUTH_EMAIL_OTP_EXPIRY_MINUTES, 5),
  authEmailOtpMaxAttempts: parsePositiveNumber(process.env.AUTH_EMAIL_OTP_MAX_ATTEMPTS, 5),
  authEmailOtpCooldownSeconds: parsePositiveNumber(process.env.AUTH_EMAIL_OTP_COOLDOWN_SECONDS, 60),
  authEmailOtpRateLimitWindowMs: parsePositiveNumber(process.env.AUTH_EMAIL_OTP_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authEmailOtpSendRateLimitMax: parsePositiveNumber(process.env.AUTH_EMAIL_OTP_SEND_RATE_LIMIT_MAX, 8),
  authEmailOtpVerifyRateLimitMax: parsePositiveNumber(process.env.AUTH_EMAIL_OTP_VERIFY_RATE_LIMIT_MAX, 20),
  authEmailProvider,
  authEmailOtpResendApiKey,
  authEmailOtpFromEmail,
  authEmailOtpFromName,
  authEmailOtpDebugLogCode: parseBoolean(process.env.AUTH_EMAIL_OTP_DEBUG_LOG_CODE, false),
  authEmailOtpSendTimeoutMs: parsePositiveNumber(process.env.AUTH_EMAIL_OTP_SEND_TIMEOUT_MS, 10000),
  authPasswordResetTokenTtlMinutes: parsePositiveNumber(process.env.AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES, 20),
  authTwoFactorRecoveryCodeCount: parsePositiveNumber(process.env.AUTH_2FA_RECOVERY_CODE_COUNT, 8),
  notificationsDefaultPageSize: parsePositiveNumber(process.env.NOTIFICATIONS_DEFAULT_PAGE_SIZE, 20),
  notificationsMaxPageSize: parsePositiveNumber(process.env.NOTIFICATIONS_MAX_PAGE_SIZE, 100),
  tradeMakerFeeBps: parsePositiveNumber(process.env.TRADE_MAKER_FEE_BPS, 8),
  tradeTakerFeeBps: parsePositiveNumber(process.env.TRADE_TAKER_FEE_BPS, 10),
  tradeMinOrderNotional: parsePositiveNumber(process.env.TRADE_MIN_ORDER_NOTIONAL, 5),
  tradeMaxOrderNotional: parseNullablePositiveNumber(process.env.TRADE_MAX_ORDER_NOTIONAL),
  tradeMaxOrderQty: parseNullablePositiveNumber(process.env.TRADE_MAX_ORDER_QTY),
  tradeOrderRateLimitWindowMs: parsePositiveNumber(process.env.TRADE_ORDER_RATE_LIMIT_WINDOW, 60000),
  tradeOrderRateLimitMax: parsePositiveNumber(process.env.TRADE_ORDER_RATE_LIMIT_MAX, 30),
  tradeCancelRateLimitWindowMs: parsePositiveNumber(process.env.TRADE_CANCEL_RATE_LIMIT_WINDOW, 60000),
  tradeCancelRateLimitMax: parsePositiveNumber(process.env.TRADE_CANCEL_RATE_LIMIT_MAX, 60),
  walletSwapFeeBps: parsePositiveNumber(process.env.WALLET_SWAP_FEE_BPS, 20),
  walletSwapQuoteTtlSeconds: parsePositiveNumber(process.env.WALLET_SWAP_QUOTE_TTL_SECONDS, 60),
  walletWithdrawalFeeBps: parsePositiveNumber(process.env.WALLET_WITHDRAWAL_FEE_BPS, 10),
  walletHistoryDefaultPageSize: parsePositiveNumber(process.env.WALLET_HISTORY_DEFAULT_PAGE_SIZE, 25),
  walletHistoryMaxPageSize: parsePositiveNumber(process.env.WALLET_HISTORY_MAX_PAGE_SIZE, 100),
  walletActionRateLimitWindowMs: parsePositiveNumber(process.env.WALLET_ACTION_RATE_LIMIT_WINDOW, 60000),
  walletActionRateLimitMax: parsePositiveNumber(process.env.WALLET_ACTION_RATE_LIMIT_MAX, 40),
  walletWithdrawRateLimitWindowMs: parsePositiveNumber(process.env.WALLET_WITHDRAW_RATE_LIMIT_WINDOW, 60000),
  walletWithdrawRateLimitMax: parsePositiveNumber(process.env.WALLET_WITHDRAW_RATE_LIMIT_MAX, 12),
  walletSwapRateLimitWindowMs: parsePositiveNumber(process.env.WALLET_SWAP_RATE_LIMIT_WINDOW, 60000),
  walletSwapRateLimitMax: parsePositiveNumber(process.env.WALLET_SWAP_RATE_LIMIT_MAX, 24),
  walletDepositProvider,
  walletDepositWebhookSecret,
  walletDepositWebhookSignatureHeader,
  configurationWarnings,
};
