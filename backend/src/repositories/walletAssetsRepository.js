import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const walletAssetsRepository = {
  async listActive(db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM wallet_assets WHERE is_active = TRUE ORDER BY asset ASC`,
    );

    return toCamelRows(rows);
  },

  async findByAsset(asset, db = { query }) {
    const { rows } = await db.query(`SELECT * FROM wallet_assets WHERE asset = $1 LIMIT 1`, [asset]);
    return toCamelRows(rows)[0] || null;
  },

  async upsert(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO wallet_assets (asset, display_name, precision, is_active, metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (asset)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         precision = EXCLUDED.precision,
         is_active = EXCLUDED.is_active,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [record.asset, record.displayName, record.precision, record.isActive !== false, asJson(record.metadata)],
    );

    return toCamelRows(rows)[0];
  },
};
