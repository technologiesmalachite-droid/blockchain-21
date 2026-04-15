import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ENCRYPTION_VERSION = "v1";
const weakEncryptionKeyValues = new Set(["replace_with_32_byte_encryption_key"]);

const createEncryptionKey = () => createHash("sha256").update(String(env.encryptionKey || "")).digest();

const ensureEncryptionKey = () => {
  const raw = String(env.encryptionKey || "");
  if (!raw || (env.nodeEnv === "production" && weakEncryptionKeyValues.has(raw))) {
    const error = new Error("ENCRYPTION_KEY must be configured with a secure value.");
    error.code = "CONFIG_SECRET_INVALID";
    throw error;
  }
};

authenticator.options = {
  step: 30,
  window: env.twoFactorTotpWindow,
};

const issuerName = env.twoFactorTotpIssuer || "MalachiteX";

const normalizeTotpCode = (value) => String(value || "").replace(/\s+/g, "").trim();
const RECOVERY_CODE_SEGMENT_LENGTH = 4;
const RECOVERY_CODE_SEGMENTS = 2;
const DEFAULT_RECOVERY_CODE_COUNT = 8;

export const generateTotpSetupMaterial = async ({ email }) => {
  const accountName = String(email || "").trim().toLowerCase();
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(accountName, issuerName, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    width: 220,
  });

  return {
    secret,
    otpauthUrl,
    qrCodeDataUrl,
    manualEntryKey: secret,
  };
};

export const encryptTotpSecret = (secret) => {
  ensureEncryptionKey();
  const value = String(secret || "").trim();
  if (!value) {
    throw new Error("TOTP secret is required.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, createEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [ENCRYPTION_VERSION, iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
};

export const decryptTotpSecret = (encryptedSecret) => {
  ensureEncryptionKey();
  const value = String(encryptedSecret || "");
  const [version, ivBase64, authTagBase64, cipherBase64] = value.split(".");

  if (version !== ENCRYPTION_VERSION || !ivBase64 || !authTagBase64 || !cipherBase64) {
    throw new Error("Stored two-factor secret is corrupted.");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(cipherBase64, "base64");

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("Stored two-factor secret has invalid metadata.");
  }

  const decipher = createDecipheriv(ALGORITHM, createEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

export const verifyTotpCode = ({ secret, code }) => {
  const normalizedCode = normalizeTotpCode(code);
  if (!secret || !normalizedCode) {
    return false;
  }

  return authenticator.check(normalizedCode, secret);
};

const normalizeRecoveryCode = (value) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();

const formatRecoveryCode = (value) => {
  const normalized = normalizeRecoveryCode(value);
  if (!normalized) {
    return "";
  }

  const expectedLength = RECOVERY_CODE_SEGMENT_LENGTH * RECOVERY_CODE_SEGMENTS;
  const sliced = normalized.slice(0, expectedLength);
  if (sliced.length <= RECOVERY_CODE_SEGMENT_LENGTH) {
    return sliced;
  }

  return `${sliced.slice(0, RECOVERY_CODE_SEGMENT_LENGTH)}-${sliced.slice(RECOVERY_CODE_SEGMENT_LENGTH)}`;
};

export const generateTwoFactorBackupCodes = (count = DEFAULT_RECOVERY_CODE_COUNT) => {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : DEFAULT_RECOVERY_CODE_COUNT;
  const totalLength = RECOVERY_CODE_SEGMENT_LENGTH * RECOVERY_CODE_SEGMENTS;

  return Array.from({ length: safeCount }, () => {
    const random = randomBytes(totalLength).toString("hex").toUpperCase();
    return formatRecoveryCode(random.slice(0, totalLength));
  });
};

export const hashTwoFactorBackupCodes = async (codes) => {
  const normalizedCodes = Array.isArray(codes) ? codes.map((item) => normalizeRecoveryCode(item)).filter(Boolean) : [];
  const hashes = [];

  for (const code of normalizedCodes) {
    hashes.push(await bcrypt.hash(code, 10));
  }

  return hashes;
};

export const serializeTwoFactorBackupCodeHashes = (hashes) => {
  if (!Array.isArray(hashes) || !hashes.length) {
    return null;
  }

  return JSON.stringify(hashes);
};

export const parseTwoFactorBackupCodeHashes = (value) => {
  if (!value || typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => typeof item === "string" && item.trim());
  } catch {
    return [];
  }
};

export const verifyAndConsumeTwoFactorBackupCode = async ({ code, hashes }) => {
  const normalizedCode = normalizeRecoveryCode(code);
  if (!normalizedCode || !Array.isArray(hashes) || !hashes.length) {
    return { matched: false, remainingHashes: hashes || [] };
  }

  let matchedIndex = -1;
  for (let index = 0; index < hashes.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    const valid = await bcrypt.compare(normalizedCode, hashes[index]);
    if (valid) {
      matchedIndex = index;
      break;
    }
  }

  if (matchedIndex === -1) {
    return { matched: false, remainingHashes: hashes };
  }

  return {
    matched: true,
    remainingHashes: hashes.filter((_, index) => index !== matchedIndex),
  };
};

