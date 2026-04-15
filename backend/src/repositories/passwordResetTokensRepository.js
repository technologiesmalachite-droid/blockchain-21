import crypto from "crypto";
import { query } from "../db/pool.js";
import { toCamelRows } from "./helpers.js";

const hashToken = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

export const passwordResetTokensRepository = {
  async create({ userId, token, ttlMinutes = 20, requestedIp, requestedUserAgent }, db = { query }) {
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

    const { rows } = await db.query(
      `INSERT INTO password_reset_tokens (
        user_id, token_hash, expires_at, requested_ip, requested_user_agent
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [userId, tokenHash, expiresAt, requestedIp || null, requestedUserAgent || null],
    );

    return toCamelRows(rows)[0];
  },

  async findActiveByToken(token, db = { query }) {
    const tokenHash = hashToken(token);
    const { rows } = await db.query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = $1
         AND consumed_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );

    return toCamelRows(rows)[0] || null;
  },

  async consumeById(id, db = { query }) {
    await db.query(
      `UPDATE password_reset_tokens
       SET consumed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  },

  async consumeAllForUser(userId, db = { query }) {
    await db.query(
      `UPDATE password_reset_tokens
       SET consumed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1
         AND consumed_at IS NULL`,
      [userId],
    );
  },
};

