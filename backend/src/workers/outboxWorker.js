import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { outboxRepository } from "../repositories/outboxRepository.js";

const POLL_INTERVAL_MS = env.outboxPollIntervalMs;
const BATCH_SIZE = env.outboxBatchSize;

let isStopping = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dispatchEvent = async (event) => {
  // Redis handoff placeholder:
  // replace this with LPUSH/XADD/PUBLISH to your queue topic in production.
  console.log(`[outbox-worker] dispatched topic=${event.topic} id=${event.id}`);
};

const processBatch = async () => {
  const events = await outboxRepository.lockNextBatch({ limit: BATCH_SIZE });

  if (!events.length) {
    return 0;
  }

  for (const event of events) {
    try {
      await dispatchEvent(event);
      await outboxRepository.markProcessed(event.id);
    } catch (error) {
      await outboxRepository.markFailed(event.id, error?.message || "dispatch_failed");
    }
  }

  return events.length;
};

const shutdown = async (signal) => {
  if (isStopping) {
    return;
  }

  isStopping = true;
  console.log(`[outbox-worker] received ${signal}, shutting down...`);
  await pool.end();
};

const start = async () => {
  console.log(
    `[outbox-worker] starting with batch=${BATCH_SIZE} pollIntervalMs=${POLL_INTERVAL_MS}`,
  );

  process.on("SIGINT", () => {
    shutdown("SIGINT").catch((error) => {
      console.error("[outbox-worker] shutdown failure", error);
    });
  });

  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch((error) => {
      console.error("[outbox-worker] shutdown failure", error);
    });
  });

  while (!isStopping) {
    try {
      const processed = await processBatch();

      if (!processed) {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error("[outbox-worker] cycle failed", error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
};

start().catch(async (error) => {
  console.error("[outbox-worker] fatal error", error);
  await pool.end();
  process.exitCode = 1;
});
