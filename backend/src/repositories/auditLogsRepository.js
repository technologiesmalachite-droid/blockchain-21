import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

const preferredTable = "audit_logs";
const fallbackTable = "admin_audit_logs";

const withFallback = async (executor) => {
  try {
    return await executor(preferredTable);
  } catch (error) {
    if (error?.code !== "42P01") {
      throw error;
    }

    return executor(fallbackTable);
  }
};

export const auditLogsRepository = {
  async create({ action, actorId, actorRole, resourceType, resourceId, metadata = {} }, db = { query }) {
    const { rows } = await withFallback((table) =>
      db.query(
        `INSERT INTO ${table} (
          action, actor_id, actor_role, resource_type, resource_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING *`,
        [action, String(actorId), actorRole, resourceType, String(resourceId), asJson(metadata)],
      ),
    );

    return toCamelRows(rows)[0];
  },

  async listRecent(limit = 200, db = { query }) {
    const { rows } = await withFallback((table) => db.query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT $1`, [limit]));

    return toCamelRows(rows);
  },

  async listForUserKyc(userId, limit = 20, db = { query }) {
    const { rows } = await withFallback((table) =>
      db.query(
        `SELECT * FROM ${table}
         WHERE resource_id = $1
           AND action LIKE 'kyc_%'
         ORDER BY created_at DESC
         LIMIT $2`,
        [String(userId), limit],
      ),
    );

    return toCamelRows(rows);
  },
};
