import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { authFactorsRepository } from "../repositories/authFactorsRepository.js";
import { passwordResetTokensRepository } from "../repositories/passwordResetTokensRepository.js";
import { sessionsRepository } from "../repositories/sessionsRepository.js";
import { usersRepository } from "../repositories/usersRepository.js";
import {
  authenticateUserCredentials,
  createUser,
  findOrCreateFirebaseUser,
  sanitizeUser,
  verifyPassword,
} from "../services/userService.js";
import { verifyFirebaseIdToken } from "../services/firebaseAdminService.js";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTwoFactorBackupCodes,
  generateTotpSetupMaterial,
  hashTwoFactorBackupCodes,
  parseTwoFactorBackupCodeHashes,
  serializeTwoFactorBackupCodeHashes,
  verifyAndConsumeTwoFactorBackupCode,
  verifyTotpCode,
} from "../services/twoFactorService.js";
import { sendContactVerificationOtp, verifyContactOtp } from "../services/kycService.js";
import { notifyUser } from "../services/notificationService.js";
import {
  signAccessToken,
  signRefreshToken,
  signTwoFactorLoginToken,
  verifyRefreshToken,
  verifyTwoFactorLoginToken,
} from "../utils/tokens.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env.js";

const refreshTokenExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const knownAuthMessages = new Set([
  "An account with this email already exists.",
  "An account with this email or phone already exists.",
  "Terms and privacy consent are required to create an account.",
  "Firebase account is missing a verified email address.",
  "Firebase account is missing a valid UID.",
  "Firebase identity email does not match the linked account.",
  "This email is already linked to another Firebase account.",
  "Invalid credentials.",
  "Your account is restricted. Please contact support.",
  "This account is frozen pending compliance review.",
  "Two-factor verification is required.",
  "Two-factor authentication is not enabled on this account.",
  "Two-factor authentication is already enabled.",
  "Two-factor setup session is invalid or has expired. Please start setup again.",
  "Invalid two-factor code. Please try again.",
  "Invalid two-factor or recovery code. Please try again.",
  "Current password is incorrect.",
  "New password must be different from your current password.",
  "Password reset token is invalid or has expired.",
  "Password has been reset successfully.",
  "Password changed successfully.",
  "Session not found.",
  "Two-factor recovery codes regenerated successfully.",
  "Password or valid two-factor code is required to regenerate backup codes.",
  "Password or valid two-factor code is required to disable two-factor authentication.",
]);

const logAuthInfo = (event, details = {}) => {
  console.info(
    JSON.stringify({
      level: "info",
      event,
      ...details,
    }),
  );
};

const logAuthError = (event, error, details = {}) => {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      ...details,
      code: typeof error?.code === "string" ? error.code : null,
      message: typeof error?.message === "string" ? error.message : "Unknown error",
      stack: typeof error?.stack === "string" ? error.stack : null,
    }),
  );
};

const isInfrastructureIssue = (error) => {
  if (!error) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const networkCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
    "CONFIG_SECRET_INVALID",
    "CONFIG_FIREBASE_ADMIN_MISSING",
    "CONFIG_FIREBASE_ADMIN_INVALID",
  ]);
  const dbCodes = /^(08|53|57|3D|XX)/;
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  return (
    networkCodes.has(code) ||
    dbCodes.test(code) ||
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("connect") ||
    message.includes("timeout") ||
    message.includes("jwt_secret") ||
    message.includes("jwt_refresh_secret") ||
    message.includes("secret")
  );
};

const isFirebaseTokenIssue = (error) => {
  const code = typeof error?.code === "string" ? error.code : "";
  return code.startsWith("auth/") || code === "auth/argument-error";
};

const resolveFirebaseProvider = (decoded) => {
  const claimedProvider =
    typeof decoded?.firebase?.sign_in_provider === "string"
      ? decoded.firebase.sign_in_provider.trim().toLowerCase()
      : "";

  if (!claimedProvider) {
    return "firebase";
  }

  if (claimedProvider === "google.com") {
    return "google";
  }

  if (claimedProvider === "password") {
    return "email";
  }

  return claimedProvider;
};

