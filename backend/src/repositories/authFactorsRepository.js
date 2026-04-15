import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

const nowPlusMinutes = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

export const authFactorsRepository = {
  async createVerificationChallenge({ userId, channel, destination, code, ttlMinutes = 10, metadata = {} }, db = { query }) {
    const codeHash = await bcrypt.hash(code, 10);

    const { rows } = await db.query(
      `INSERT INTO auth_factors (
        user_id, factor_type, channel, destination, code_hash, expires_at, metadata
      ) VALUES ($1, 'verification_challenge', $2, $3, $4, $5, $6::jsonb)
      RETURNING *`,
      [userId, channel, destination, codeHash, nowPlusMinutes(ttlMinutes), asJson(metadata)],
    );

    return toCamelRows(rows)[0];
  },

  async findLatestActiveChallenge({ userId, channel }, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM auth_factors
       WHERE user_id = $1
         AND factor_type = 'verification_challenge'
         AND channel = $2
         AND consumed_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, channel],
    );

    return toCamelRows(rows)[0] || null;
  },

  async incrementAttempts(id, db = { query }) {
    await db.query(
      `UPDATE auth_factors
       SET attempts = attempts + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  },

  async consumeChallenge(id, db = { query }) {
    await db.query(
      `UPDATE auth_factors
       SET consumed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  },

  async markActiveTotpSetupChallengesConsumed({ userId }, db = { query }) {
    await db.query(
      `UPDATE auth_factors
       SET consumed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1
         AND factor_type = 'totp_setup'
         AND consumed_at IS NULL`,
      [userId],
    );
  },

  async createTotpSetupChallenge({ userId, secretEncrypted, ttlMinutes = 10, maxAttempts = 5 }, db = { query }) {
    await this.markActiveTotpSetupChallengesConsumed({ userId }, db);

    const { rows } = await db.query(
      `INSERT INTO auth_factors (
        user_id, factor_type, secret_encrypted, max_attempts, expires_at, metadata
      ) VALUES ($1, 'totp_setup', $2, $3, $4, $5::jsonb)
      RETURNING *`,
      [userId, secretEncrypted, maxAttempts, nowPlusMinutes(ttlMinutes), asJson({})],
    );

    return toCamelRows(rows)[0];
  },

  async findActiveTotpSetupChallengeById({ userId, challengeId }, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM auth_factors
       WHERE id = $1
         AND user_id = $2
         AND factor_type = 'totp_setup'
         AND consumed_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [challengeId, userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async consumeAllTotpSetupChallenges({ userId }, db = { query }) {
    await db.query(
      `UPDATE auth_factors
       SET consumed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1
         AND factor_type = 'totp_setup'
         AND consumed_at IS NULL`,
      [userId],
    );
  },

  async verifyChallengeCode(challenge, code) {
    if (!challenge?.codeHash) {
      return false;
    }

    return bcrypt.compare(code, challenge.codeHash);
  },
};
