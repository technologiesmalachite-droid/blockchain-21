import { query } from "../../src/db/pool.js";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

const randomSuffix = () => `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;

export const createUserSeed = (overrides = {}) => {
  const suffix = randomSuffix();

  return {
    role: "user",
    status: "active",
    email: `repo_${suffix}@example.com`,
    phone: `+1${String(Number(suffix) % 1_000_000_0000).padStart(10, "0")}`,
    passwordHash: "repository_test_password_hash",
    fullName: "Repository Test User",
    countryCode: "US",
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
    termsAcceptedAt: new Date().toISOString(),
    privacyAcceptedAt: new Date().toISOString(),
    accountRestrictions: {
      frozen: false,
      withdrawalsLocked: false,
      tradingLocked: false,
      reason: null,
      metadata: {},
    },
    ...overrides,
  };
};

export const deleteUserCascade = async (userId) => {
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
};
