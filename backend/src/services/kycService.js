import { env } from "../config/env.js";
import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { emailVerificationsRepository, phoneVerificationsRepository } from "../repositories/contactVerificationsRepository.js";
import { kycCasesRepository } from "../repositories/kycCasesRepository.js";
import { kycDocumentsRepository } from "../repositories/kycDocumentsRepository.js";
import { kycProfilesRepository } from "../repositories/kycProfilesRepository.js";
import { kycReviewsRepository } from "../repositories/kycReviewsRepository.js";
import { usersRepository } from "../repositories/usersRepository.js";
import { sendKycOtpEmail } from "./authEmailOtpService.js";
import { providers } from "./providerRegistry.js";
import { deleteEncryptedKycFile, readEncryptedKycFile, storeEncryptedKycFile } from "./kycStorageService.js";
import { notifyUser } from "./notificationService.js";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const KYC_STATUS_ORDER = [
  "unverified",
  "email_verified",
  "mobile_verified",
  "documents_submitted",
  "under_review",
  "approved",
];
const REJECTION_STATUSES = new Set(["rejected", "needs_resubmission"]);
const documentBackRequiredTypes = new Set(["driving_license", "aadhaar", "voter_id", "state_id"]);
const allowedReviewTransitions = new Map([
  ["pending", new Set(["under_review", "approved", "rejected", "needs_resubmission"])],
  ["documents_submitted", new Set(["under_review", "approved", "rejected", "needs_resubmission"])],
  ["under_review", new Set(["under_review", "approved", "rejected", "needs_resubmission"])],
  ["needs_resubmission", new Set(["under_review", "approved", "rejected", "needs_resubmission"])],
  ["rejected", new Set(["needs_resubmission", "rejected"])],
  ["approved", new Set(["approved", "needs_resubmission"])],
]);

const normalizeStatus = (status) => {
  if (!status) {
    return "unverified";
  }

  const normalized = String(status).toLowerCase();
  if (normalized === "pending") {
    return "unverified";
  }

  return normalized;
};

const promoteStatus = (currentStatus, nextStatus) => {
  const current = normalizeStatus(currentStatus);
  const next = normalizeStatus(nextStatus);

  if (REJECTION_STATUSES.has(next)) {
    return next;
  }

  const currentIndex = KYC_STATUS_ORDER.indexOf(current);
  const nextIndex = KYC_STATUS_ORDER.indexOf(next);

  if (currentIndex === -1) {
    return next;
  }

  if (nextIndex === -1) {
    return current;
  }

  return nextIndex > currentIndex ? next : current;
};

const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const DATABASE_TRANSIENT_CODE_PREFIX = /^(08|53|57|58|XX)/;
const PHONE_INPUT_REGEX = /^\+?[0-9][0-9\s-]{7,15}$/;

const createKycOtpError = (message, code, statusCode, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
};

const isTransientDatabaseError = (error) => {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";

  return (
    DATABASE_TRANSIENT_CODE_PREFIX.test(code) ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("connect")
  );
};

const normalizePhoneInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (!PHONE_INPUT_REGEX.test(raw)) {
    return "";
  }

  const normalized = raw.replace(/[\s-]/g, "");
  return normalized.startsWith("+") ? `+${normalized.slice(1).replace(/\+/g, "")}` : normalized.replace(/\+/g, "");
};