const resolveVerifiedFirebaseIdentity = (decoded) => {
  const firebaseUid = typeof decoded?.uid === "string" ? decoded.uid.trim() : "";
  const firebaseEmail = typeof decoded?.email === "string" ? decoded.email.trim().toLowerCase() : "";
  const firebaseEmailVerified = decoded?.email_verified === true;
  const firebaseProvider = resolveFirebaseProvider(decoded);

  return {
    firebaseUid,
    firebaseEmail,
    firebaseEmailVerified,
    firebaseProvider,
  };
};

const knownMessageOrFallback = (error, fallback) => {
  const message = typeof error?.message === "string" ? error.message.trim() : "";

  if (!message) {
    return fallback;
  }

  return knownAuthMessages.has(message) ? message : fallback;
};

const respondWithSession = async (res, user, req) => {
  logAuthInfo("auth_session_issue_start", {
    requestId: req.requestId,
    userId: user.id,
    route: req.originalUrl,
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const session = await sessionsRepository.create({
    userId: user.id,
    token: refreshToken,
    userAgent: req.headers["user-agent"] || "unknown",
    ipAddress: req.ip || req.socket?.remoteAddress || "unknown",
    expiresAt: refreshTokenExpiry(),
  });

  logAuthInfo("auth_session_issue_success", {
    requestId: req.requestId,
    userId: user.id,
    sessionId: session.id,
    route: req.originalUrl,
  });

  await auditLogsRepository.create({
    action: "auth_session_created",
    actorId: user.id,
    actorRole: user.role,
    resourceType: "session",
    resourceId: session.id,
    metadata: {
      ipAddress: req.ip || req.socket?.remoteAddress || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      route: req.originalUrl,
    },
  });

  await notifyUser({
    userId: user.id,
    category: "auth",
    severity: "info",
    title: "New sign-in detected",
    message: "A new session was created for your account.",
    actionUrl: "/profile",
    metadata: {
      sessionId: session.id,
      ipAddress: req.ip || req.socket?.remoteAddress || "unknown",
    },
  });

  return res.json({
    user: sanitizeUser(user),
    tokens: { accessToken, refreshToken },
  });
};

const createTwoFactorChallengeResponse = (user, req) => {
  const loginToken = signTwoFactorLoginToken(user);

  logAuthInfo("login_requires_two_factor", {
    requestId: req.requestId,
    userId: user.id,
    route: req.originalUrl,
  });

  return {
    requiresTwoFactor: true,
    loginToken,
    message: "Two-factor verification is required.",
  };
};

const normalizeTotpInput = (value) => String(value || "").trim();
const normalizeEmailInput = (value) => String(value || "").trim().toLowerCase();
const PASSWORD_RESET_GENERIC_MESSAGE = "If an account with that email exists, password reset instructions have been sent.";
const createResetToken = () => crypto.randomBytes(32).toString("hex");

const createRecoveryCodes = async () => {
  const codes = generateTwoFactorBackupCodes(env.authTwoFactorRecoveryCodeCount);
  const hashes = await hashTwoFactorBackupCodes(codes);
  return {
    codes,
    serializedHashes: serializeTwoFactorBackupCodeHashes(hashes),
  };
};

export const register = async (req, res) => {
  logAuthInfo("register_request_received", {
    requestId: req.requestId,
    route: req.originalUrl,
    email: req.validated?.body?.email || null,
    phone: req.validated?.body?.phone || null,
    validationPassed: Boolean(req.validated?.body),
  });

  try {
    logAuthInfo("register_user_create_start", {
      requestId: req.requestId,
      email: req.validated?.body?.email || null,
    });

    const user = await createUser(req.validated.body);

    logAuthInfo("register_user_create_success", {
      requestId: req.requestId,
      userId: user.id,
    });

    await auditLogsRepository.create({
      action: "verification_channels_ready",
      actorId: user.id,
      actorRole: user.role,
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        channels: ["email", "phone"],
      },
    });

    logAuthInfo("register_audit_log_success", {
      requestId: req.requestId,
      userId: user.id,
      action: "verification_channels_ready",
    });

    await notifyUser({
      userId: user.id,
      category: "auth",
      severity: "success",
      title: "Welcome to MalachiteX",
      message: "Your account was created successfully. Complete verification to unlock all features.",
      actionUrl: "/kyc",
      metadata: {
        event: "user_registered",
      },
    });

    await respondWithSession(res.status(201), user, req);
    return;
  } catch (error) {
    if (error?.code === "23505") {
      logAuthInfo("register_duplicate_conflict", {
        requestId: req.requestId,
        email: req.validated?.body?.email || null,
        phone: req.validated?.body?.phone || null,
        code: error.code,
      });
      return res.status(409).json({ message: "An account with this email or phone already exists." });
    }

    const knownMessage = knownMessageOrFallback(error, "");
    if (knownMessage) {
      logAuthInfo("register_validation_or_domain_error", {
        requestId: req.requestId,
        message: knownMessage,
        email: req.validated?.body?.email || null,
      });
      return res.status(400).json({ message: knownMessage });
    }

    if (isInfrastructureIssue(error)) {
      logAuthError("register_infrastructure_error", error, {
        requestId: req.requestId,
        email: req.validated?.body?.email || null,
      });
      return res.status(500).json({ message: "Registration is temporarily unavailable. Please try again shortly." });
    }

    logAuthError("register_unexpected_error", error, {
      requestId: req.requestId,
      email: req.validated?.body?.email || null,
    });
    return res.status(500).json({ message: "Unable to create your account due to an unexpected server error." });
  }
};

export const login = async (req, res) => {
  try {
    const user = await authenticateUserCredentials(req.validated.body);

    if (user.twoFactorEnabled) {
      if (!user.twoFactorSecret) {
        logAuthError("login_two_factor_misconfigured", new Error("two_factor_secret_missing"), {
          requestId: req.requestId,
          userId: user.id,
        });
        return res.status(500).json({ message: "Two-factor authentication is currently unavailable for this account." });
      }

      return res.status(200).json(createTwoFactorChallengeResponse(user, req));
    }

    await respondWithSession(res, user, req);
    return;
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("login_infrastructure_error", error, {
        requestId: req.requestId,
        email: req.validated?.body?.email || null,
      });
      return res.status(500).json({ message: "Authentication is temporarily unavailable. Please try again shortly." });
    }

    return res.status(401).json({
      message: knownMessageOrFallback(error, "Invalid credentials."),
    });
  }
};

