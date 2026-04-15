import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const tradesRepository = {
  async create(trade, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO trades (
        order_id, user_id, symbol, side, order_type, price,
        quantity, notional, fee, fee_asset, liquidity_role, settlement_wallet_type, idempotency_key, buy_order_id, sell_order_id, match_id, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
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
        trade.feeAsset || null,
        trade.liquidityRole || null,
        trade.settlementWalletType,
        trade.idempotencyKey || null,
        trade.buyOrderId || null,
        trade.sellOrderId || null,
        trade.matchId || null,
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

  async listRecentBySymbol(symbol, limit = 50, db = { query }) {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (COALESCE(match_id::text, id::text))
          id,
          symbol,
          side,
          price,
          quantity,
          notional,
          fee,
          created_at,
          match_id
       FROM trades
       WHERE symbol = $1
       ORDER BY COALESCE(match_id::text, id::text), created_at DESC`,
      [symbol],
    );

    const normalized = toCamelRows(rows)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return normalized;
  },
};
