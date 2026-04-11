import assert from "node:assert/strict";
import test from "node:test";
import { sessionsRepository } from "../../src/repositories/sessionsRepository.js";
import { usersRepository } from "../../src/repositories/usersRepository.js";
import { createUserSeed, deleteUserCascade, hasDatabase } from "./_dbTestUtils.js";

const runIfDb = hasDatabase ? test : test.skip;

runIfDb("sessionsRepository tracks active and revoked refresh sessions", async (t) => {
  const user = await usersRepository.create(createUserSeed());

  t.after(async () => {
    await deleteUserCascade(user.id);
  });

  const validToken = `rt_valid_${Date.now()}`;
  const expiredToken = `rt_expired_${Date.now()}`;

  const session = await sessionsRepository.create({
    userId: user.id,
    token: validToken,
    userAgent: "repo-test",
    ipAddress: "127.0.0.1",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  assert.ok(session.id);

  await sessionsRepository.create({
    userId: user.id,
    token: expiredToken,
    userAgent: "repo-test",
    ipAddress: "127.0.0.1",
    expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
  });

  const found = await sessionsRepository.findByToken(validToken);
  assert.ok(found);
  assert.equal(found.userId, user.id);

  const expired = await sessionsRepository.findByToken(expiredToken);
  assert.equal(expired, null);

  const activeSessions = await sessionsRepository.listActiveByUser(user.id);
  assert.equal(activeSessions.length, 1);
  assert.equal(activeSessions[0].id, session.id);

  await sessionsRepository.revokeByToken(validToken);
  const revoked = await sessionsRepository.findByToken(validToken);
  assert.equal(revoked, null);
});

if (!hasDatabase) {
  test("sessionsRepository tests skipped without DATABASE_URL", () => {
    assert.ok(true);
  });
}
