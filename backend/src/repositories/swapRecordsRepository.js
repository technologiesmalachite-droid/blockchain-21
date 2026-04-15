import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const swapRecordsRepository = {
  async create(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO swap_records (
        user_id, from_wallet_id, to_wallet_id, wallet_type, from_asset, to_asset,
        from_amount, to_amount, quoted_rate, fee_rate_bps, fee_amount, slippage_bps,
        quote_expires_at, status, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
      RETURNING *`,
      [
        record.userId,
        record.fromWalletId,
        record.toWalletId || null,
        record.walletType,
        record.fromAsset,
        record.toAsset,
        record.fromAmount,
        record.toAmount,
        record.quotedRate,
        record.feeRateBps || 0,
        record.feeAmount || 0,
        record.slippageBps || 0,
        record.quoteExpiresAt || null,
        record.status,
        record.idempotencyKey || null,
        asJson(record.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async findQuoteForUserForUpdate({ quoteId, userId }, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM swap_records
       WHERE id = $1
         AND user_id = $2
       LIMIT 1
       FOR UPDATE`,
      [quoteId, userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async updateStatus({ swapId, status, toWalletId, metadata }, db = { query }) {
    const { rows } = await db.query(
      `UPDATE swap_records
       SET status = $2,
           to_wallet_id = COALESCE($3, to_wallet_id),
           metadata = swap_records.metadata || $4::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [swapId, status, toWalletId || null, asJson(metadata)],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listByUser(userId, limit = 100, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM swap_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );

    return toCamelRows(rows);
  },
};
