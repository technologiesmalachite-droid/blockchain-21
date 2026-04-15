import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const walletLedgerEntriesRepository = {
  async create(
    {
      userId,
      walletId,
      asset,
      direction,
      amount,
      balanceAfter,
      entryType,
      referenceType,
      referenceId,
      status,
      description,
      idempotencyKey,
      metadata,
    },
    db = { query },
  ) {
    const { rows } = await db.query(
      `INSERT INTO wallet_ledger_entries (
        user_id, wallet_id, asset, direction, amount, balance_after,
        entry_type, reference_type, reference_id, status, description,
        idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
      RETURNING *`,
      [
        userId,
        walletId,
        asset,
        direction,
        amount,
        balanceAfter,
        entryType || "wallet",
        referenceType,
        referenceId ? String(referenceId) : null,
        status || "completed",
        description || null,
        idempotencyKey || null,
        asJson(metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, limit = 100, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM wallet_ledger_entries
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    return toCamelRows(rows);
  },
};