const maskEmailDestination = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  const [local, domain] = normalized.split("@");
  if (!local || !domain) {
    return "unknown";
  }
  if (local.length <= 2) {
    return `${local[0] || "*"}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
};

const maskPhoneDestination = (phone) => {
  const value = String(phone || "").trim();
  if (value.length <= 4) {
    return "hidden";
  }
  return `${value.slice(0, 2)}******${value.slice(-2)}`;
};

const maskOtpDestination = (channel, destination) =>
  channel === "email" ? maskEmailDestination(destination) : maskPhoneDestination(destination);

const logKycOtpInfo = (event, metadata = {}) => {
  console.info(
    JSON.stringify({
      level: "info",
      event,
      ...metadata,
    }),
  );
};

const logKycOtpError = (event, error, metadata = {}) => {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      ...metadata,
      code: typeof error?.code === "string" ? error.code : null,
      status: typeof error?.status === "number" ? error.status : null,
      statusCode: typeof error?.statusCode === "number" ? error.statusCode : null,
      message: typeof error?.message === "string" ? error.message : "Unknown error",
      details: typeof error?.details === "string" ? error.details : null,
    }),
  );
};

const maskPan = (value) => {
  if (!value) {
    return null;
  }

  const normalized = String(value).toUpperCase();
  if (normalized.length < 4) {
    return "****";
  }

  return `******${normalized.slice(-4)}`;
};

const maskIdentifier = (value) => {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  if (normalized.length <= 4) {
    return "****";
  }

  return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
};

const getAllowedGovernmentIdTypes = (countryCode) => {
  const defaultsByCountry = {
    IN: ["passport", "driving_license", "voter_id", "aadhaar"],
    US: ["passport", "driver_license", "state_id"],
  };

  return defaultsByCountry[countryCode] || env.kycAllowedGovernmentIds;
};

export const getJurisdictionRules = (countryCode) => {
  const jurisdiction = (countryCode || "US").toUpperCase();
  const methods = getAllowedGovernmentIdTypes(jurisdiction).map((type) => ({
    key: type,
    label: type.replace(/_/g, " "),
    requiresDocument: true,
    requiresBack: documentBackRequiredTypes.has(type),
  }));

  return {
    label: jurisdiction === "IN" ? "India" : jurisdiction === "US" ? "United States" : "Global",
    requiredFields: ["fullLegalName", "dob", "email", "mobile", "address", "panNumber"],
    methods,
    addressProofRequired: true,
    nonDocumentaryVerification: false,
    sanctionsScreening: true,
  };
};

export const listJurisdictionOptions = (countryCode) => {
  const jurisdiction = (countryCode || "US").toUpperCase();
  const rules = getJurisdictionRules(jurisdiction);

  return {
    countryCode: jurisdiction,
    jurisdiction: rules.label,
    requiredFields: rules.requiredFields,
    methods: rules.methods,
    addressProofRequired: rules.addressProofRequired,
    nonDocumentaryVerification: rules.nonDocumentaryVerification,
    digilockerAvailable: jurisdiction === "IN",
    sanctionsScreening: rules.sanctionsScreening,
  };
};

const selectVerificationRepository = (channel) => {
  if (channel === "email") {
    return {
      repository: emailVerificationsRepository,
      destinationField: "email",
    };
  }

  return {
    repository: phoneVerificationsRepository,
    provider: providers.smsOtp,
    destinationField: "phone",
  };
};

const normalizeDeliveryError = (error) => {
  const code = typeof error?.code === "string" ? error.code : "";

  if (code === "CONFIG_EMAIL_OTP_PROVIDER_MISSING") {
    return createKycOtpError(
      "Email provider unavailable. Please try again shortly.",
      "CONFIG_EMAIL_OTP_PROVIDER_MISSING",
      503,
    );
  }

  if (code === "CONFIG_EMAIL_OTP_SENDER_INVALID") {
    return createKycOtpError(
      "Email sender configuration is invalid. Please contact support.",
      "CONFIG_EMAIL_OTP_SENDER_INVALID",
      500,
    );
  }

  if (code === "EMAIL_OTP_PROVIDER_RESTRICTED_TEST_SENDER") {
    return createKycOtpError(
      "Email provider rejected the sender identity. Please verify sender/domain settings.",
      "EMAIL_OTP_PROVIDER_RESTRICTED_TEST_SENDER",
      503,
    );
  }

  if (code === "EMAIL_OTP_PROVIDER_AUTH_FAILED") {
    return createKycOtpError(
      "Email provider authentication failed. Please try again shortly.",
      "EMAIL_OTP_PROVIDER_AUTH_FAILED",
      503,
    );
  }

  if (code === "EMAIL_OTP_PROVIDER_NETWORK_FAILED" || code === "EMAIL_OTP_DELIVERY_FAILED") {
    return createKycOtpError(
      "Email provider unavailable. Please try again shortly.",
      code || "EMAIL_OTP_DELIVERY_FAILED",
      503,
    );
  }

  return createKycOtpError(
    "Unable to send OTP right now. Please try again shortly.",
    "KYC_OTP_DELIVERY_FAILED",
    503,
  );
};

const sendOtpViaChannel = async ({ channel, user, destination, otp, requestId }) => {
  if (channel === "email") {
    await sendKycOtpEmail({
      email: destination,
      otpCode: otp,
      requestId,
    });
    return;
  }

  await providers.smsOtp.sendVerification({
    userId: user.id,
    destination,
    otpCode: otp,
    requestId,
  });
};

const resolveOtpDestination = async ({ user, channel, destinationOverride = "" }) => {
  if (channel === "email") {
    return String(user.email || "").trim().toLowerCase();
  }

  const normalizedOverride = normalizePhoneInput(destinationOverride);
  if (destinationOverride && !normalizedOverride) {
    throw createKycOtpError("Enter a valid mobile number to continue KYC.", "KYC_MOBILE_INVALID", 400);
  }

  if (normalizedOverride) {
    return normalizedOverride;
  }

  const normalizedUserPhone = normalizePhoneInput(user.phone);
  if (normalizedUserPhone) {
    return normalizedUserPhone;
  }

  const profile = await kycProfilesRepository.findByUserId(user.id);
  const normalizedProfileMobile = normalizePhoneInput(profile?.mobile);
  if (normalizedProfileMobile) {
    return normalizedProfileMobile;
  }

  throw createKycOtpError("Verify your phone number to continue KYC.", "KYC_MOBILE_MISSING", 400);
};

export const sendContactVerificationOtp = async ({ user, channel, requestId = null, destinationOverride = "" }) => {
  const { repository } = selectVerificationRepository(channel);
  let destination;
  try {
    destination = await resolveOtpDestination({ user, channel, destinationOverride });
  } catch (error) {
    if (isTransientDatabaseError(error)) {
      throw createKycOtpError(
        "Verification service is temporarily unavailable. Please try again shortly.",
        "KYC_OTP_DATABASE_UNAVAILABLE",
        503,
      );
    }
    throw error;
  }
  const alreadyVerified = channel === "email" ? Boolean(user.emailVerified) : Boolean(user.phoneVerified);

  if (!destination) {
    throw createKycOtpError(
      `${channel === "email" ? "Email" : "Phone number"} is missing on this account.`,
      "KYC_OTP_DESTINATION_MISSING",
      400,
    );
  }

  if (alreadyVerified) {
    throw createKycOtpError(
      `${channel === "email" ? "Email" : "Mobile number"} is already verified.`,
      channel === "email" ? "KYC_EMAIL_ALREADY_VERIFIED" : "KYC_MOBILE_ALREADY_VERIFIED",
      409,
    );
  }

  const now = Date.now();
  let latest;
  try {
    latest = await repository.findLatestByUser(user.id);
  } catch (error) {
    if (isTransientDatabaseError(error)) {
      throw createKycOtpError(
        "Verification service is temporarily unavailable. Please try again shortly.",
        "KYC_OTP_DATABASE_UNAVAILABLE",
        503,
      );
    }
    throw error;
  }

  if (latest && !latest.consumedAt) {
    const cooldownUntilMs = latest.cooldownUntil ? new Date(latest.cooldownUntil).getTime() : 0;
    if (cooldownUntilMs > now) {
      const waitSeconds = Math.ceil((cooldownUntilMs - now) / 1000);
      throw createKycOtpError(
        `Please wait ${waitSeconds}s before requesting another OTP.`,
        "KYC_OTP_RETRY_TOO_SOON",
        429,
      );
    }

    if (Number(latest.resendCount || 0) >= Number(latest.maxResends || env.kycOtpMaxResends)) {
      throw createKycOtpError(
        "Maximum resend limit reached. Please try again later.",
        "KYC_OTP_MAX_RESENDS_REACHED",
        429,
      );
    }
  }

  const otp = generateOtp();
  const resendCount = latest && !latest.consumedAt ? Number(latest.resendCount || 0) + 1 : 0;

  let challenge;
  try {
    challenge = await withTransaction(async (db) => {
      if (channel === "phone" && normalizePhoneInput(user.phone) !== destination) {
        await usersRepository.updateById(
          user.id,
          {
            phone: destination,
            phoneVerified: false,
            phoneVerifiedAt: null,
          },
          db,
        );
      }

      await repository.supersedePendingChallenges(user.id, db);
      const created = await repository.createChallenge(
        {
          userId: user.id,
          destination,
          code: otp,
          ttlMinutes: env.kycOtpExpiryMinutes,
          maxAttempts: env.kycOtpMaxAttempts,
          maxResends: env.kycOtpMaxResends,
          resendCount,
          cooldownSeconds: env.kycOtpCooldownSeconds,
        },
        db,
      );

      await auditLogsRepository.create(
        {
          action: `kyc_${channel}_otp_challenge_created`,
          actorId: user.id,
          actorRole: user.role,
          resourceType: "verification",
          resourceId: created.id,
          metadata: {
            channel,
            resendCount,
          },
        },
        db,
      );

      return created;
    });
  } catch (error) {
    if (error?.code === "23505") {
      throw createKycOtpError(
        "A verification challenge is already active. Please wait before requesting another OTP.",
        "KYC_OTP_ACTIVE_CHALLENGE_EXISTS",
        429,
      );
    }
    if (isTransientDatabaseError(error)) {
      throw createKycOtpError(
        "Verification service is temporarily unavailable. Please try again shortly.",
        "KYC_OTP_DATABASE_UNAVAILABLE",
        503,
      );
    }
    throw error;
  }

  const maskedDestination = maskOtpDestination(channel, destination);
  let usedDevFallback = false;
  logKycOtpInfo("otp_send_attempt", {
    requestId,
    channel,
    userId: user.id,
    challengeId: challenge.id,
    destination: maskedDestination,
  });

  try {
    await sendOtpViaChannel({
      channel,
      user,
      destination,
      otp,
      requestId,
    });
    await repository.markChallengeSent(challenge.id);
  } catch (error) {
    const normalizedError = isTransientDatabaseError(error)
      ? createKycOtpError(
          "Verification service is temporarily unavailable. Please try again shortly.",
          "KYC_OTP_DATABASE_UNAVAILABLE",
          503,
        )
      : normalizeDeliveryError(error);
    logKycOtpError("otp_send_failure", normalizedError, {
      requestId,
      channel,
      userId: user.id,
      challengeId: challenge.id,
      destination: maskedDestination,
      providerReasonCode: normalizedError.code || null,
    });

    if (env.nodeEnv !== "production" && env.kycOtpDebug) {
      usedDevFallback = true;
      console.info(
        JSON.stringify({
          level: "info",
          event: "otp_dev_code_issued",
          requestId,
          channel,
          userId: user.id,
          challengeId: challenge.id,
          code: otp,
        }),
      );
    } else {
      try {
        await repository.markChallengeDeliveryFailed(challenge.id, normalizedError.code || "delivery_failed");
      } catch {
        // Best effort cleanup so a failed send does not leave an active challenge forever.
      }
      throw normalizedError;
    }
  }

  const response = {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    cooldownUntil: challenge.cooldownUntil,
    resendCount: challenge.resendCount,
  };

  logKycOtpInfo("otp_send_success", {
    requestId,
    channel,
    userId: user.id,
    challengeId: challenge.id,
    destination: maskedDestination,
    fallback: usedDevFallback ? "dev_debug_code" : null,
  });

  if (env.nodeEnv !== "production" && env.kycOtpDebug) {
    return {
      ...response,
      debugCode: otp,
    };
  }

  return response;
};

const resolvePostVerificationStatus = (user, channel) => {
  const emailVerified = channel === "email" ? true : Boolean(user.emailVerified);
  const mobileVerified = channel === "phone" ? true : Boolean(user.phoneVerified);

  if (emailVerified && mobileVerified) {
    return promoteStatus(user.kycStatus, "mobile_verified");
  }

  if (emailVerified) {
    return promoteStatus(user.kycStatus, "email_verified");
  }

  return normalizeStatus(user.kycStatus);
};

export const verifyContactOtp = async ({ user, channel, code }) => {
  const { repository } = selectVerificationRepository(channel);
  const alreadyVerified = channel === "email" ? Boolean(user.emailVerified) : Boolean(user.phoneVerified);

  if (alreadyVerified) {
    return (await usersRepository.findById(user.id)) || user;
  }

  let challenge;
  try {
    challenge = await repository.findLatestActiveByUser(user.id);
  } catch (error) {
    if (isTransientDatabaseError(error)) {
      throw createKycOtpError(
        "Verification service is temporarily unavailable. Please try again shortly.",
        "KYC_OTP_DATABASE_UNAVAILABLE",
        503,
      );
    }
    throw error;
  }

  if (!challenge) {
    throw createKycOtpError("No active OTP challenge found. Request a new code.", "KYC_OTP_NOT_FOUND", 400);
  }

  if (challenge.expiresAt && new Date(challenge.expiresAt).getTime() < Date.now()) {
    throw createKycOtpError("OTP expired. Request a new code.", "KYC_OTP_EXPIRED", 400);
  }

  if (challenge.status === "blocked" || Number(challenge.attempts || 0) >= Number(challenge.maxAttempts || env.kycOtpMaxAttempts)) {
    throw createKycOtpError(
      "Maximum verification attempts reached. Request a new OTP.",
      "KYC_OTP_MAX_ATTEMPTS_REACHED",
      429,
    );
  }

  let incrementedChallenge;
  try {
    incrementedChallenge = await repository.incrementAttempts(challenge.id);
  } catch (error) {
    if (isTransientDatabaseError(error)) {
      throw createKycOtpError(
        "Verification service is temporarily unavailable. Please try again shortly.",
        "KYC_OTP_DATABASE_UNAVAILABLE",
        503,
      );
    }
    throw error;
  }

  const valid = await repository.verifyChallengeCode(incrementedChallenge || challenge, code);

  if (!valid) {
    if ((incrementedChallenge?.status || challenge.status) === "blocked") {
      throw createKycOtpError(
        "Maximum verification attempts reached. Request a new OTP.",
        "KYC_OTP_MAX_ATTEMPTS_REACHED",
        429,
      );
    }
    throw createKycOtpError("OTP is incorrect.", "KYC_OTP_INCORRECT", 400);
  }

  const nextStatus = resolvePostVerificationStatus(user, channel);

  let updatedUser;
  try {
    updatedUser = await withTransaction(async (db) => {
      await repository.consumeChallenge(challenge.id, db);

      const patch = channel === "email"
        ? {
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
            kycStatus: nextStatus,
          }
        : {
            phone: normalizePhoneInput(challenge.phone) || normalizePhoneInput(user.phone) || user.phone || null,
            phoneVerified: true,
            phoneVerifiedAt: new Date().toISOString(),
            kycStatus: nextStatus,
          };

      const updated = await usersRepository.updateById(user.id, patch, db);

      await auditLogsRepository.create(
        {
          action: channel === "email" ? "kyc_email_verified" : "kyc_mobile_verified",
          actorId: user.id,
          actorRole: user.role,
          resourceType: "user",
          resourceId: user.id,
          metadata: {
            channel,
            status: nextStatus,
          },
        },
        db,
      );

      return updated;
    });
  } catch (error) {
    if (isTransientDatabaseError(error)) {
      throw createKycOtpError(
        "Verification service is temporarily unavailable. Please try again shortly.",
        "KYC_OTP_DATABASE_UNAVAILABLE",
        503,
      );
    }
    throw error;
  }

  return updatedUser;
};

const ensurePan = (panNumber) => {
  const normalized = String(panNumber || "").trim().toUpperCase();
  if (!PAN_REGEX.test(normalized)) {
    throw new Error("PAN format is invalid. Expected format: ABCDE1234F.");
  }
  return normalized;
};

const mapCaseStatusToUserStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === "documents_submitted") {
    return "documents_submitted";
  }
  if (normalized === "under_review") {
    return "under_review";
  }
  if (normalized === "needs_resubmission") {
    return "needs_resubmission";
  }
  if (normalized === "rejected") {
    return "rejected";
  }
  if (normalized === "approved") {
    return "approved";
  }
  return normalized;
};

const ensureDocumentTypeAllowed = (countryCode, documentType) => {
  const allowed = new Set(getAllowedGovernmentIdTypes(countryCode));
  if (!allowed.has(documentType)) {
    throw new Error("Selected government ID type is not allowed for this jurisdiction.");
  }
};

export const submitKycProfile = async ({ user, payload }) => {
  const jurisdiction = (payload.countryCode || user.countryCode || "US").toUpperCase();
  const verificationMethod = payload.governmentIdType || payload.verificationMethod;
  ensureDocumentTypeAllowed(jurisdiction, verificationMethod);

  if (!payload.consentAccepted) {
    throw new Error("Consent is required before submitting KYC details.");
  }

  const panNumber = ensurePan(payload.panNumber || payload.idNumber);
  const panLast4 = panNumber.slice(-4);
  const panMasked = maskPan(panNumber);

  let panVerification;
  try {
    panVerification = await providers.panVerification.verifyPan({
      panNumber,
      fullLegalName: payload.fullLegalName,
      userId: user.id,
    });
  } catch {
    panVerification = {
      provider: "manual_fallback",
      referenceId: null,
      status: "unavailable",
      requiresManualReview: true,
      checkedAt: new Date().toISOString(),
    };
  }

  const result = await withTransaction(async (db) => {
    const profile = await kycProfilesRepository.upsert(
      {
        userId: user.id,
        jurisdiction,
        legalName: payload.fullLegalName,
        dob: payload.dob,
        mobile: payload.mobile || user.phone || null,
        email: payload.email || user.email,
        residentialAddress: payload.address,
        verificationMethod,
        idNumberMasked: panMasked,
        selfieStatus: "pending",
        livenessStatus: "pending",
        documentaryStatus: "pending",
        nonDocumentaryStatus: panVerification.status === "verified" ? "passed" : "pending",
        addressVerificationStatus: payload.addressProofProvided ? "submitted" : "pending",
        digilockerReference: payload.useDigiLocker ? "requested" : null,
        panLast4,
        idDocumentType: verificationMethod,
        consentedAt: new Date().toISOString(),
        privacyNoticeVersion: env.kycPrivacyNoticeVersion,
        resubmissionCount: 0,
        metadata: {
          panVerificationStatus: panVerification.status,
          panVerificationReference: panVerification.referenceId,
        },
      },
      db,
    );

    const activeCase = await kycCasesRepository.findLatestActiveByUser(user.id, db);
    let caseRecord = activeCase;

    if (!activeCase || ["approved", "rejected"].includes(normalizeStatus(activeCase.status))) {
      caseRecord = await kycCasesRepository.create(
        {
          userId: user.id,
          caseType: "submission",
          jurisdiction,
          selectedMethod: verificationMethod,
          status: "documents_submitted",
          riskScore: 0,
          sanctionsResult: "pending",
          reviewerId: null,
          reviewerNote: null,
          idempotencyKey: `kyc_profile_${user.id}_${Date.now()}`,
          metadata: {
            panVerificationStatus: panVerification.status,
          },
        },
        db,
      );
    } else {
      caseRecord = await kycCasesRepository.updateStatus(
        {
          caseId: activeCase.id,
          status: "documents_submitted",
          metadataPatch: {
            panVerificationStatus: panVerification.status,
          },
        },
        db,
      );
    }

    await usersRepository.updateById(
      user.id,
      {
        kycStatus: promoteStatus(user.kycStatus, "documents_submitted"),
        kycTier: "none",
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "kyc_profile_submitted",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "user",
        resourceId: user.id,
        metadata: {
          jurisdiction,
          verificationMethod,
          panLast4,
        },
      },
      db,
    );

    return {
      profile,
      submission: caseRecord,
    };
  });

  return {
    ...result,
    panVerification: {
      status: panVerification.status,
      requiresManualReview: panVerification.requiresManualReview,
      checkedAt: panVerification.checkedAt,
    },
  };
};

const normalizeDocumentRecord = (document) => ({
  id: document.id,
  documentGroup: document.documentGroup,
  documentSide: document.documentSide,
  documentType: document.documentType,
  status: document.status,
  maskedIdentifier: document.maskedIdentifier || null,
  fileSizeBytes: document.fileSizeBytes,
  mimeType: document.mimeType,
  createdAt: document.createdAt,
  reviewedAt: document.reviewedAt,
});

const getFileFromField = (files, field) => (Array.isArray(files?.[field]) ? files[field][0] : null);

const validateFileQuality = (file) => {
  if (!file) {
    return;
  }

  const size = Number(file.size || 0);
  const isImage = typeof file.mimetype === "string" && file.mimetype.startsWith("image/");
  const minimumBytes = isImage ? 15 * 1024 : 5 * 1024;

  if (size < minimumBytes) {
    throw new Error("Uploaded file quality is too low. Please upload a clearer document image.");
  }
};

const validateFileSignature = (file) => {
  if (!file?.buffer || !file?.mimetype) {
    throw new Error("Uploaded file payload is invalid.");
  }

  const bytes = file.buffer;
  const isPdf = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const isJpeg = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  const matches =
    (file.mimetype === "application/pdf" && isPdf) ||
    (file.mimetype === "image/jpeg" && isJpeg) ||
    (file.mimetype === "image/png" && isPng) ||
    (file.mimetype === "image/webp" && isWebp);

  if (!matches) {
    throw new Error("File content does not match the declared MIME type.");
  }
};

export const uploadKycDocuments = async ({ user, payload, files }) => {
  const profile = await kycProfilesRepository.findByUserId(user.id);
  if (!profile) {
    throw new Error("Submit your verification profile before uploading documents.");
  }

  const governmentIdType = payload.governmentIdType || profile.idDocumentType || profile.verificationMethod;
  ensureDocumentTypeAllowed(profile.jurisdiction, governmentIdType);

  const govIdFront = getFileFromField(files, "govIdFront");
  const govIdBack = getFileFromField(files, "govIdBack");
  const panCard = getFileFromField(files, "panCard");
  const selfie = getFileFromField(files, "selfie");

  if (!govIdFront || !panCard || !selfie) {
    throw new Error("Government ID front, PAN card, and selfie files are required.");
  }

  if (documentBackRequiredTypes.has(governmentIdType) && !govIdBack) {
    throw new Error("Selected document type requires both front and back uploads.");
  }

  let activeCase = await kycCasesRepository.findLatestActiveByUser(user.id);
  if (!activeCase || ["approved", "rejected"].includes(normalizeStatus(activeCase.status))) {
    activeCase = await kycCasesRepository.create({
      userId: user.id,
      caseType: "submission",
      jurisdiction: profile.jurisdiction,
      selectedMethod: governmentIdType,
      status: "documents_submitted",
      riskScore: 0,
      sanctionsResult: "pending",
      reviewerId: null,
      reviewerNote: null,
      idempotencyKey: `kyc_doc_${user.id}_${Date.now()}`,
      metadata: {},
    });
  }

  const existingDocuments = await kycDocumentsRepository.listByCaseId(activeCase.id);
  const hasActiveDocuments = existingDocuments.some(
    (item) => !item.deletedAt && item.status !== "purged" && item.status !== "deleted",
  );
  if (hasActiveDocuments && normalizeStatus(activeCase.status) !== "needs_resubmission") {
    throw new Error("Duplicate submission detected. Existing documents are already under review.");
  }

  const retentionUntil = new Date(Date.now() + env.kycRetentionDays * 24 * 60 * 60 * 1000).toISOString();

  if (normalizeStatus(activeCase.status) === "needs_resubmission" && hasActiveDocuments) {
    await kycDocumentsRepository.markSupersededByCase(activeCase.id);
  }

  const fileDefinitions = [
    {
      key: "govIdFront",
      file: govIdFront,
      documentGroup: "government_id",
      documentSide: "front",
      documentType: governmentIdType,
      maskedIdentifier: profile.idNumberMasked || null,
    },
    ...(govIdBack
      ? [
          {
            key: "govIdBack",
            file: govIdBack,
            documentGroup: "government_id",
            documentSide: "back",
            documentType: governmentIdType,
            maskedIdentifier: profile.idNumberMasked || null,
          },
        ]
      : []),
    {
      key: "panCard",
      file: panCard,
      documentGroup: "pan_card",
      documentSide: "single",
      documentType: "pan_card",
      maskedIdentifier: profile.panLast4 ? `******${profile.panLast4}` : null,
    },
    {
      key: "selfie",
      file: selfie,
      documentGroup: "selfie",
      documentSide: "single",
      documentType: "selfie",
      maskedIdentifier: null,
    },
  ];

  const persistedDocuments = [];
  for (const documentFile of fileDefinitions) {
    validateFileQuality(documentFile.file);
    validateFileSignature(documentFile.file);

    const stored = await storeEncryptedKycFile({
      buffer: documentFile.file.buffer,
      mimeType: documentFile.file.mimetype,
    });

    const created = await kycDocumentsRepository.create({
      userId: user.id,
      kycCaseId: activeCase.id,
      documentGroup: documentFile.documentGroup,
      documentSide: documentFile.documentSide,
      documentType: documentFile.documentType,
      originalFilename: documentFile.file.originalname,
      mimeType: documentFile.file.mimetype,
      fileSizeBytes: stored.fileSizeBytes,
      storageKey: stored.storageKey,
      checksumSha256: stored.checksumSha256,
      encryptionVersion: stored.encryptionVersion,
      status: "submitted",
      maskedIdentifier: documentFile.maskedIdentifier,
      retentionUntil,
      metadata: {
        fieldName: documentFile.key,
      },
    });

    persistedDocuments.push(created);
  }

  let documentVerification;
  try {
    documentVerification = await providers.documentVerification.verifyDocuments({
      userId: user.id,
      documentType: governmentIdType,
      documentCount: persistedDocuments.length,
    });
  } catch {
    documentVerification = {
      provider: "manual_fallback",
      referenceId: null,
      status: "under_review",
      requiresManualReview: true,
      checkedAt: new Date().toISOString(),
    };
  }

  const nextStatus = documentVerification.status === "needs_resubmission" ? "needs_resubmission" : "under_review";

  const updatedSubmission = await withTransaction(async (db) => {
    const submission = await kycCasesRepository.updateStatus(
      {
        caseId: activeCase.id,
        status: nextStatus,
        metadataPatch: {
          documentVerificationStatus: documentVerification.status,
          documentVerificationReference: documentVerification.referenceId,
        },
      },
      db,
    );

    await usersRepository.updateById(
      user.id,
      {
        kycStatus: mapCaseStatusToUserStatus(nextStatus),
        kycTier: nextStatus === "approved" ? "enhanced" : "none",
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "kyc_documents_uploaded",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "kyc_case",
        resourceId: submission.id,
        metadata: {
          uploadedCount: persistedDocuments.length,
          nextStatus,
        },
      },
      db,
    );

    return submission;
  });

  return {
    submission: updatedSubmission,
    documents: persistedDocuments.map(normalizeDocumentRecord),
    documentVerification: {
      status: documentVerification.status,
      requiresManualReview: Boolean(documentVerification.requiresManualReview),
      checkedAt: documentVerification.checkedAt,
    },
  };
};

export const getKycStatusForUser = async (user) => {
  const [profile, latestSubmission, auditTrail] = await Promise.all([
    kycProfilesRepository.findByUserId(user.id),
    kycCasesRepository.findLatestByUser(user.id),
    auditLogsRepository.listForUserKyc(user.id, 20),
  ]);

  const documents = latestSubmission ? await kycDocumentsRepository.listByCaseId(latestSubmission.id) : [];
  const reviews = latestSubmission ? await kycReviewsRepository.listByCaseId(latestSubmission.id) : [];
  const latestReview = reviews[0] || null;

  const effectiveStatus = latestSubmission?.status
    ? mapCaseStatusToUserStatus(latestSubmission.status)
    : normalizeStatus(user.kycStatus);

  return {
    status: effectiveStatus,
    tier: user.kycTier,
    contacts: {
      emailVerified: Boolean(user.emailVerified),
      emailVerifiedAt: user.emailVerifiedAt || null,
      mobileVerified: Boolean(user.phoneVerified),
      mobileVerifiedAt: user.phoneVerifiedAt || null,
    },
    profile: profile
      ? {
          ...profile,
          panLast4: profile.panLast4 || null,
          idNumberMasked: profile.idNumberMasked || maskIdentifier(profile.idNumberMasked),
        }
      : null,
    latestSubmission,
    latestReview,
    documents: documents.map(normalizeDocumentRecord),
    auditTrail,
  };
};

export const listKycQueue = async () => {
  const items = await kycCasesRepository.listPending();

  return Promise.all(
    items.map(async (item) => {
      const docs = await kycDocumentsRepository.listByCaseId(item.id);
      return {
        ...item,
        documents: docs.map(normalizeDocumentRecord),
      };
    }),
  );
};

export const listKycCaseDocuments = async (caseId) => {
  const docs = await kycDocumentsRepository.listByCaseId(caseId);
  return docs.map(normalizeDocumentRecord);
};

export const reviewKycSubmission = async ({ actor, submissionId, decision, note, rejectionReason }) => {
  const submission = await kycCasesRepository.findById(submissionId);
  if (!submission) {
    throw new Error("KYC submission not found.");
  }

  const normalizedDecision = decision === "request_resubmission" ? "needs_resubmission" : decision;
  if ((normalizedDecision === "rejected" || normalizedDecision === "needs_resubmission") && !rejectionReason?.trim()) {
    throw new Error("Rejection reason is required for this review decision.");
  }

  const currentStatus = normalizeStatus(submission.status);
  const allowed = allowedReviewTransitions.get(currentStatus);
  if (allowed && !allowed.has(normalizedDecision)) {
    throw new Error(`Invalid KYC transition from ${currentStatus} to ${normalizedDecision}.`);
  }

  const updatedSubmission = await withTransaction(async (db) => {
    const updated = await kycCasesRepository.updateStatus(
      {
        caseId: submission.id,
        status: normalizedDecision,
        reviewerId: actor.id,
        reviewerNote: note || null,
        rejectionReason: rejectionReason || null,
      },
      db,
    );

    await usersRepository.updateById(
      submission.userId,
      {
        kycStatus: mapCaseStatusToUserStatus(normalizedDecision),
        kycTier: normalizedDecision === "approved" ? "enhanced" : "none",
      },
      db,
    );

    if (normalizedDecision === "needs_resubmission") {
      await kycProfilesRepository.incrementResubmissionCount(submission.userId, db);
    }

    await kycDocumentsRepository.updateStatusesByCase(submission.id, normalizedDecision, db);

    await kycReviewsRepository.create(
      {
        kycCaseId: submission.id,
        reviewerId: actor.id,
        decision: normalizedDecision,
        reviewNotes: note || null,
        rejectionReason: rejectionReason || null,
        metadata: {},
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "kyc_review_decision",
        actorId: actor.id,
        actorRole: actor.role,
        resourceType: "kyc_case",
        resourceId: submission.id,
        metadata: {
          decision: normalizedDecision,
          rejectionReason: rejectionReason || null,
        },
      },
      db,
    );

    return updated;
  });

  await notifyUser({
    userId: submission.userId,
    category: "kyc",
    severity: normalizedDecision === "approved" ? "success" : normalizedDecision === "rejected" ? "warning" : "info",
    title:
      normalizedDecision === "approved"
        ? "KYC approved"
        : normalizedDecision === "rejected"
          ? "KYC rejected"
          : normalizedDecision === "needs_resubmission"
            ? "KYC resubmission requested"
            : "KYC status updated",
    message:
      normalizedDecision === "approved"
        ? "Your verification has been approved. Trading and withdrawals remain enabled under your limits."
        : normalizedDecision === "rejected"
          ? rejectionReason || "Your KYC submission was rejected. Review details and resubmit."
          : normalizedDecision === "needs_resubmission"
            ? rejectionReason || "Additional documentation is required. Please resubmit your KYC documents."
            : "Your KYC submission is being reviewed.",
    actionUrl: "/kyc",
    metadata: {
      submissionId: submission.id,
      decision: normalizedDecision,
      rejectionReason: rejectionReason || null,
    },
  });

  return updatedSubmission;
};

export const getKycDocumentFile = async ({ actor, documentId }) => {
  const document = await kycDocumentsRepository.findById(documentId);
  if (!document) {
    throw new Error("KYC document not found.");
  }

  const isAdmin = actor.role === "admin";
  if (!isAdmin && document.userId !== actor.id) {
    throw new Error("You are not allowed to access this document.");
  }

  if (document.status === "purged") {
    throw new Error("Document has been purged.");
  }

  await auditLogsRepository.create({
    action: "kyc_document_viewed",
    actorId: actor.id,
    actorRole: actor.role,
    resourceType: "kyc_document",
    resourceId: documentId,
    metadata: {
      isAdmin,
    },
  });

  const buffer = await readEncryptedKycFile(document.storageKey);
  const fileName = document.originalFilename || `${document.documentGroup}-${document.id}.bin`;

  return {
    buffer,
    mimeType: document.mimeType || "application/octet-stream",
    fileName,
  };
};

export const softDeleteKycDocument = async ({ actor, documentId, reason = "deleted_by_user" }) => {
  const document = await kycDocumentsRepository.findById(documentId);
  if (!document) {
    throw new Error("KYC document not found.");
  }

  if (actor.role !== "admin" && document.userId !== actor.id) {
    throw new Error("You are not allowed to delete this document.");
  }

  const updated = await kycDocumentsRepository.softDeleteById({ id: documentId, reason });
  await auditLogsRepository.create({
    action: "kyc_document_soft_deleted",
    actorId: actor.id,
    actorRole: actor.role,
    resourceType: "kyc_document",
    resourceId: documentId,
    metadata: { reason },
  });

  return normalizeDocumentRecord(updated);
};

export const purgeExpiredKycDocuments = async ({ actor }) => {
  const expired = await kycDocumentsRepository.listExpiredForPurge(200);
  let purgedCount = 0;

  for (const item of expired) {
    try {
      await deleteEncryptedKycFile(item.storageKey);
      await kycDocumentsRepository.markPurged(item.id);
      purgedCount += 1;
    } catch {
      // Continue purging remaining documents; the next run can retry failed items.
    }
  }

  await auditLogsRepository.create({
    action: "kyc_documents_purged",
    actorId: actor.id,
    actorRole: actor.role,
    resourceType: "kyc_document",
    resourceId: "bulk",
    metadata: { purgedCount },
  });

  return { purgedCount, scanned: expired.length };
};

export const submitKycApplication = async ({ user, payload }) =>
  submitKycProfile({
    user,
    payload: {
      countryCode: payload.countryCode,
      fullLegalName: payload.fullLegalName,
      dob: payload.dob,
      mobile: payload.mobile,
      email: payload.email,
      address: payload.address,
      governmentIdType: payload.verificationMethod,
      panNumber: payload.panNumber || payload.idNumber,
      addressProofProvided: payload.addressProofProvided,
      useDigiLocker: payload.useDigiLocker,
      consentAccepted: payload.consentAccepted,
    },
  });
