import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const ordersRepository = {
  async create(order, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO orders (
        user_id, symbol, side, order_type, wallet_type, price,
        quantity, notional, fee, status, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      RETURNING *`,
      [
        order.userId,
        order.symbol,
        order.side,
        order.orderType,
        order.walletType,
        order.price || null,
        order.quantity,
        order.notional,
        order.fee,
        order.status,
        order.idempotencyKey || null,
        asJson(order.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async findByIdForUser(orderId, userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [orderId, userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findByIdForUserForUpdate(orderId, userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [orderId, userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async updateStatus(orderId, status, db = { query }) {
    const { rows } = await db.query(
      `UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [orderId, status],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listOpenByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM orders
       WHERE user_id = $1 AND status IN ('open', 'partially_filled')
       ORDER BY created_at DESC`,
      [userId],
    );

    return toCamelRows(rows);
  },
};
