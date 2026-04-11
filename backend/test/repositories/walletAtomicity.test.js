import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../../src/db/pool.js";
import { withTransaction } from "../../src/db/transaction.js";
import { balancesRepository } from "../../src/repositories/balancesRepository.js";
import { ledgerEntriesRepository } from "../../src/repositories/ledgerEntriesRepository.js";
import { usersRepository } from "../../src/repositories/usersRepository.js";
import { walletsRepository } from "../../src/repositories/walletsRepository.js";
import { createUserSeed, deleteUserCascade, hasDatabase } from "./_dbTestUtils.js";

const runIfDb = hasDatabase ? test : test.skip;

runIfDb("wallet + ledger updates rollback atomically on failure", async (t) => {
  const user = await usersRepository.create(createUserSeed());

  t.after(async () => {
    await deleteUserCascade(user.id);
  });

  const wallet = await walletsRepository.create({
    userId: user.id,
    walletType: "spot",
    asset: "USDT",
  });

  await query(
    `UPDATE wallets
     SET total_balance = 100, available_balance = 100, locked_balance = 0, updated_at = NOW()
     WHERE id = $1`,
    [wallet.id],
  );

  const idempotencyKey = `wallet_atomicity_${Date.now()}`;

  await assert.rejects(
    withTransaction(async (db) => {
      const locked = await balancesRepository.lockWallet(
        {
          userId: user.id,
          walletType: "spot",
          asset: "USDT",
        },
        db,
      );

      await balancesRepository.updateWalletBalances(
        {
          walletId: locked.id,
          totalBalance: 90,
          availableBalance: 90,
          lockedBalance: 0,
        },
        db,
      );

      await ledgerEntriesRepository.create(
        {
          userId: user.id,
          walletId: locked.id,
          asset: "USDT",
          direction: "debit",
          amount: 10,
          balanceAfter: 90,
          referenceType: "wallet_atomicity_test",
          referenceId: "force_rollback",
          description: "rollback check",
          idempotencyKey,
          metadata: {
            source: "repository_test",
          },
        },
        db,
      );

      throw new Error("force_rollback");
    }),
    /force_rollback/,
  );

  const walletState = await query(
    `SELECT total_balance, available_balance, locked_balance
     FROM wallets
     WHERE id = $1`,
    [wallet.id],
  );

  assert.equal(Number(walletState.rows[0].total_balance), 100);
  assert.equal(Number(walletState.rows[0].available_balance), 100);
  assert.equal(Number(walletState.rows[0].locked_balance), 0);

  const ledgerRows = await query(
    `SELECT COUNT(*)::int AS count
     FROM ledger_entries
     WHERE idempotency_key = $1`,
    [idempotencyKey],
  );

  assert.equal(ledgerRows.rows[0].count, 0);
});

if (!hasDatabase) {
  test("walletAtomicity tests skipped without DATABASE_URL", () => {
    assert.ok(true);
  });
}
