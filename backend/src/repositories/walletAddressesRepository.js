import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const walletAddressesRepository = {
  async findActive({ userId, asset, network, walletType }, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM wallet_addresses
       WHERE user_id = $1
         AND asset = $2
         AND network = $3
         AND wallet_type = $4
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, asset, network, walletType],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listByUserAsset({ userId, asset, walletType, limit = 20 }, db = { query }) {
    const params = [userId, asset, limit];
    let sql = `SELECT *
      FROM wallet_addresses
      WHERE user_id = $1
        AND asset = $2`;

    if (walletType) {
      params.splice(2, 0, walletType);
      sql += ` AND wallet_type = $3 ORDER BY created_at DESC LIMIT $4`;
    } else {
      sql += ` ORDER BY created_at DESC LIMIT $3`;
    }

    const { rows } = await db.query(sql, params);
    return toCamelRows(rows);
  },

  async create(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO wallet_addresses (
        user_id, wallet_id, asset, network, wallet_type, address, memo,
        status, is_primary, provider_name, provider_reference, expires_at,
        idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
      ON CONFLICT (idempotency_key)
      DO UPDATE SET
        updated_at = NOW(),
        status = EXCLUDED.status,
        expires_at = EXCLUDED.expires_at,
        metadata = wallet_addresses.metadata || EXCLUDED.metadata
      RETURNING *`,
      [
        record.userId,
        record.walletId,
        record.asset,
        record.network,
        record.walletType,
        record.address,
        record.memo || null,
        record.status || "active",
        record.isPrimary !== false,
        record.providerName || null,
        record.providerReference || null,
        record.expiresAt || null,
        record.idempotencyKey || null,
        asJson(record.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async expireActive({ userId, asset, network, walletType }, db = { query }) {
    await db.query(
      `UPDATE wallet_addresses
       SET status = 'expired', updated_at = NOW()
       WHERE user_id = $1
         AND asset = $2
         AND network = $3
         AND wallet_type = $4
         AND status = 'active'`,
      [userId, asset, network, walletType],
    );
  },
};
