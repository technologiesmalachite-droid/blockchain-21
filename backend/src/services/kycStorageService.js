import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "../config/env.js";

const execFileAsync = promisify(execFile);
const MAGIC = Buffer.from("MXKYC1");
const ALGORITHM = "aes-256-gcm";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.resolve(__dirname, "../../", env.kycUploadDir);

const mimeToExtension = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const weakEncryptionKeyValues = new Set(["replace_with_32_byte_encryption_key"]);

const encryptionKey = createHash("sha256").update(env.encryptionKey).digest();

const assertSafeStorageKey = (storageKey) => {
  if (!storageKey || storageKey.includes("..") || path.isAbsolute(storageKey)) {
    throw new Error("Invalid storage key.");
  }
};

const resolveStoragePath = (storageKey) => {
  assertSafeStorageKey(storageKey);
  return path.resolve(uploadRoot, storageKey);
};

const ensureWithinRoot = (targetPath) => {
  const normalizedRoot = path.resolve(uploadRoot);
  const normalizedPath = path.resolve(targetPath);
  const normalizedRootWithSeparator = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;
  const insideRoot = normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRootWithSeparator);
  if (!insideRoot) {
    throw new Error("Refusing to access file outside secure KYC storage root.");
  }
};

const buildStorageKey = (mimeType) => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const extension = mimeToExtension[mimeType] || "bin";
  return `${year}/${month}/${randomUUID()}.${extension}.enc`;
};

const runMalwareScanHook = async (absoluteFilePath) => {
  if (!env.kycMalwareScanCommand) {
    return;
  }

  const [command, ...baseArgs] = env.kycMalwareScanCommand.split(" ").filter(Boolean);
  if (!command) {
    return;
  }

  await execFileAsync(command, [...baseArgs, absoluteFilePath], {
    windowsHide: true,
  });
};

const assertStorageReady = () => {
  if (env.kycStorageBackend !== "local") {
    const error = new Error(`KYC_STORAGE_BACKEND '${env.kycStorageBackend}' is not implemented yet.`);
    error.code = "CONFIG_KYC_STORAGE_INVALID";
    throw error;
  }

  if (env.nodeEnv !== "production") {
    return;
  }

  if (!env.encryptionKey || weakEncryptionKeyValues.has(env.encryptionKey.trim())) {
    const error = new Error("ENCRYPTION_KEY is insecure for production KYC storage.");
    error.code = "CONFIG_SECRET_INVALID";
    throw error;
  }
};

export const storeEncryptedKycFile = async ({ buffer, mimeType }) => {
  assertStorageReady();
  const storageKey = buildStorageKey(mimeType);
  const absoluteFilePath = resolveStoragePath(storageKey);
  ensureWithinRoot(absoluteFilePath);

  await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([MAGIC, iv, authTag, ciphertext]);

  await fs.writeFile(absoluteFilePath, payload);
  try {
    await runMalwareScanHook(absoluteFilePath);
  } catch (error) {
    await fs.unlink(absoluteFilePath).catch(() => {});
    const scanError = new Error("Uploaded document failed security scan.");
    scanError.code = error?.code || "KYC_SCAN_FAILED";
    throw scanError;
  }

  return {
    storageKey,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
    encryptionVersion: "aes-256-gcm:v1",
    fileSizeBytes: buffer.length,
  };
};

export const readEncryptedKycFile = async (storageKey) => {
  assertStorageReady();
  const absoluteFilePath = resolveStoragePath(storageKey);
  ensureWithinRoot(absoluteFilePath);

  const payload = await fs.readFile(absoluteFilePath);
  if (payload.length < MAGIC.length + 12 + 16 || !payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Corrupted encrypted KYC file payload.");
  }

  const ivStart = MAGIC.length;
  const ivEnd = ivStart + 12;
  const tagEnd = ivEnd + 16;
  const iv = payload.subarray(ivStart, ivEnd);
  const authTag = payload.subarray(ivEnd, tagEnd);
  const ciphertext = payload.subarray(tagEnd);

  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

export const deleteEncryptedKycFile = async (storageKey) => {
  assertStorageReady();
  const absoluteFilePath = resolveStoragePath(storageKey);
  ensureWithinRoot(absoluteFilePath);

  try {
    await fs.unlink(absoluteFilePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
};