export const forgotPassword = async (req, res) => {
  const email = normalizeEmailInput(req.validated.body.email);

  try {
    const user = await usersRepository.findByEmail(email);

    if (user) {
      const resetToken = createResetToken();
      await passwordResetTokensRepository.consumeAllForUser(user.id);
      const record = await passwordResetTokensRepository.create({
        userId: user.id,
        token: resetToken,
        ttlMinutes: env.authPasswordResetTokenTtlMinutes,
        requestedIp: req.ip || req.socket?.remoteAddress || "unknown",
        requestedUserAgent: req.headers["user-agent"] || "unknown",
      });

      await auditLogsRepository.create({
        action: "password_reset_requested",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "user",
        resourceId: user.id,
        metadata: {
          resetRequestId: record.id,
        },
      });

      await notifyUser({
        userId: user.id,
        category: "security",
        severity: "warning",
        title: "Password reset requested",
        message: "A password reset request was initiated for your account.",
        actionUrl: "/login",
        metadata: {
          resetRequestId: record.id,
        },
      });

      if (env.nodeEnv !== "production") {
        return res.status(200).json({
          message: PASSWORD_RESET_GENERIC_MESSAGE,
          resetToken,
        });
      }
    }

    return res.status(200).json({ message: PASSWORD_RESET_GENERIC_MESSAGE });
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("forgot_password_infrastructure_error", error, {
        requestId: req.requestId,
        email,
      });
      return res.status(500).json({ message: "Password reset is temporarily unavailable. Please try again shortly." });
    }

    logAuthError("forgot_password_unexpected_error", error, {
      requestId: req.requestId,
      email,
    });
    return res.status(500).json({ message: "Unable to process password reset request right now." });
  }
};

