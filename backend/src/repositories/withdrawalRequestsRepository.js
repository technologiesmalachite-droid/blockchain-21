import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const withdrawalRequestsRepository = {
  async create(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO withdrawal_requests (
        user_id, wallet_id, wallet_transaction_id, asset, network, wallet_type,
        amount, fee, total_debit, destination_address, status, provider_name,
        provider_reference, risk_score, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
      ON CONFLICT (idempotency_key)
      DO UPDATE SET
        status = EXCLUDED.status,
        provider_reference = COALESCE(EXCLUDED.provider_reference, withdrawal_requests.provider_reference),
        metadata = withdrawal_requests.metadata || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        record.userId,
        record.walletId,
        record.walletTransactionId || null,
        record.asset,
        record.network,
        record.walletType,
        record.amount,
        record.fee,
        record.totalDebit,
        record.destinationAddress,
        record.status,
        record.providerName || null,
        record.providerReference || null,
        record.riskScore || 0,
        record.idempotencyKey || null,
        asJson(record.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, limit = 100, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );

    return toCamelRows(rows);
  },
};
