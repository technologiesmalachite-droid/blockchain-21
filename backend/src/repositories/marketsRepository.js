import { query } from "../db/pool.js";
import { toCamelRows } from "./helpers.js";

export const marketsRepository = {
  async list(db = { query }) {
    const { rows } = await db.query(`SELECT * FROM market_pairs ORDER BY symbol ASC`);
    return toCamelRows(rows);
  },

  async findBySymbol(symbol, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM market_pairs WHERE symbol = $1 LIMIT 1`,
      [symbol.toUpperCase()],
    );

    return toCamelRows(rows)[0] || null;
  },

  async updateBySymbol(symbol, patch, db = { query }) {
    const updates = [];
    const values = [];
    let index = 1;

    if (patch.lastPrice !== undefined) {
      updates.push(`last_price = $${index}`);
      values.push(patch.lastPrice);
      index += 1;
    }

    if (patch.high24h !== undefined) {
      updates.push(`high_24h = $${index}`);
      values.push(patch.high24h);
      index += 1;
    }

    if (patch.low24h !== undefined) {
      updates.push(`low_24h = $${index}`);
      values.push(patch.low24h);
      index += 1;
    }

    if (patch.volume24h !== undefined) {
      updates.push(`volume_24h = $${index}`);
      values.push(patch.volume24h);
      index += 1;
    }

    if (!updates.length) {
      return this.findBySymbol(symbol, db);
    }

    values.push(symbol.toUpperCase());

    const { rows } = await db.query(
      `UPDATE market_pairs
       SET ${updates.join(", ")},
           updated_at = NOW()
       WHERE symbol = $${index}
       RETURNING *`,
      values,
    );

    return toCamelRows(rows)[0] || null;
  },
};
