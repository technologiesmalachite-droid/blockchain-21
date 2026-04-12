import { v4 as uuid } from "uuid";
import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { authFactorsRepository } from "../repositories/authFactorsRepository.js";
import { sessionsRepository } from "../repositories/sessionsRepository.js";
import { usersRepository } from "../repositories/usersRepository.js";
import { authenticateUser, createUser, sanitizeUser } from "../services/userService.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.js";

const refreshTokenExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const generateVerificationCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const knownAuthMessages = new Set([
  "An account with this email already exists.",
  "Terms and privacy consent are required to create an account.",
  "Invalid credentials.",
  "Your account is restricted. Please contact support.",
  "This account is frozen pending compliance review.",
  "Two-factor verification is required.",
]);

const isDatabaseIssue = (error) => {
  if (!error) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const networkCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE"]);
  const dbCodes = /^(08|53|57|3D|XX)/;
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  return (
    networkCodes.has(code) ||
    dbCodes.test(code) ||
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("connect") ||
    message.includes("timeout")
  );
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

    const emailCode = generateVerificationCode();
    const phoneCode = generateVerificationCode();

    const [emailChallenge, phoneChallenge] = await Promise.all([
      authFactorsRepository.createVerificationChallenge({
        userId: user.id,
        channel: "email",
        destination: user.email,
        code: emailCode,
      }),
      authFactorsRepository.createVerificationChallenge({
        userId: user.id,
        channel: "phone",
        destination: user.phone,
        code: phoneCode,
      }),
    ]);

    await auditLogsRepository.create({
      action: "verification_challenges_created",
      actorId: user.id,
      actorRole: user.role,
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        emailChallengeId: emailChallenge.id,
        phoneChallengeId: phoneChallenge.id,
      },
    });

    return respondWithSession(res.status(201), user, req);
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "An account with this email or phone already exists." });
    }

    if (isDatabaseIssue(error)) {
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
    if (isDatabaseIssue(error)) {
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
    if (isDatabaseIssue(error)) {
      console.error("Refresh failed due to database/infrastructure issue", error);
      return res.status(503).json({ message: "Session refresh is temporarily unavailable. Please try again shortly." });
    }

    return res.status(401).json({ message: "Refresh token expired or invalid." });
  }
};

export const sendVerification = async (req, res) => {
  const user = req.user;
  const { channel } = req.validated.body;
  const code = generateVerificationCode();

  const challenge = await authFactorsRepository.createVerificationChallenge({
    userId: user.id,
    channel,
    destination: channel === "email" ? user.email : user.phone,
    code,
  });

  await auditLogsRepository.create({
    action: "verification_code_sent",
    actorId: user.id,
    actorRole: user.role,
    resourceType: "verification",
    resourceId: challenge.id,
    metadata: {
      channel,
      destination: challenge.destination,
    },
  });

  return res.json({
    message: `${channel === "email" ? "Email" : "Phone"} verification code sent.`,
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    testCode: code,
  });
};

export const verifyContact = async (req, res) => {
  const user = req.user;
  const { channel, code } = req.validated.body;

  const challenge = await authFactorsRepository.findLatestActiveChallenge({
    userId: user.id,
    channel,
  });

  if (!challenge) {
    return res.status(400).json({ message: "No verification challenge found. Please request a new code." });
  }

  if (challenge.expiresAt && new Date(challenge.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ message: "Verification code expired. Please request a new code." });
  }

  await authFactorsRepository.incrementAttempts(challenge.id);

  const matches = await authFactorsRepository.verifyChallengeCode(challenge, code);

  if (!matches) {
    return res.status(400).json({ message: "Verification code is incorrect." });
  }

  await withTransaction(async (db) => {
    await authFactorsRepository.consumeChallenge(challenge.id, db);

    await usersRepository.updateById(
      user.id,
      channel === "email" ? { emailVerified: true } : { phoneVerified: true },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "contact_verified",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "user",
        resourceId: user.id,
        metadata: {
          channel,
        },
      },
      db,
    );
  });

  const updated = await usersRepository.findById(user.id);

  return res.json({
    message: `${channel === "email" ? "Email" : "Phone"} verification complete.`,
    user: sanitizeUser(updated),
  });
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
