import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const ordersRepository = {
  async create(order, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO orders (
        user_id, symbol, side, order_type, wallet_type, price,
        quantity, filled_quantity, notional, fee, locked_amount, status, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
      RETURNING *`,
      [
        order.userId,
        order.symbol,
        order.side,
        order.orderType,
        order.walletType,
        order.price || null,
        order.quantity,
        order.filledQuantity || 0,
        order.notional,
        order.fee,
        order.lockedAmount || 0,
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

  async findByIdForUpdate(orderId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
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

  async updateProgress({ orderId, status, filledQuantity, lockedAmount }, db = { query }) {
    const { rows } = await db.query(
      `UPDATE orders
       SET status = $2,
           filled_quantity = $3,
           locked_amount = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId, status, filledQuantity, lockedAmount],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listByUser(userId, limit = 100, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    return toCamelRows(rows);
  },

  async findBestMatchingOrder({ symbol, incomingSide, limitPrice = null, excludedUserId = null }, db = { query }) {
    const isIncomingBuy = incomingSide === "buy";

    const orderByClause = isIncomingBuy ? "price ASC, created_at ASC" : "price DESC, created_at ASC";
    const priceCondition = isIncomingBuy
      ? (limitPrice === null ? "TRUE" : "price <= $3")
      : (limitPrice === null ? "TRUE" : "price >= $3");
    const exclusionCondition = excludedUserId ? "AND user_id <> $4" : "";

    const params = limitPrice === null
      ? (excludedUserId ? [symbol, isIncomingBuy ? "sell" : "buy", null, excludedUserId] : [symbol, isIncomingBuy ? "sell" : "buy"])
      : (excludedUserId ? [symbol, isIncomingBuy ? "sell" : "buy", limitPrice, excludedUserId] : [symbol, isIncomingBuy ? "sell" : "buy", limitPrice]);
    const { rows } = await db.query(
      `SELECT *
       FROM orders
       WHERE symbol = $1
         AND side = $2
         ${exclusionCondition}
         AND order_type = 'limit'
         AND status IN ('open', 'partially_filled')
         AND quantity > filled_quantity
         AND ${priceCondition}
       ORDER BY ${orderByClause}
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      params,
    );

    return toCamelRows(rows)[0] || null;
  },

  async listOrderBookSide({ symbol, side, depth = 20 }, db = { query }) {
    const orderBy = side === "buy" ? "price DESC" : "price ASC";
    const { rows } = await db.query(
      `SELECT
         price,
         SUM(quantity - filled_quantity)::numeric AS quantity
       FROM orders
       WHERE symbol = $1
         AND side = $2
         AND order_type = 'limit'
         AND status IN ('open', 'partially_filled')
         AND quantity > filled_quantity
         AND price IS NOT NULL
       GROUP BY price
       ORDER BY ${orderBy}
       LIMIT $3`,
      [symbol, side, depth],
    );

    return rows.map((row) => ({
      price: Number(row.price),
      quantity: Number(row.quantity),
    }));
  },

  async getBestBidAsk(symbol, db = { query }) {
    const { rows } = await db.query(
      `SELECT
         (SELECT MAX(price)
          FROM orders
          WHERE symbol = $1
            AND side = 'buy'
            AND order_type = 'limit'
            AND status IN ('open', 'partially_filled')
            AND quantity > filled_quantity) AS bid_price,
         (SELECT MIN(price)
          FROM orders
          WHERE symbol = $1
            AND side = 'sell'
            AND order_type = 'limit'
            AND status IN ('open', 'partially_filled')
            AND quantity > filled_quantity) AS ask_price`,
      [symbol],
    );

    return {
      bidPrice: rows[0]?.bid_price != null ? Number(rows[0].bid_price) : null,
      askPrice: rows[0]?.ask_price != null ? Number(rows[0].ask_price) : null,
    };
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
