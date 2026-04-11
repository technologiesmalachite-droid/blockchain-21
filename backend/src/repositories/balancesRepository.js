import { query } from "../db/pool.js";
import { toCamelRows } from "./helpers.js";

const round = (value, precision = 10) => Number(Number(value).toFixed(precision));

export const balancesRepository = {
  async lockWallet({ userId, walletType, asset }, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM wallets
       WHERE user_id = $1 AND wallet_type = $2 AND asset = $3
       FOR UPDATE`,
      [userId, walletType, asset],
    );

    return toCamelRows(rows)[0] || null;
  },

  async updateWalletBalances({ walletId, totalBalance, availableBalance, lockedBalance }, db = { query }) {
    const { rows } = await db.query(
      `UPDATE wallets
       SET total_balance = $2,
           available_balance = $3,
           locked_balance = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [walletId, round(totalBalance), round(availableBalance), round(lockedBalance)],
    );

    return toCamelRows(rows)[0] || null;
  },
};