export const resetPassword = async (req, res) => {
  const { token, password } = req.validated.body;

  try {
    const resetRecord = await passwordResetTokensRepository.findActiveByToken(token);
    if (!resetRecord) {
      return res.status(400).json({ message: "Password reset token is invalid or has expired." });
    }

    const user = await usersRepository.findById(resetRecord.userId);
    if (!user) {
      return res.status(400).json({ message: "Password reset token is invalid or has expired." });
    }

    const nextPasswordHash = await bcrypt.hash(password, 12);

    await usersRepository.updateById(user.id, {
      passwordHash: nextPasswordHash,
    });

    await passwordResetTokensRepository.consumeById(resetRecord.id);
    await sessionsRepository.revokeAllByUser(user.id);

    await auditLogsRepository.create({
      action: "password_reset_completed",
      actorId: user.id,
      actorRole: user.role,
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        resetRequestId: resetRecord.id,
      },
    });

    await notifyUser({
      userId: user.id,
      category: "security",
      severity: "success",
      title: "Password updated",
      message: "Your account password was reset successfully.",
      actionUrl: "/login",
      metadata: {
        resetRequestId: resetRecord.id,
      },
    });

    return res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("reset_password_infrastructure_error", error, {
        requestId: req.requestId,
      });
      return res.status(500).json({ message: "Password reset is temporarily unavailable. Please try again shortly." });
    }

    logAuthError("reset_password_unexpected_error", error, {
      requestId: req.requestId,
    });
    return res.status(500).json({ message: "Unable to reset password due to an unexpected server error." });
  }
};

export const changePassword = async (req, res) => {
  const user = req.user;
  const { currentPassword, newPassword, currentRefreshToken } = req.validated.body;

  try {
    const passwordValid = await verifyPassword(user, currentPassword);
    if (!passwordValid) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const samePassword = await verifyPassword(user, newPassword);
    if (samePassword) {
      return res.status(400).json({ message: "New password must be different from your current password." });
    }

    const nextPasswordHash = await bcrypt.hash(newPassword, 12);
    await usersRepository.updateById(user.id, {
      passwordHash: nextPasswordHash,
    });

    await sessionsRepository.revokeOthers({
      userId: user.id,
      currentRefreshToken: currentRefreshToken || null,
    });

    await auditLogsRepository.create({
      action: "password_changed",
      actorId: user.id,
      actorRole: user.role,
      resourceType: "user",
      resourceId: user.id,
      metadata: {},
    });

    await notifyUser({
      userId: user.id,
      category: "security",
      severity: "success",
      title: "Password changed",
      message: "Your account password was changed successfully.",
      actionUrl: "/profile",
      metadata: {},
    });

    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("change_password_infrastructure_error", error, {
        requestId: req.requestId,
        userId: user.id,
      });
      return res.status(500).json({ message: "Password update is temporarily unavailable. Please try again shortly." });
    }

    logAuthError("change_password_unexpected_error", error, {
      requestId: req.requestId,
      userId: user.id,
    });
    return res.status(500).json({ message: "Unable to change password due to an unexpected server error." });
  }
};

