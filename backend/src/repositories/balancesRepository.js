import { query } from "../db/pool.js";
import { toCamelRows } from "./helpers.js";
import { toDecimal, toDbNumeric } from "../utils/decimal.js";

const assertNonNegative = (label, value) => {
  if (toDecimal(value).lessThan(0)) {
    throw new Error(`${label} cannot be negative.`);
  }
};

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
    assertNonNegative("total_balance", totalBalance);
    assertNonNegative("available_balance", availableBalance);
    assertNonNegative("locked_balance", lockedBalance);

    const { rows } = await db.query(
      `UPDATE wallets
       SET total_balance = $2,
           available_balance = $3,
           locked_balance = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [walletId, toDbNumeric(totalBalance), toDbNumeric(availableBalance), toDbNumeric(lockedBalance)],
    );

    return toCamelRows(rows)[0] || null;
  },
};
