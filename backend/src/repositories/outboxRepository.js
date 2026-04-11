import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const outboxRepository = {
  async enqueue({ topic, payload, availableAt }, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO events_outbox (topic, payload, available_at)
       VALUES ($1, $2::jsonb, COALESCE($3, NOW()))
       RETURNING *`,
      [topic, asJson(payload), availableAt || null],
    );

    return toCamelRows(rows)[0];
  },

  async lockNextBatch({ limit = 20 }, db = { query }) {
    const { rows } = await db.query(
      `WITH next_jobs AS (
        SELECT id
        FROM events_outbox
        WHERE status = 'pending'
          AND available_at <= NOW()
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE events_outbox e
      SET status = 'processing',
          locked_at = NOW(),
          updated_at = NOW()
      FROM next_jobs
      WHERE e.id = next_jobs.id
      RETURNING e.*`,
      [limit],
    );

    return toCamelRows(rows);
  },

  async markProcessed(id, db = { query }) {
    await db.query(
      `UPDATE events_outbox
       SET status = 'processed',
           processed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  },

  async markFailed(id, errorMessage, db = { query }) {
    await db.query(
      `UPDATE events_outbox
       SET status = 'pending',
           attempts = attempts + 1,
           last_error = $2,
           available_at = NOW() + INTERVAL '30 seconds',
           updated_at = NOW()
       WHERE id = $1`,
      [id, String(errorMessage).slice(0, 1000)],
    );
  },
};