export const verifyTwoFactorLogin = async (req, res) => {
  const { loginToken, code } = req.validated.body;

  try {
    const decoded = verifyTwoFactorLoginToken(loginToken);
    const user = await usersRepository.findById(decoded.sub);

    if (!user) {
      return res.status(401).json({ message: "Login session is invalid. Please sign in again." });
    }

    if (user.status !== "active" || user.accountRestrictions?.frozen) {
      return res.status(403).json({ message: "Your account is restricted pending compliance review." });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(409).json({ message: "Two-factor authentication is not enabled on this account." });
    }

    const secret = decryptTotpSecret(user.twoFactorSecret);
    const normalizedCode = normalizeTotpInput(code);
    const totpValid = verifyTotpCode({ secret, code: normalizedCode });

    let backupCodeConsumed = false;
    if (!totpValid) {
      const currentHashes = parseTwoFactorBackupCodeHashes(user.twoFactorBackupCode);
      const backupCodeResult = await verifyAndConsumeTwoFactorBackupCode({
        code: normalizedCode,
        hashes: currentHashes,
      });

      if (backupCodeResult.matched) {
        backupCodeConsumed = true;
        await usersRepository.updateById(user.id, {
          twoFactorBackupCode: serializeTwoFactorBackupCodeHashes(backupCodeResult.remainingHashes),
        });

        await auditLogsRepository.create({
          action: "two_factor_recovery_code_used",
          actorId: user.id,
          actorRole: user.role,
          resourceType: "user",
          resourceId: user.id,
          metadata: {
            remainingRecoveryCodes: backupCodeResult.remainingHashes.length,
          },
        });
      }
    }

    if (!totpValid && !backupCodeConsumed) {
      logAuthInfo("login_two_factor_failed", {
        requestId: req.requestId,
        userId: user.id,
      });
      return res.status(401).json({ message: "Invalid two-factor or recovery code. Please try again." });
    }

    logAuthInfo("login_two_factor_success", {
      requestId: req.requestId,
      userId: user.id,
      backupCodeConsumed,
    });
    const sessionUser = backupCodeConsumed ? (await usersRepository.findById(user.id)) || user : user;
    await respondWithSession(res, sessionUser, req);
    return;
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("login_two_factor_infrastructure_error", error, {
        requestId: req.requestId,
      });
      return res.status(500).json({ message: "Authentication is temporarily unavailable. Please try again shortly." });
    }

    logAuthInfo("login_two_factor_token_invalid", {
      requestId: req.requestId,
      code: error?.code || null,
    });
    return res.status(401).json({ message: "Login session is invalid or expired. Please sign in again." });
  }
};

export const setupTwoFactor = async (req, res) => {
  const user = req.user;

  if (user.twoFactorEnabled) {
    return res.status(409).json({ message: "Two-factor authentication is already enabled." });
  }

  try {
    const setup = await generateTotpSetupMaterial({ email: user.email });
    const encryptedSecret = encryptTotpSecret(setup.secret);
    const challenge = await authFactorsRepository.createTotpSetupChallenge({
      userId: user.id,
      secretEncrypted: encryptedSecret,
      ttlMinutes: 10,
      maxAttempts: 5,
    });

    await auditLogsRepository.create({
      action: "two_factor_setup_initiated",
      actorId: user.id,
      actorRole: user.role,
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
      },
    });

    logAuthInfo("two_factor_setup_initiated", {
      requestId: req.requestId,
      userId: user.id,
      challengeId: challenge.id,
    });

    return res.status(200).json({
      message: "Scan the QR code and enter the authenticator code to enable two-factor authentication.",
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      otpauthUrl: setup.otpauthUrl,
      qrCodeDataUrl: setup.qrCodeDataUrl,
      manualEntryKey: setup.manualEntryKey,
    });
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("two_factor_setup_infrastructure_error", error, {
        requestId: req.requestId,
        userId: user.id,
      });
      return res.status(500).json({ message: "Unable to start two-factor setup right now. Please try again shortly." });
    }

    logAuthError("two_factor_setup_unexpected_error", error, {
      requestId: req.requestId,
      userId: user.id,
    });
    return res.status(500).json({ message: "Unable to start two-factor setup due to an unexpected server error." });
  }
};

