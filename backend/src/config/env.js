import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const parseOrigins = (value) =>
  (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const configuredClientUrls = parseOrigins(process.env.CLIENT_URLS);
const fallbackClientUrls = parseOrigins(process.env.CLIENT_URL);
const nodeEnv = process.env.NODE_ENV || "development";
const developmentClientUrls = ["http://localhost:3000", "http://localhost:3001"];

const dedupe = (values) => [...new Set(values)];

const baseClientUrls = configuredClientUrls.length
  ? configuredClientUrls
  : fallbackClientUrls.length
    ? fallbackClientUrls
    : developmentClientUrls;

const resolvedClientUrls = nodeEnv === "development" ? dedupe([...baseClientUrls, ...developmentClientUrls]) : baseClientUrls;

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv,
  clientUrls: resolvedClientUrls,
  jwtSecret: process.env.JWT_SECRET || "replace_with_secure_jwt_secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "replace_with_secure_refresh_secret",
  encryptionKey: process.env.ENCRYPTION_KEY || "replace_with_32_byte_encryption_key",
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "",
  objectStorageBucket: process.env.OBJECT_STORAGE_BUCKET || "",
  identityProviderUrl: process.env.IDENTITY_PROVIDER_URL || "",
  digilockerProviderUrl: process.env.DIGILOCKER_PROVIDER_URL || "",
  sanctionsProviderUrl: process.env.SANCTIONS_PROVIDER_URL || "",
  custodyProviderUrl: process.env.CUSTODY_PROVIDER_URL || "",
  paymentProviderUrl: process.env.PAYMENT_PROVIDER_URL || "",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 200),
  outboxPollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS || 1500),
  outboxBatchSize: Number(process.env.OUTBOX_BATCH_SIZE || 20),
};
