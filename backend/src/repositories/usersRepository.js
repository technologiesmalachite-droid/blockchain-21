import { query } from "../db/pool.js";
import { asJson, parseRestrictions, toCamelObject, toCamelRows } from "./helpers.js";

const baseUserSelect = `
  SELECT
    u.id,
    u.role,
    u.status,
    u.email,
    u.phone,
    u.password_hash,
    u.firebase_uid,
    u.auth_provider,
    u.full_name,
    u.country_code,
    u.anti_phishing_code,
    u.two_factor_enabled,
    u.two_factor_enabled_at,
    u.two_factor_secret,
    u.two_factor_backup_code,
    u.email_verified,
    u.email_verified_at,
    u.phone_verified,
    u.phone_verified_at,
    u.kyc_status,
    u.kyc_tier,
    u.sanctions_status,
    u.risk_score,
    u.terms_accepted_at,
    u.privacy_accepted_at,
    u.created_at,
    u.updated_at,
    ar.frozen,
    ar.withdrawals_locked,
    ar.trading_locked,
    ar.reason AS restrictions_reason,
    ar.metadata AS restrictions_metadata,
    ar.updated_at AS restrictions_updated_at
  FROM users u
  LEFT JOIN account_restrictions ar ON ar.user_id = u.id
`;

const mapUserRow = (row) => {
  if (!row) {
    return null;
  }

  const user = toCamelObject(row);

  return {
    id: user.id,
    role: user.role,
    status: user.status,
    email: user.email,
    phone: user.phone,
    passwordHash: user.passwordHash,
    firebaseUid: user.firebaseUid,
    authProvider: user.authProvider,
    fullName: user.fullName,
    countryCode: user.countryCode,
    antiPhishingCode: user.antiPhishingCode,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorEnabledAt: user.twoFactorEnabledAt,
    twoFactorSecret: user.twoFactorSecret,
    twoFactorBackupCode: user.twoFactorBackupCode,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerified: user.phoneVerified,
    phoneVerifiedAt: user.phoneVerifiedAt,
    kycStatus: user.kycStatus,
    kycTier: user.kycTier,
    sanctionsStatus: user.sanctionsStatus,
    riskScore: Number(user.riskScore || 0),
    termsAcceptedAt: user.termsAcceptedAt,
    privacyAcceptedAt: user.privacyAcceptedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accountRestrictions: {
      frozen: Boolean(row.frozen),
      withdrawalsLocked: Boolean(row.withdrawals_locked),
      tradingLocked: Boolean(row.trading_locked),
      reason: row.restrictions_reason || null,
      metadata: row.restrictions_metadata || {},
      updatedAt: row.restrictions_updated_at || null,
    },
  };
};

