import assert from "node:assert/strict";
import test from "node:test";
import { usersRepository } from "../../src/repositories/usersRepository.js";
import { createUserSeed, deleteUserCascade, hasDatabase } from "./_dbTestUtils.js";

const runIfDb = hasDatabase ? test : test.skip;

runIfDb("usersRepository persists and updates user + account restrictions", async (t) => {
  const created = await usersRepository.create(createUserSeed());

  t.after(async () => {
    await deleteUserCascade(created.id);
  });

  assert.ok(created.id);
  assert.equal(created.emailVerified, false);
  assert.equal(created.accountRestrictions.frozen, false);

  const loaded = await usersRepository.findByEmail(created.email);
  assert.ok(loaded);
  assert.equal(loaded.id, created.id);

  const updated = await usersRepository.updateById(created.id, {
    fullName: "Updated Repo User",
    kycStatus: "approved",
    kycTier: "enhanced",
    riskScore: 47,
    accountRestrictions: {
      frozen: true,
      withdrawalsLocked: true,
      tradingLocked: false,
      reason: "manual_review",
      metadata: {
        source: "test_suite",
      },
    },
  });

  assert.equal(updated.fullName, "Updated Repo User");
  assert.equal(updated.kycStatus, "approved");
  assert.equal(updated.riskScore, 47);
  assert.equal(updated.accountRestrictions.frozen, true);
  assert.equal(updated.accountRestrictions.withdrawalsLocked, true);
  assert.equal(updated.accountRestrictions.reason, "manual_review");
});

if (!hasDatabase) {
  test("usersRepository tests skipped without DATABASE_URL", () => {
    assert.ok(true);
  });
}
