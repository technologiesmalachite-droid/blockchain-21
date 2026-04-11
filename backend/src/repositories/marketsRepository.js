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
};
