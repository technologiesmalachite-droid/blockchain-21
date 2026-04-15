import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

const nowPlusMinutes = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();
const nowPlusSeconds = (seconds) => new Date(Date.now() + seconds * 1_000).toISOString();

const createRepository = ({ tableName, destinationColumn }) => ({
  async createChallenge(
    {
      userId,
      destination,
      code,
      ttlMinutes,
      maxAttempts,
      maxResends,
      resendCount,
      cooldownSeconds,
      metadata = {},
    },
    db = { query },
  ) {
    const codeHash = await bcrypt.hash(code, 10);

    const { rows } = await db.query(
      `INSERT INTO ${tableName} (
        user_id, ${destinationColumn}, code_hash, status, attempts, max_attempts,
        resend_count, max_resends, cooldown_until, expires_at, metadata
      ) VALUES ($1,$2,$3,'pending',0,$4,$5,$6,$7,$8,$9::jsonb)
      RETURNING *`,
      [
        userId,
        destination,
        codeHash,
        maxAttempts,
        resendCount,
        maxResends,
        nowPlusSeconds(cooldownSeconds),
        nowPlusMinutes(ttlMinutes),
        asJson(metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async findLatestByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM ${tableName}
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findLatestActiveByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM ${tableName}
       WHERE user_id = $1
         AND consumed_at IS NULL
         AND status IN ('pending', 'sent')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async incrementAttempts(id, db = { query }) {
    const { rows } = await db.query(
      `UPDATE ${tableName}
       SET attempts = attempts + 1,
           status = CASE WHEN attempts + 1 >= max_attempts THEN 'blocked' ELSE status END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    return toCamelRows(rows)[0] || null;
  },

  async consumeChallenge(id, db = { query }) {
    const { rows } = await db.query(
      `UPDATE ${tableName}
       SET status = 'verified',
           consumed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    return toCamelRows(rows)[0] || null;
  },

  async supersedePendingChallenges(userId, db = { query }) {
    await db.query(
      `UPDATE ${tableName}
       SET status = 'superseded',
           updated_at = NOW()
       WHERE user_id = $1
         AND consumed_at IS NULL
         AND status IN ('pending', 'sent')`,
      [userId],
    );
  },

  async verifyChallengeCode(challenge, code) {
    if (!challenge?.codeHash) {
      return false;
    }

    return bcrypt.compare(code, challenge.codeHash);
  },
});

export const emailVerificationsRepository = createRepository({
  tableName: "email_verifications",
  destinationColumn: "email",
});

export const phoneVerificationsRepository = createRepository({
  tableName: "phone_verifications",
  destinationColumn: "phone",
});
