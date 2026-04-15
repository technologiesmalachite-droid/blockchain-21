import { query } from "../db/pool.js";

export const orderBookRepository = {
  async upsertBestPrices({ symbol, bidPrice, askPrice }, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO order_book (symbol, bid_price, ask_price, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (symbol) DO UPDATE
       SET bid_price = EXCLUDED.bid_price,
           ask_price = EXCLUDED.ask_price,
           updated_at = NOW()
       RETURNING *`,
      [symbol, bidPrice, askPrice],
    );

    return rows[0] || null;
  },

  async findBySymbol(symbol, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM order_book WHERE symbol = $1 LIMIT 1`,
      [symbol],
    );

    return rows[0] || null;
  },
};
