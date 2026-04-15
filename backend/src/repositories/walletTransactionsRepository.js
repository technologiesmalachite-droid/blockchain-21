import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const walletTransactionsRepository = {
  async create(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO wallet_transactions (
        user_id, wallet_id, transaction_type, asset, wallet_type, network,
        amount, fee, destination_address, source_address, tx_hash, provider_reference,
        status, risk_score, idempotency_key, failure_reason, completed_at, cancelled_at, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)
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
        record.sourceAddress || null,
        record.txHash || null,
        record.providerReference || null,
        record.status,
        record.riskScore || 0,
        record.idempotencyKey || null,
        record.failureReason || null,
        record.completedAt || null,
        record.cancelledAt || null,
        asJson(record.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, db = { query }, options = {}) {
    const params = [userId];
    const clauses = ["user_id = $1"];

    if (options.asset) {
      params.push(options.asset);
      clauses.push(`asset = $${params.length}`);
    }

    if (options.walletType) {
      params.push(options.walletType);
      clauses.push(`wallet_type = $${params.length}`);
    }

    if (options.status) {
      params.push(options.status);
      clauses.push(`status = $${params.length}`);
    }

    if (options.type) {
      params.push(options.type);
      clauses.push(`transaction_type = $${params.length}`);
    }

    if (options.network) {
      params.push(options.network);
      clauses.push(`network = $${params.length}`);
    }

    if (options.search) {
      params.push(`%${String(options.search).toLowerCase()}%`);
      clauses.push(`(
        LOWER(COALESCE(destination_address, '')) LIKE $${params.length}
        OR LOWER(COALESCE(source_address, '')) LIKE $${params.length}
        OR LOWER(COALESCE(tx_hash, '')) LIKE $${params.length}
      )`);
    }

    const page = Number(options.page || 1);
    const pageSize = Number(options.pageSize || 25);
    const offset = Math.max(0, page - 1) * pageSize;

    params.push(pageSize, offset);

    const sql = `SELECT *
       FROM wallet_transactions
       WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`;

    const { rows } = await db.query(sql, params);
    return toCamelRows(rows);
  },

  async countByUser(userId, db = { query }, options = {}) {
    const params = [userId];
    const clauses = ["user_id = $1"];

    if (options.asset) {
      params.push(options.asset);
      clauses.push(`asset = $${params.length}`);
    }

    if (options.walletType) {
      params.push(options.walletType);
      clauses.push(`wallet_type = $${params.length}`);
    }

    if (options.status) {
      params.push(options.status);
      clauses.push(`status = $${params.length}`);
    }

    if (options.type) {
      params.push(options.type);
      clauses.push(`transaction_type = $${params.length}`);
    }

    if (options.network) {
      params.push(options.network);
      clauses.push(`network = $${params.length}`);
    }

    if (options.search) {
      params.push(`%${String(options.search).toLowerCase()}%`);
      clauses.push(`(
        LOWER(COALESCE(destination_address, '')) LIKE $${params.length}
        OR LOWER(COALESCE(source_address, '')) LIKE $${params.length}
        OR LOWER(COALESCE(tx_hash, '')) LIKE $${params.length}
      )`);
    }

    const sql = `SELECT COUNT(*)::int AS count
      FROM wallet_transactions
      WHERE ${clauses.join(" AND ")}`;
    const { rows } = await db.query(sql, params);
    return rows[0]?.count || 0;
  },

  async findByIdForUser({ transactionId, userId }, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM wallet_transactions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [transactionId, userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findByHashForUser({ txHash, userId }, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM wallet_transactions WHERE tx_hash = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [txHash, userId],
    );

    return toCamelRows(rows)[0] || null;
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
