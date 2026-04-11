import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const supportTicketsRepository = {
  async create(ticket, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO support_tickets (
        user_id, subject, category, priority, status, message, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
      RETURNING *`,
      [ticket.userId || null, ticket.subject, ticket.category, ticket.priority, ticket.status || "open", ticket.message, asJson(ticket.metadata)],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, isAdmin = false, db = { query }) {
    const { rows } = await db.query(
      isAdmin
        ? `SELECT * FROM support_tickets ORDER BY created_at DESC`
        : `SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC`,
      isAdmin ? [] : [userId],
    );

    return toCamelRows(rows);
  },

  async countOpen(db = { query }) {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS count FROM support_tickets WHERE status = 'open'`);
    return rows[0]?.count || 0;
  },
};
