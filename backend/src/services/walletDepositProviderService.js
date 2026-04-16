import crypto from "crypto";
import { env } from "../config/env.js";
import { providers } from "./providerRegistry.js";
import { getWalletAddressConfirmationCount, listSupportedWalletAssets, normalizeAssetCode, normalizeNetworkCode } from "./walletCatalogService.js";

const STATUS_COMPLETED = new Set(["completed", "confirmed", "credited", "success", "succeeded"]);
const STATUS_CONFIRMING = new Set(["confirming", "processing", "in_progress", "observed"]);
const STATUS_PENDING = new Set(["pending", "awaiting", "queued", "created"]);
const STATUS_FAILED = new Set(["failed", "rejected", "cancelled", "canceled", "dropped", "error"]);

const asObject = (value) => (typeof value === "object" && value !== null ? value : {});
const asString = (value) => (typeof value === "string" ? value.trim() : "");

const asPositiveNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const asNonNegativeInteger = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  return null;
};

const getPayloadField = (payload, keys = []) => {
  const target = asObject(payload);
  for (const key of keys) {
    if (target[key] !== undefined && target[key] !== null) {
      return target[key];
    }
  }
  return undefined;
};

const timingSafeCompare = (left, right) => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const getSupportedAssetsAndNetworks = async () => ({
  provider: env.walletDepositProvider,
  assets: listSupportedWalletAssets(),
});

export const generateDepositAddress = async (payload) => {
  const providerResult = await providers.custody.createDepositAddress(payload);

  return {
    provider: asString(providerResult?.provider) || env.walletDepositProvider,
    requestId: asString(providerResult?.requestId) || null,
    address: asString(providerResult?.address),
    memo: asString(providerResult?.memo) || null,
    network: normalizeNetworkCode(providerResult?.network || payload.network),
    asset: normalizeAssetCode(payload.asset),
    expiresAt: providerResult?.expiresAt || null,
    createdAt: providerResult?.createdAt || new Date().toISOString(),
    metadata: providerResult,
  };
};

const normalizeProviderStatus = (value) => {
  const normalized = asString(value).toLowerCase().replace(/\s+/g, "_");

  if (!normalized) {
    return "pending";
  }

  if (STATUS_COMPLETED.has(normalized)) {
    return "completed";
  }

  if (STATUS_CONFIRMING.has(normalized)) {
    return "confirming";
  }

  if (STATUS_FAILED.has(normalized)) {
    return "failed";
  }

  if (STATUS_PENDING.has(normalized)) {
    return "pending";
  }

  return normalized;
};

export const normalizeDepositWebhook = async (payload) => {
  if (typeof providers.custody.normalizeDepositWebhook === "function") {
    const normalizedFromProvider = await providers.custody.normalizeDepositWebhook(payload);
    return {
      ...normalizedFromProvider,
      status: normalizeProviderStatus(normalizedFromProvider?.status),
    };
  }

  const body = asObject(payload);
  const bodyData = asObject(body.data);

  const provider = asString(getPayloadField(body, ["provider", "providerName"])) || env.walletDepositProvider;
  const eventId = asString(getPayloadField(body, ["eventId", "event_id", "id"])) || null;
  const providerReference = asString(
    getPayloadField(body, ["providerReference", "provider_reference", "reference", "requestId", "request_id"]),
  ) || eventId;
  const txHash = asString(
    getPayloadField(body, ["txHash", "tx_hash", "transactionHash", "transaction_hash", "hash"]),
  ) || null;
  const sourceAddress = asString(
    getPayloadField(body, ["sourceAddress", "source_address", "fromAddress", "from_address"]),
  ) || null;

  const addressCandidate =
    getPayloadField(body, ["address", "destinationAddress", "destination_address", "toAddress", "to_address"]) ??
    getPayloadField(bodyData, ["address", "destinationAddress", "destination_address", "toAddress", "to_address"]);

  const assetCandidate =
    getPayloadField(body, ["asset", "currency", "token"]) ?? getPayloadField(bodyData, ["asset", "currency", "token"]);

  const networkCandidate =
    getPayloadField(body, ["network", "chain", "protocol"]) ?? getPayloadField(bodyData, ["network", "chain", "protocol"]);

  const amountCandidate = getPayloadField(body, ["amount", "value"]) ?? getPayloadField(bodyData, ["amount", "value"]);

  const confirmationsCandidate = getPayloadField(body, ["confirmations", "confirmationsCount", "confirmations_count"]);
  const confirmationsRequiredCandidate = getPayloadField(body, [
    "confirmationsRequired",
    "confirmations_required",
    "requiredConfirmations",
    "required_confirmations",
  ]);

  const occurredAt =
    asString(getPayloadField(body, ["occurredAt", "occurred_at", "timestamp", "createdAt", "created_at"])) ||
    new Date().toISOString();

  const normalized = {
    provider,
    eventId,
    providerReference,
    txHash,
    sourceAddress,
    address: asString(addressCandidate),
    asset: normalizeAssetCode(assetCandidate),
    network: normalizeNetworkCode(networkCandidate),
    amount: asPositiveNumber(amountCandidate),
    confirmations: asNonNegativeInteger(confirmationsCandidate),
    confirmationsRequired: asNonNegativeInteger(confirmationsRequiredCandidate),
    providerStatus: asString(getPayloadField(body, ["status", "depositStatus", "eventType", "event_type"])) || "pending",
    status: normalizeProviderStatus(getPayloadField(body, ["status", "depositStatus", "eventType", "event_type"])),
    occurredAt,
    metadata: {
      payload: body,
    },
  };

  if (!normalized.address) {
    const error = new Error("Deposit webhook payload is missing destination address.");
    error.statusCode = 400;
    throw error;
  }

  if (!normalized.asset) {
    const error = new Error("Deposit webhook payload is missing asset code.");
    error.statusCode = 400;
    throw error;
  }

  if (!normalized.network) {
    const error = new Error("Deposit webhook payload is missing network code.");
    error.statusCode = 400;
    throw error;
  }

  if (!normalized.amount) {
    const error = new Error("Deposit webhook payload is missing amount.");
    error.statusCode = 400;
    throw error;
  }

  return normalized;
};

