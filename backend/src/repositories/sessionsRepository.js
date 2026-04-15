import crypto from "crypto";
import { query } from "../db/pool.js";
import { toCamelRows } from "./helpers.js";

export const hashToken = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

export const sessionsRepository = {
  async create({ userId, token, userAgent, ipAddress, expiresAt }, db = { query }) {
    const tokenHash = hashToken(token);

    const { rows } = await db.query(
      `INSERT INTO refresh_sessions (
        user_id, token_hash, user_agent, ip_address, expires_at
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [userId, tokenHash, userAgent || null, ipAddress || null, expiresAt],
    );

    return toCamelRows(rows)[0];
  },

  async findByToken(token, db = { query }) {
    const tokenHash = hashToken(token);

    const { rows } = await db.query(
      `SELECT * FROM refresh_sessions
       WHERE token_hash = $1 AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );

    return toCamelRows(rows)[0] || null;
  },

  async revokeByToken(token, db = { query }) {
    const tokenHash = hashToken(token);

    await db.query(
      `UPDATE refresh_sessions
       SET revoked_at = NOW()
       WHERE token_hash = $1`,
      [tokenHash],
    );
  },

  async revokeByIdForUser({ sessionId, userId }, db = { query }) {
    const { rows } = await db.query(
      `UPDATE refresh_sessions
       SET revoked_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL
       RETURNING *`,
      [sessionId, userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async revokeOthers({ userId, currentRefreshToken = null }, db = { query }) {
    if (currentRefreshToken) {
      const keepTokenHash = hashToken(currentRefreshToken);
      await db.query(
        `UPDATE refresh_sessions
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND token_hash <> $2
           AND revoked_at IS NULL`,
        [userId, keepTokenHash],
      );
      return;
    }

    await db.query(
      `UPDATE refresh_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId],
    );
  },

  async revokeAllByUser(userId, db = { query }) {
    await db.query(
      `UPDATE refresh_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId],
    );
  },

  async listActiveByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM refresh_sessions
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId],
    );

    return toCamelRows(rows);
  },
};
