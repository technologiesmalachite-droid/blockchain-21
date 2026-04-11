import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const walletTransactionsRepository = {
  async create(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO wallet_transactions (
        user_id, wallet_id, transaction_type, asset, wallet_type, network,
        amount, fee, destination_address, status, risk_score, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
      RETURNING *`,
      [
        record.userId,
        record.walletId || null,
        record.transactionType,
        record.asset,
        record.walletType,
        record.network || null,
        record.amount,
        record.fee || 0,
        record.destinationAddress || null,
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
      `SELECT * FROM wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return toCamelRows(rows);
  },

  async countRecentWithdrawals(userId, hours = 24, db = { query }) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM wallet_transactions
       WHERE user_id = $1
         AND transaction_type = 'withdrawal'
         AND created_at > NOW() - ($2 || ' hours')::interval`,
      [userId, String(hours)],
    );

    return rows[0]?.count || 0;
  },

  async listAllForAdmin(db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM wallet_transactions ORDER BY created_at DESC`,
    );

    return toCamelRows(rows);
  },
};
