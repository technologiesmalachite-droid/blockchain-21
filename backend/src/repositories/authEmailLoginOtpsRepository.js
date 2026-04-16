import { query } from "../db/pool.js";
import { toCamelRows } from "./helpers.js";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export const authEmailLoginOtpsRepository = {
  async upsert({ email, otpHash, expiresAt, maxAttempts = 5, lastSentAt }, db = { query }) {
    const normalizedEmail = normalizeEmail(email);
    const { rows } = await db.query(
      `INSERT INTO auth_email_login_otps (
        email, otp_hash, expires_at, attempts, max_attempts, last_sent_at
      ) VALUES ($1, $2, $3, 0, $4, $5)
      ON CONFLICT ((LOWER(email)))
      DO UPDATE SET
        otp_hash = EXCLUDED.otp_hash,
        expires_at = EXCLUDED.expires_at,
        attempts = 0,
        max_attempts = EXCLUDED.max_attempts,
        last_sent_at = EXCLUDED.last_sent_at,
        updated_at = NOW()
      RETURNING *`,
      [normalizedEmail, otpHash, expiresAt, maxAttempts, lastSentAt || new Date().toISOString()],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findByEmail(email, db = { query }) {
    const normalizedEmail = normalizeEmail(email);
    const { rows } = await db.query(
      `SELECT *
       FROM auth_email_login_otps
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [normalizedEmail],
    );

    return toCamelRows(rows)[0] || null;
  },

  async incrementAttemptsByEmail(email, db = { query }) {
    const normalizedEmail = normalizeEmail(email);
    const { rows } = await db.query(
      `UPDATE auth_email_login_otps
       SET attempts = attempts + 1,
           updated_at = NOW()
       WHERE LOWER(email) = LOWER($1)
       RETURNING *`,
      [normalizedEmail],
    );

    return toCamelRows(rows)[0] || null;
  },

  async deleteByEmail(email, db = { query }) {
    const normalizedEmail = normalizeEmail(email);
    await db.query(
      `DELETE FROM auth_email_login_otps
       WHERE LOWER(email) = LOWER($1)`,
      [normalizedEmail],
    );
  },

  async deleteExpired(db = { query }) {
    await db.query(
      `DELETE FROM auth_email_login_otps
       WHERE expires_at <= NOW()`,
    );
  },
};
