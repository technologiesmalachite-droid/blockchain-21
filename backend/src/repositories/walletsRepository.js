import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const walletsRepository = {
  async findByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM wallets WHERE user_id = $1 ORDER BY wallet_type ASC, asset ASC`,
      [userId],
    );

    return toCamelRows(rows);
  },

  async findById(walletId, db = { query }) {
    const { rows } = await db.query(`SELECT * FROM wallets WHERE id = $1 LIMIT 1`, [walletId]);
    return toCamelRows(rows)[0] || null;
  },

  async findByUserTypeAsset({ userId, walletType, asset }, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM wallets
       WHERE user_id = $1 AND wallet_type = $2 AND asset = $3
       LIMIT 1`,
      [userId, walletType, asset],
    );

    return toCamelRows(rows)[0] || null;
  },

  async create({ userId, walletType, asset, custodyWalletId, metadata = {} }, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO wallets (
        user_id, wallet_type, asset, total_balance, available_balance, locked_balance, average_cost, custody_wallet_id, metadata
      ) VALUES ($1, $2, $3, 0, 0, 0, 0, $4, $5::jsonb)
      ON CONFLICT (user_id, wallet_type, asset)
      DO UPDATE SET
        custody_wallet_id = COALESCE(wallets.custody_wallet_id, EXCLUDED.custody_wallet_id),
        metadata = wallets.metadata || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [userId, walletType, asset, custodyWalletId || null, asJson(metadata)],
    );

    return toCamelRows(rows)[0];
  },
};
