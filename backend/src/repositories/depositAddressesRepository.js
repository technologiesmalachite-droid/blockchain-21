import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const depositAddressesRepository = {
  async create(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO deposit_addresses (
        user_id, wallet_id, asset, network, wallet_type, address, memo,
        provider_name, provider_reference, expires_at, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      RETURNING *`,
      [
        record.userId,
        record.walletId,
        record.asset,
        record.network,
        record.walletType,
        record.address,
        record.memo || null,
        record.providerName || null,
        record.providerReference || null,
        record.expiresAt || null,
        record.idempotencyKey || null,
        asJson(record.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, limit = 20, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM deposit_addresses
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    return toCamelRows(rows);
  },
};
