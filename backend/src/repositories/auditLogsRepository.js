import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const auditLogsRepository = {
  async create({ action, actorId, actorRole, resourceType, resourceId, metadata = {} }, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO admin_audit_logs (
        action, actor_id, actor_role, resource_type, resource_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING *`,
      [action, String(actorId), actorRole, resourceType, String(resourceId), asJson(metadata)],
    );

    return toCamelRows(rows)[0];
  },

  async listRecent(limit = 200, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );

    return toCamelRows(rows);
  },

  async listForUserKyc(userId, limit = 20, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM admin_audit_logs
       WHERE resource_id = $1
         AND action LIKE 'kyc_%'
       ORDER BY created_at DESC
       LIMIT $2`,
      [String(userId), limit],
    );

    return toCamelRows(rows);
  },
};