export const getDepositStatus = (depositEvent) => {
  const providerStatus = normalizeProviderStatus(depositEvent?.status || depositEvent?.providerStatus);

  const requiredConfirmations =
    asNonNegativeInteger(depositEvent?.confirmationsRequired) ??
    getWalletAddressConfirmationCount({ asset: depositEvent.asset, network: depositEvent.network });
  const confirmations = asNonNegativeInteger(depositEvent?.confirmations) ?? 0;

  if (providerStatus === "failed") {
    return {
      status: "failed",
      confirmations,
      confirmationsRequired: requiredConfirmations,
      shouldCredit: false,
      final: true,
    };
  }

  if (providerStatus === "completed" || (requiredConfirmations > 0 && confirmations >= requiredConfirmations && confirmations > 0)) {
    return {
      status: "completed",
      confirmations,
      confirmationsRequired: requiredConfirmations,
      shouldCredit: true,
      final: true,
    };
  }

  if (providerStatus === "confirming" || confirmations > 0) {
    return {
      status: "confirming",
      confirmations,
      confirmationsRequired: requiredConfirmations,
      shouldCredit: false,
      final: false,
    };
  }

  return {
    status: "pending_confirmation",
    confirmations,
    confirmationsRequired: requiredConfirmations,
    shouldCredit: false,
    final: false,
  };
};

export const verifyDepositWebhookSignature = ({ headers, rawBody }) => {
  const signatureSecret = asString(env.walletDepositWebhookSecret);
  const configuredHeader = asString(env.walletDepositWebhookSignatureHeader).toLowerCase() || "x-wallet-signature";

  const resolvedHeaders = asObject(headers);
  const signatureRaw =
    asString(resolvedHeaders[configuredHeader]) ||
    asString(resolvedHeaders[configuredHeader.toUpperCase()]) ||
    asString(resolvedHeaders["x-wallet-signature"]) ||
    asString(resolvedHeaders["x-provider-signature"]) ||
    asString(resolvedHeaders["x-signature"]);

  const signatureValue = signatureRaw.replace(/^sha256=/i, "").trim();

  if (!signatureSecret) {
    if (env.nodeEnv === "production") {
      return {
        valid: false,
        reason: "missing_webhook_secret",
      };
    }

    return {
      valid: true,
      reason: "dev_mode_no_secret",
    };
  }

  if (!signatureValue) {
    return {
      valid: false,
      reason: "missing_signature_header",
    };
  }

  const payloadToSign = typeof rawBody === "string" && rawBody.length > 0 ? rawBody : "";
  const expectedSignature = crypto
    .createHmac("sha256", signatureSecret)
    .update(payloadToSign)
    .digest("hex");

  return {
    valid: timingSafeCompare(signatureValue, expectedSignature),
    reason: "verified",
  };
};
