import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const withdrawalsRepository = {
  async create(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO withdrawals (
        user_id, wallet_transaction_id, asset, network, amount, fee, destination_address,
        provider_name, provider_reference, status, risk_score, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
      RETURNING *`,
      [
        record.userId,
        record.walletTransactionId || null,
        record.asset,
        record.network,
        record.amount,
        record.fee,
        record.destinationAddress,
        record.providerName || null,
        record.providerReference || null,
        record.status,
        record.riskScore || 0,
        record.idempotencyKey || null,
        asJson(record.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );

    return toCamelRows(rows);
  },
};