export const usersRepository = {
  async findByEmail(email, db = { query }) {
    const { rows } = await db.query(`${baseUserSelect} WHERE u.email = $1 LIMIT 1`, [email]);
    return mapUserRow(rows[0]);
  },

  async findByEmailForUpdate(email, db = { query }) {
    const { rows } = await db.query(`SELECT id FROM users WHERE email = $1 LIMIT 1 FOR UPDATE`, [email]);

    if (!rows[0]?.id) {
      return null;
    }

    return this.findById(rows[0].id, db);
  },

  async findByFirebaseUid(firebaseUid, db = { query }) {
    const { rows } = await db.query(`${baseUserSelect} WHERE u.firebase_uid = $1 LIMIT 1`, [firebaseUid]);
    return mapUserRow(rows[0]);
  },

  async findById(id, db = { query }) {
    const { rows } = await db.query(`${baseUserSelect} WHERE u.id = $1 LIMIT 1`, [id]);
    return mapUserRow(rows[0]);
  },

  async create(user, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO users (
        role, status, email, phone, password_hash, firebase_uid, auth_provider, full_name, country_code,
        anti_phishing_code, two_factor_enabled, two_factor_enabled_at, two_factor_secret, two_factor_backup_code,
        email_verified, email_verified_at, phone_verified, phone_verified_at, kyc_status, kyc_tier, sanctions_status, risk_score,
        terms_accepted_at, privacy_accepted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24
      ) RETURNING id`,
      [
        user.role,
        user.status,
        user.email,
        user.phone,
        user.passwordHash,
        user.firebaseUid || null,
        user.authProvider || "local",
        user.fullName,
        user.countryCode,
        user.antiPhishingCode,
        user.twoFactorEnabled,
        user.twoFactorEnabledAt || null,
        user.twoFactorSecret,
        user.twoFactorBackupCode,
        user.emailVerified,
        user.emailVerifiedAt || null,
        user.phoneVerified,
        user.phoneVerifiedAt || null,
        user.kycStatus,
        user.kycTier,
        user.sanctionsStatus,
        user.riskScore,
        user.termsAcceptedAt,
        user.privacyAcceptedAt,
      ],
    );

    const userId = rows[0].id;

    await db.query(
      `INSERT INTO account_restrictions (
        user_id, frozen, withdrawals_locked, trading_locked, reason, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (user_id) DO UPDATE SET
        frozen = EXCLUDED.frozen,
        withdrawals_locked = EXCLUDED.withdrawals_locked,
        trading_locked = EXCLUDED.trading_locked,
        reason = EXCLUDED.reason,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()`,
      [
        userId,
        user.accountRestrictions?.frozen ?? false,
        user.accountRestrictions?.withdrawalsLocked ?? false,
        user.accountRestrictions?.tradingLocked ?? false,
        user.accountRestrictions?.reason || null,
        asJson(user.accountRestrictions?.metadata || {}),
      ],
    );

    return this.findById(userId, db);
  },

  async updateById(userId, patch, db = { query }) {
    const fieldMap = {
      role: "role",
      status: "status",
      email: "email",
      phone: "phone",
      fullName: "full_name",
      firebaseUid: "firebase_uid",
      authProvider: "auth_provider",
      countryCode: "country_code",
      antiPhishingCode: "anti_phishing_code",
      twoFactorEnabled: "two_factor_enabled",
      twoFactorEnabledAt: "two_factor_enabled_at",
      twoFactorSecret: "two_factor_secret",
      twoFactorBackupCode: "two_factor_backup_code",
      emailVerified: "email_verified",
      emailVerifiedAt: "email_verified_at",
      phoneVerified: "phone_verified",
      phoneVerifiedAt: "phone_verified_at",
      kycStatus: "kyc_status",
      kycTier: "kyc_tier",
      sanctionsStatus: "sanctions_status",
      riskScore: "risk_score",
      termsAcceptedAt: "terms_accepted_at",
      privacyAcceptedAt: "privacy_accepted_at",
      passwordHash: "password_hash",
    };

    const updates = [];
    const values = [];
    let index = 1;

    for (const [key, column] of Object.entries(fieldMap)) {
      if (patch[key] === undefined) {
        continue;
      }
      updates.push(`${column} = $${index}`);
      values.push(patch[key]);
      index += 1;
    }

    if (updates.length) {
      values.push(userId);
      await db.query(
        `UPDATE users
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = $${index}`,
        values,
      );
    }

    if (patch.accountRestrictions) {
      await db.query(
        `INSERT INTO account_restrictions (
          user_id, frozen, withdrawals_locked, trading_locked, reason, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET
          frozen = EXCLUDED.frozen,
          withdrawals_locked = EXCLUDED.withdrawals_locked,
          trading_locked = EXCLUDED.trading_locked,
          reason = EXCLUDED.reason,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()`,
        [
          userId,
          patch.accountRestrictions.frozen ?? false,
          patch.accountRestrictions.withdrawalsLocked ?? false,
          patch.accountRestrictions.tradingLocked ?? false,
          patch.accountRestrictions.reason || null,
          asJson(patch.accountRestrictions.metadata || {}),
        ],
      );
    }

    return this.findById(userId, db);
  },

  async listAll(db = { query }) {
    const { rows } = await db.query(`${baseUserSelect} ORDER BY u.created_at DESC`);
    return rows.map(mapUserRow);
  },

  async countAll(db = { query }) {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS count FROM users`);
    return rows[0]?.count || 0;
  },

  async averageRiskScore(db = { query }) {
    const { rows } = await db.query(`SELECT COALESCE(ROUND(AVG(risk_score))::int, 0) AS avg FROM users`);
    return rows[0]?.avg || 0;
  },
};

export const accountRestrictionsRepository = {
  async findByUserId(userId, db = { query }) {
    const { rows } = await db.query(`SELECT * FROM account_restrictions WHERE user_id = $1 LIMIT 1`, [userId]);
    return rows[0] ? parseRestrictions(rows[0]) : null;
  },

  async upsert({ userId, frozen, withdrawalsLocked, tradingLocked, reason, metadata = {} }, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO account_restrictions (
        user_id, frozen, withdrawals_locked, trading_locked, reason, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (user_id) DO UPDATE SET
        frozen = EXCLUDED.frozen,
        withdrawals_locked = EXCLUDED.withdrawals_locked,
        trading_locked = EXCLUDED.trading_locked,
        reason = EXCLUDED.reason,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [userId, frozen, withdrawalsLocked, tradingLocked, reason || null, asJson(metadata)],
    );

    return parseRestrictions(rows[0]);
  },
};
