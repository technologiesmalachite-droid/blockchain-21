import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const depositRecordsRepository = {
  async create(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO deposit_records (
        user_id, wallet_id, wallet_transaction_id, asset, network, wallet_type,
        expected_amount, tx_hash, source_address, status,
        confirmations_required, confirmations_count, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
      ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
      DO UPDATE SET
        status = EXCLUDED.status,
        tx_hash = COALESCE(EXCLUDED.tx_hash, deposit_records.tx_hash),
        source_address = COALESCE(EXCLUDED.source_address, deposit_records.source_address),
        confirmations_count = EXCLUDED.confirmations_count,
        metadata = deposit_records.metadata || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        record.userId,
        record.walletId,
        record.walletTransactionId || null,
        record.asset,
        record.network,
        record.walletType,
        record.expectedAmount || null,
        record.txHash || null,
        record.sourceAddress || null,
        record.status,
        record.confirmationsRequired || 1,
        record.confirmationsCount || 0,
        record.idempotencyKey || null,
        asJson(record.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, limit = 100, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM deposit_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );

    return toCamelRows(rows);
  },

  async findByIdempotencyKey(idempotencyKey, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM deposit_records
       WHERE idempotency_key = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [idempotencyKey],
    );

    return toCamelRows(rows)[0] || null;
  },
};
