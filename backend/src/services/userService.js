import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
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
  authProvider: user.authProvider || "local",
  phone: user.phone,
  fullName: user.fullName,
  countryCode: user.countryCode,
  antiPhishingCode: user.antiPhishingCode,
  twoFactorEnabled: user.twoFactorEnabled,
  emailVerified: user.emailVerified,
  emailVerifiedAt: user.emailVerifiedAt,
  phoneVerified: user.phoneVerified,
  phoneVerifiedAt: user.phoneVerifiedAt,
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
        firebaseUid: null,
        authProvider: "local",
        fullName,
        countryCode: countryCode || "US",
        antiPhishingCode: "",
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCode: null,
        emailVerified: false,
        emailVerifiedAt: null,
        phoneVerified: false,
        phoneVerifiedAt: null,
        kycStatus: "unverified",
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

const normalizeCountryCode = (countryCode) => {
  const normalized = String(countryCode || "US").toUpperCase().trim();
  return normalized.length === 2 ? normalized : "US";
};

const generateFederatedPasswordHash = async () => {
  const randomSecret = randomBytes(32).toString("hex");
  return bcrypt.hash(randomSecret, 12);
};

const normalizeAuthProvider = (provider) => {
  const normalized = String(provider || "firebase").trim().toLowerCase();
  if (normalized === "google.com" || normalized === "google") {
    return "google";
  }

  if (normalized === "password" || normalized === "email") {
    return "email";
  }

  if (normalized === "firebase" || normalized === "custom") {
    return "firebase";
  }

  return "firebase";
};

const acquireFirebaseIdentityLocks = async (db, normalizedEmail, normalizedFirebaseUid) => {
  const lockKeys = [`firebase-email:${normalizedEmail}`, `firebase-uid:${normalizedFirebaseUid}`].sort();

  for (const key of lockKeys) {
    await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [key]);
  }
};

export const findOrCreateFirebaseUser = async ({
  email,
  fullName,
  countryCode,
  emailVerified = false,
  termsAccepted = false,
  privacyAccepted = false,
  provider = "firebase",
  firebaseUid = "",
}) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedFirebaseUid = String(firebaseUid || "").trim();
  const now = nowIso();

  if (!normalizedFirebaseUid) {
    throw new Error("Firebase account is missing a valid UID.");
  }

  if (!normalizedEmail) {
    throw new Error("Firebase account is missing a verified email address.");
  }

  const resolvedAuthProvider = normalizeAuthProvider(provider);

  try {
    return await withTransaction(async (db) => {
      await acquireFirebaseIdentityLocks(db, normalizedEmail, normalizedFirebaseUid);

      const existingByUid = await usersRepository.findByFirebaseUid(normalizedFirebaseUid, db);
      if (existingByUid) {
        const existingEmail = String(existingByUid.email || "").trim().toLowerCase();
        if (existingEmail && existingEmail !== normalizedEmail) {
          throw new Error("Firebase identity email does not match the linked account.");
        }

        const patch = {};
        if (existingByUid.authProvider !== resolvedAuthProvider) {
          patch.authProvider = resolvedAuthProvider;
        }
        if (emailVerified && !existingByUid.emailVerified) {
          patch.emailVerified = true;
          patch.emailVerifiedAt = now;
        }
        if (termsAccepted && !existingByUid.termsAcceptedAt) {
          patch.termsAcceptedAt = now;
        }
        if (privacyAccepted && !existingByUid.privacyAcceptedAt) {
          patch.privacyAcceptedAt = now;
        }

        if (Object.keys(patch).length === 0) {
          return {
            user: existingByUid,
            created: false,
          };
        }

        const updated = await usersRepository.updateById(existingByUid.id, patch, db);
        return {
          user: updated,
          created: false,
        };
      }

      const existingByEmail = await usersRepository.findByEmailForUpdate(normalizedEmail, db);
      if (existingByEmail) {
        if (existingByEmail.firebaseUid && existingByEmail.firebaseUid !== normalizedFirebaseUid) {
          throw new Error("This email is already linked to another Firebase account.");
        }

        const patch = {
          firebaseUid: normalizedFirebaseUid,
          authProvider: resolvedAuthProvider,
          emailVerified: emailVerified ? true : existingByEmail.emailVerified,
          emailVerifiedAt:
            emailVerified && !existingByEmail.emailVerified
              ? now
              : existingByEmail.emailVerifiedAt || null,
        };

        if (termsAccepted && !existingByEmail.termsAcceptedAt) {
          patch.termsAcceptedAt = now;
        }
        if (privacyAccepted && !existingByEmail.privacyAcceptedAt) {
          patch.privacyAcceptedAt = now;
        }

        const linked = await usersRepository.updateById(existingByEmail.id, patch, db);

        return {
          user: linked,
          created: false,
        };
      }

      if (!termsAccepted || !privacyAccepted) {
        throw new Error("Terms and privacy consent are required to create an account.");
      }

      const generatedPasswordHash = await generateFederatedPasswordHash();
      const resolvedFullName = fullName?.trim() || normalizedEmail.split("@")[0] || "User";
      const resolvedCountryCode = normalizeCountryCode(countryCode);

      const createdUser = await usersRepository.create(
        {
          role: "user",
          status: "active",
          email: normalizedEmail,
          phone: null,
          passwordHash: generatedPasswordHash,
          firebaseUid: normalizedFirebaseUid,
          authProvider: resolvedAuthProvider,
          fullName: resolvedFullName,
          countryCode: resolvedCountryCode,
          antiPhishingCode: "",
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCode: null,
          emailVerified: emailVerified ? true : false,
          emailVerifiedAt: emailVerified ? now : null,
          phoneVerified: false,
          phoneVerifiedAt: null,
          kycStatus: "unverified",
          kycTier: "none",
          sanctionsStatus: "pending",
          riskScore: 0,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
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
          userId: createdUser.id,
          walletType: "funding",
          asset: "USDT",
        },
        db,
      );

      await walletsRepository.create(
        {
          userId: createdUser.id,
          walletType: "spot",
          asset: "USDT",
        },
        db,
      );

      await auditLogsRepository.create(
        {
          action: "user_registered_firebase",
          actorId: createdUser.id,
          actorRole: createdUser.role,
          resourceType: "user",
          resourceId: createdUser.id,
          metadata: {
            provider: resolvedAuthProvider,
            firebaseUid: normalizedFirebaseUid,
            emailVerified: emailVerified ? true : false,
          },
        },
        db,
      );

      return {
        user: createdUser,
        created: true,
      };
    });
  } catch (error) {
    if (error?.code === "23505") {
      const conflictByUid = await usersRepository.findByFirebaseUid(normalizedFirebaseUid);
      if (conflictByUid) {
        return { user: conflictByUid, created: false };
      }

      const conflictByEmail = await usersRepository.findByEmail(normalizedEmail);
      if (conflictByEmail) {
        return { user: conflictByEmail, created: false };
      }
    }

    throw error;
  }
};
