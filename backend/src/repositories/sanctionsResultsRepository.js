import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const sanctionsResultsRepository = {
  async create(result, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO sanctions_results (
        user_id, provider_name, provider_reference, status,
        match_score, watchlists, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
      RETURNING *`,
      [
        result.userId,
        result.providerName,
        result.providerReference || null,
        result.status,
        result.matchScore || 0,
        asJson(result.watchlists || []),
        asJson(result.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async latestForUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM sanctions_results
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );

    return toCamelRows(rows)[0] || null;
  },
};
