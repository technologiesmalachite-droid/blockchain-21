import { v4 as uuid } from "uuid";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { sessionsRepository } from "../repositories/sessionsRepository.js";
import { usersRepository } from "../repositories/usersRepository.js";
import { authenticateUser, createUser, findOrCreateFirebaseUser, sanitizeUser } from "../services/userService.js";
import { verifyFirebaseIdToken } from "../services/firebaseAdminService.js";
import { sendContactVerificationOtp, verifyContactOtp } from "../services/kycService.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.js";

const refreshTokenExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const knownAuthMessages = new Set([
  "An account with this email already exists.",
  "Terms and privacy consent are required to create an account.",
  "Firebase account is missing a verified email address.",
  "Firebase account is missing a valid UID.",
  "Firebase identity email does not match the linked account.",
  "This email is already linked to another Firebase account.",
  "Invalid credentials.",
  "Your account is restricted. Please contact support.",
  "This account is frozen pending compliance review.",
  "Two-factor verification is required.",
]);

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
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await sessionsRepository.create({
    userId: user.id,
    token: refreshToken,
    userAgent: req.headers["user-agent"] || "unknown",
    ipAddress: req.ip || req.socket?.remoteAddress || "unknown",
    expiresAt: refreshTokenExpiry(),
  });

  return res.json({
    user: sanitizeUser(user),
    tokens: { accessToken, refreshToken },
  });
};

export const register = async (req, res) => {
  try {
    const user = await createUser(req.validated.body);

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

    return respondWithSession(res.status(201), user, req);
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "An account with this email or phone already exists." });
    }

    if (isInfrastructureIssue(error)) {
      console.error("Register failed due to database/infrastructure issue", error);
      return res.status(503).json({ message: "Registration is temporarily unavailable. Please try again shortly." });
    }

    return res.status(400).json({
      message: knownMessageOrFallback(error, "Unable to create your account. Please review your details and try again."),
    });
  }
};

export const login = async (req, res) => {
  try {
    const user = await authenticateUser(req.validated.body);
    return respondWithSession(res, user, req);
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      console.error("Login failed due to database/infrastructure issue", error);
      return res.status(503).json({ message: "Authentication is temporarily unavailable. Please try again shortly." });
    }

    return res.status(401).json({
      message: knownMessageOrFallback(error, "Invalid credentials or missing two-factor verification."),
    });
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

export const setupTwoFactor = async (req, res) => {
  const user = req.user;
  const { enable, backupCode } = req.validated.body;

  if (enable && !backupCode) {
    return res.status(400).json({ message: "Backup code is required to enable two-factor authentication." });
  }

  const secret = enable ? `TOTP-${uuid().slice(0, 12)}` : null;

  const updated = await usersRepository.updateById(user.id, {
    twoFactorEnabled: enable,
    twoFactorBackupCode: enable ? backupCode : null,
    twoFactorSecret: secret,
  });

  await auditLogsRepository.create({
    action: "two_factor_updated",
    actorId: user.id,
    actorRole: user.role,
    resourceType: "user",
    resourceId: user.id,
    metadata: {
      enabled: updated.twoFactorEnabled,
    },
  });

  return res.json({
    message: `Two-factor authentication ${enable ? "enabled" : "disabled"}.`,
    user: sanitizeUser(updated),
    secret: updated.twoFactorSecret,
  });
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

    return respondWithSession(res, user, req);
  } catch (error) {
    if (isInfrastructureIssue(error)) {
      console.error("Firebase session exchange failed due infrastructure/config issue", error);
      return res.status(503).json({ message: "Authentication is temporarily unavailable. Please try again shortly." });
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
