import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const tradesRepository = {
  async create(trade, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO trades (
        order_id, user_id, symbol, side, order_type, price,
        quantity, notional, fee, settlement_wallet_type, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      RETURNING *`,
      [
        trade.orderId || null,
        trade.userId,
        trade.symbol,
        trade.side,
        trade.orderType,
        trade.price,
        trade.quantity,
        trade.notional,
        trade.fee,
        trade.settlementWalletType,
        trade.idempotencyKey || null,
        asJson(trade.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM trades
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return toCamelRows(rows);
  },
};