export const verifyEnableTwoFactor = async (req, res) => {
  const user = req.user;
  const { challengeId, code } = req.validated.body;

  if (user.twoFactorEnabled) {
    return res.status(409).json({ message: "Two-factor authentication is already enabled." });
  }

  try {
    const challenge = await authFactorsRepository.findActiveTotpSetupChallengeById({
      userId: user.id,
      challengeId,
    });

    if (!challenge || !challenge.secretEncrypted) {
      return res.status(400).json({ message: "Two-factor setup session is invalid or has expired. Please start setup again." });
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      await authFactorsRepository.consumeChallenge(challenge.id);
      return res.status(401).json({ message: "Too many invalid two-factor attempts. Please restart setup." });
    }

    let secret;
    try {
      secret = decryptTotpSecret(challenge.secretEncrypted);
    } catch (error) {
      logAuthError("two_factor_verify_enable_decrypt_failed", error, {
        requestId: req.requestId,
        userId: user.id,
        challengeId: challenge.id,
      });
      return res.status(500).json({ message: "Two-factor setup could not be completed. Please restart setup." });
    }

    const valid = verifyTotpCode({ secret, code: normalizeTotpInput(code) });
    if (!valid) {
      await authFactorsRepository.incrementAttempts(challenge.id);
      const nextAttempts = challenge.attempts + 1;
      if (nextAttempts >= challenge.maxAttempts) {
        await authFactorsRepository.consumeChallenge(challenge.id);
      }

      logAuthInfo("two_factor_enable_failed", {
        requestId: req.requestId,
        userId: user.id,
        challengeId: challenge.id,
        attempts: nextAttempts,
      });
      return res.status(401).json({ message: "Invalid two-factor code. Please try again." });
    }

    const enabledAt = new Date().toISOString();
    const recovery = await createRecoveryCodes();
    const updated = await usersRepository.updateById(user.id, {
      twoFactorEnabled: true,
      twoFactorEnabledAt: enabledAt,
      twoFactorSecret: challenge.secretEncrypted,
      twoFactorBackupCode: recovery.serializedHashes,
    });

    await authFactorsRepository.consumeAllTotpSetupChallenges({ userId: user.id });

    await auditLogsRepository.create({
      action: "two_factor_enabled",
      actorId: user.id,
      actorRole: user.role,
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        challengeId: challenge.id,
        enabledAt,
      },
    });

    logAuthInfo("two_factor_enable_success", {
      requestId: req.requestId,
      userId: user.id,
    });

    await notifyUser({
      userId: user.id,
      category: "security",
      severity: "success",
      title: "Two-factor authentication enabled",
      message: "Authenticator-based two-factor authentication is now active on your account.",
      actionUrl: "/profile",
      metadata: {
        enabledAt,
      },
    });

    return res.status(200).json({
      message: "Two-factor authentication enabled successfully.",
      user: sanitizeUser(updated),
      recoveryCodes: recovery.codes,
    });
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("two_factor_verify_enable_infrastructure_error", error, {
        requestId: req.requestId,
        userId: user.id,
      });
      return res.status(500).json({ message: "Unable to enable two-factor authentication right now. Please try again shortly." });
    }

    logAuthError("two_factor_verify_enable_unexpected_error", error, {
      requestId: req.requestId,
      userId: user.id,
    });
    return res.status(500).json({ message: "Unable to enable two-factor authentication due to an unexpected server error." });
  }
};

export const disableTwoFactor = async (req, res) => {
  const user = req.user;
  const password = typeof req.validated.body.password === "string" ? req.validated.body.password : "";
  const code = typeof req.validated.body.code === "string" ? req.validated.body.code : "";

  if (!user.twoFactorEnabled) {
    return res.status(400).json({ message: "Two-factor authentication is not enabled on this account." });
  }

  try {
    let passwordValid = false;
    let codeValid = false;

    if (password) {
      passwordValid = await verifyPassword(user, password);
    }

    if (code && user.twoFactorSecret) {
      try {
        const secret = decryptTotpSecret(user.twoFactorSecret);
        codeValid = verifyTotpCode({ secret, code: normalizeTotpInput(code) });
      } catch (error) {
        logAuthError("two_factor_disable_decrypt_failed", error, {
          requestId: req.requestId,
          userId: user.id,
        });
      }
    }

    if (!passwordValid && !codeValid) {
      logAuthInfo("two_factor_disable_failed", {
        requestId: req.requestId,
        userId: user.id,
        passwordProvided: Boolean(password),
        codeProvided: Boolean(code),
      });
      return res.status(401).json({
        message: "Password or valid two-factor code is required to disable two-factor authentication.",
      });
    }

    const updated = await usersRepository.updateById(user.id, {
      twoFactorEnabled: false,
      twoFactorEnabledAt: null,
      twoFactorSecret: null,
      twoFactorBackupCode: null,
    });

    await auditLogsRepository.create({
      action: "two_factor_disabled",
      actorId: user.id,
      actorRole: user.role,
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        passwordValidated: passwordValid,
        codeValidated: codeValid,
      },
    });

    logAuthInfo("two_factor_disable_success", {
      requestId: req.requestId,
      userId: user.id,
    });

    await notifyUser({
      userId: user.id,
      category: "security",
      severity: "warning",
      title: "Two-factor authentication disabled",
      message: "Two-factor authentication has been turned off. Re-enable it to protect withdrawals and sign-ins.",
      actionUrl: "/profile",
      metadata: {
        passwordValidated: passwordValid,
        codeValidated: codeValid,
      },
    });

    return res.status(200).json({
      message: "Two-factor authentication has been disabled.",
      user: sanitizeUser(updated),
    });
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("two_factor_disable_infrastructure_error", error, {
        requestId: req.requestId,
        userId: user.id,
      });
      return res.status(500).json({ message: "Unable to disable two-factor authentication right now. Please try again shortly." });
    }

    logAuthError("two_factor_disable_unexpected_error", error, {
      requestId: req.requestId,
      userId: user.id,
    });
    return res.status(500).json({ message: "Unable to disable two-factor authentication due to an unexpected server error." });
  }
};

