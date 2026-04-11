import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const ledgerEntriesRepository = {
  async create(
    {
      userId,
      walletId,
      asset,
      direction,
      amount,
      balanceAfter,
      referenceType,
      referenceId,
      description,
      idempotencyKey,
      metadata = {},
    },
    db = { query },
  ) {
    const { rows } = await db.query(
      `INSERT INTO ledger_entries (
        user_id, wallet_id, asset, direction, amount, balance_after,
        reference_type, reference_id, description, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
      RETURNING *`,
      [
        userId,
        walletId,
        asset,
        direction,
        amount,
        balanceAfter,
        referenceType,
        referenceId ? String(referenceId) : null,
        description || null,
        idempotencyKey || null,
        asJson(metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, limit = 100, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM ledger_entries
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    return toCamelRows(rows);
  },
};
