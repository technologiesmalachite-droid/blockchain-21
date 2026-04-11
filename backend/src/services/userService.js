import bcrypt from "bcryptjs";
import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { usersRepository } from "../repositories/usersRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";

const nowIso = () => new Date().toISOString();

export const sanitizeUser = (user) => ({
  id: user.id,
  role: user.role,
  status: user.status,
  email: user.email,
  phone: user.phone,
  fullName: user.fullName,
  countryCode: user.countryCode,
  antiPhishingCode: user.antiPhishingCode,
  twoFactorEnabled: user.twoFactorEnabled,
  emailVerified: user.emailVerified,
  phoneVerified: user.phoneVerified,
  kycStatus: user.kycStatus,
  kycTier: user.kycTier,
  sanctionsStatus: user.sanctionsStatus,
  riskScore: user.riskScore,
  accountRestrictions: user.accountRestrictions,
  termsAcceptedAt: user.termsAcceptedAt,
  privacyAcceptedAt: user.privacyAcceptedAt,
  createdAt: user.createdAt,
});

export const findUserByEmail = (email) => usersRepository.findByEmail(email);

export const createUser = async ({
  email,
  password,
  phone,
  fullName,
  countryCode,
  termsAccepted,
  privacyAccepted,
}) => {
  const existing = await usersRepository.findByEmail(email);

  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  if (!termsAccepted || !privacyAccepted) {
    throw new Error("Terms and privacy consent are required to create an account.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return withTransaction(async (db) => {
    const user = await usersRepository.create(
      {
        role: "user",
        status: "active",
        email,
        phone: phone || "",
        passwordHash,
        fullName,
        countryCode: countryCode || "US",
        antiPhishingCode: "",
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCode: null,
        emailVerified: false,
        phoneVerified: false,
        kycStatus: "pending",
        kycTier: "none",
        sanctionsStatus: "pending",
        riskScore: 0,
        termsAcceptedAt: nowIso(),
        privacyAcceptedAt: nowIso(),
        accountRestrictions: {
          frozen: false,
          withdrawalsLocked: false,
          tradingLocked: false,
          reason: null,
          metadata: {},
        },
      },
      db,
    );

    await walletsRepository.create(
      {
        userId: user.id,
        walletType: "funding",
        asset: "USDT",
      },
      db,
    );

    await walletsRepository.create(
      {
        userId: user.id,
        walletType: "spot",
        asset: "USDT",
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "user_registered",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "user",
        resourceId: user.id,
        metadata: {
          countryCode: user.countryCode,
          emailVerified: false,
          phoneVerified: false,
        },
      },
      db,
    );

    return user;
  });
};

export const authenticateUser = async ({ email, password, twoFactorCode }) => {
  const user = await usersRepository.findByEmail(email);

  if (!user) {
    throw new Error("Invalid credentials.");
  }

  if (user.status !== "active") {
    throw new Error("Your account is restricted. Please contact support.");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    throw new Error("Invalid credentials.");
  }

  if (user.accountRestrictions?.frozen) {
    throw new Error("This account is frozen pending compliance review.");
  }

  if (user.twoFactorEnabled) {
    if (!twoFactorCode || twoFactorCode !== user.twoFactorBackupCode) {
      throw new Error("Two-factor verification is required.");
    }
  }

  return user;
};

export const verifyPassword = async (user, password) => bcrypt.compare(password, user.passwordHash);