export const regenerateTwoFactorBackupCodes = async (req, res) => {
  const user = req.user;
  const password = typeof req.validated.body.password === "string" ? req.validated.body.password : "";
  const code = typeof req.validated.body.code === "string" ? req.validated.body.code : "";

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return res.status(400).json({ message: "Two-factor authentication is not enabled on this account." });
  }

  try {
    let passwordValid = false;
    let codeValid = false;

    if (password) {
      passwordValid = await verifyPassword(user, password);
    }

    if (code) {
      const secret = decryptTotpSecret(user.twoFactorSecret);
      codeValid = verifyTotpCode({ secret, code: normalizeTotpInput(code) });
    }

    if (!passwordValid && !codeValid) {
      return res.status(401).json({
        message: "Password or valid two-factor code is required to regenerate backup codes.",
      });
    }

    const recovery = await createRecoveryCodes();
    const updated = await usersRepository.updateById(user.id, {
      twoFactorBackupCode: recovery.serializedHashes,
    });

    await auditLogsRepository.create({
      action: "two_factor_backup_codes_regenerated",
      actorId: user.id,
      actorRole: user.role,
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        passwordValidated: passwordValid,
        codeValidated: codeValid,
      },
    });

    await notifyUser({
      userId: user.id,
      category: "security",
      severity: "warning",
      title: "2FA recovery codes regenerated",
      message: "Your previous backup codes are no longer valid. Store the new set securely.",
      actionUrl: "/profile",
      metadata: {},
    });

    return res.status(200).json({
      message: "Two-factor recovery codes regenerated successfully.",
      recoveryCodes: recovery.codes,
      user: sanitizeUser(updated),
    });
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("two_factor_backup_regenerate_infrastructure_error", error, {
        requestId: req.requestId,
        userId: user.id,
      });
      return res.status(500).json({ message: "Unable to regenerate backup codes right now. Please try again shortly." });
    }

    logAuthError("two_factor_backup_regenerate_unexpected_error", error, {
      requestId: req.requestId,
      userId: user.id,
    });
    return res.status(500).json({ message: "Unable to regenerate backup codes due to an unexpected server error." });
  }
};

export const logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await sessionsRepository.revokeByToken(refreshToken);
  }

  return res.json({ message: "Logged out successfully." });
};

export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required." });
    }

    const stored = await sessionsRepository.findByToken(refreshToken);

    if (!stored || stored.revokedAt) {
      return res.status(401).json({ message: "Refresh token not recognized." });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await usersRepository.findById(decoded.sub);

    if (!user) {
      return res.status(401).json({ message: "User not found for this refresh token." });
    }

    return res.json({
      accessToken: signAccessToken(user),
    });
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      console.error("Refresh failed due to database/infrastructure issue", error);
      return res.status(503).json({ message: "Session refresh is temporarily unavailable. Please try again shortly." });
    }

    return res.status(401).json({ message: "Refresh token expired or invalid." });
  }
};

