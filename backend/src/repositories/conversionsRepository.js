import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const conversionsRepository = {
  async create(conversion, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO conversions (
        user_id, from_asset, to_asset, wallet_type, source_amount,
        received_amount, price, fee, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      RETURNING *`,
      [
        conversion.userId,
        conversion.fromAsset,
        conversion.toAsset,
        conversion.walletType,
        conversion.sourceAmount,
        conversion.receivedAmount,
        conversion.price,
        conversion.fee,
        conversion.idempotencyKey || null,
        asJson(conversion.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM conversions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return toCamelRows(rows);
  },
};