export const sendVerification = async (req, res) => {
  try {
    const user = req.user;
    const { channel } = req.validated.body;
    const result = await sendContactVerificationOtp({ user, channel });

    return res.json({
      message: `${channel === "email" ? "Email" : "Phone"} verification code sent.`,
      ...result,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to send verification code." });
  }
};

export const verifyContact = async (req, res) => {
  try {
    const user = req.user;
    const { channel, code } = req.validated.body;
    const updated = await verifyContactOtp({ user, channel, code });

    return res.json({
      message: `${channel === "email" ? "Email" : "Phone"} verification complete.`,
      user: sanitizeUser(updated || (await usersRepository.findById(user.id))),
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to verify contact code." });
  }
};

export const firebaseSession = async (req, res) => {
  try {
    const {
      idToken,
      countryCode,
      termsAccepted = false,
      privacyAccepted = false,
    } = req.validated.body;

    const decoded = await verifyFirebaseIdToken(idToken);
    const { firebaseUid, firebaseEmail, firebaseEmailVerified, firebaseProvider } =
      resolveVerifiedFirebaseIdentity(decoded);

    if (!firebaseUid || !firebaseEmail) {
      return res.status(401).json({ message: "Firebase session is invalid or missing required claims." });
    }

    if (!firebaseEmailVerified) {
      return res.status(403).json({
        message: "Email verification is required before continuing. Please verify your email and try again.",
      });
    }

    const { user } = await findOrCreateFirebaseUser({
      email: firebaseEmail,
      fullName: decoded.name,
      countryCode,
      emailVerified: firebaseEmailVerified,
      termsAccepted,
      privacyAccepted,
      provider: firebaseProvider,
      firebaseUid,
    });

    if (user.status !== "active" || user.accountRestrictions?.frozen) {
      return res.status(403).json({
        message: "Your account is restricted pending compliance review.",
      });
    }

    if (user.twoFactorEnabled) {
      if (!user.twoFactorSecret) {
        logAuthError("firebase_session_two_factor_misconfigured", new Error("two_factor_secret_missing"), {
          requestId: req.requestId,
          userId: user.id,
        });
        return res.status(500).json({ message: "Two-factor authentication is currently unavailable for this account." });
      }

      return res.status(200).json(createTwoFactorChallengeResponse(user, req));
    }

    await respondWithSession(res, user, req);
    return;
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      logAuthError("firebase_session_infrastructure_error", error, {
        requestId: req.requestId,
      });
      return res.status(500).json({ message: "Authentication is temporarily unavailable. Please try again shortly." });
    }

    if (isFirebaseTokenIssue(error)) {
      return res.status(401).json({ message: "Firebase session is invalid or expired. Please sign in again." });
    }

    return res.status(400).json({
      message: knownMessageOrFallback(error, "Unable to sign in with Firebase right now."),
    });
  }
};

export const getSessionHistory = async (req, res) => {
  const sessions = await sessionsRepository.listActiveByUser(req.user.id);

  return res.json({
    items: sessions.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      userAgent: item.userAgent,
      ipAddress: item.ipAddress,
    })),
  });
};

export const revokeSession = async (req, res) => {
  const revoked = await sessionsRepository.revokeByIdForUser({
    sessionId: req.validated.body.sessionId,
    userId: req.user.id,
  });

  if (!revoked) {
    return res.status(404).json({ message: "Session not found." });
  }

  await auditLogsRepository.create({
    action: "auth_session_revoked",
    actorId: req.user.id,
    actorRole: req.user.role,
    resourceType: "session",
    resourceId: revoked.id,
    metadata: {},
  });

  return res.json({ message: "Session revoked successfully." });
};

export const revokeOtherSessions = async (req, res) => {
  const currentRefreshToken = req.validated?.body?.currentRefreshToken || null;

  await sessionsRepository.revokeOthers({
    userId: req.user.id,
    currentRefreshToken,
  });

  await auditLogsRepository.create({
    action: "auth_sessions_revoked_others",
    actorId: req.user.id,
    actorRole: req.user.role,
    resourceType: "session",
    resourceId: req.user.id,
    metadata: {
      preservedCurrentSession: Boolean(currentRefreshToken),
    },
  });

  await notifyUser({
    userId: req.user.id,
    category: "security",
    severity: "warning",
    title: "Other sessions signed out",
    message: "All other active sessions were revoked from your account.",
    actionUrl: "/profile",
    metadata: {
      preservedCurrentSession: Boolean(currentRefreshToken),
    },
  });

  return res.json({ message: "Other sessions revoked successfully." });
};
