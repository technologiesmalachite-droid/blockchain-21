import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const notificationsRepository = {
  async create({ userId, category, severity = "info", title, message, actionUrl = null, metadata = {} }, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO user_notifications (
        user_id, category, severity, title, message, action_url, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *`,
      [userId, category, severity, title, message, actionUrl, asJson(metadata)],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser({ userId, unreadOnly = false, page = 1, pageSize = 20 }, db = { query }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
    const offset = (safePage - 1) * safePageSize;

    const filters = [`user_id = $1`];

    if (unreadOnly) {
      filters.push("read_at IS NULL");
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const { rows } = await db.query(
      `SELECT * FROM user_notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safePageSize, offset],
    );

    const countRows = await db.query(
      `SELECT COUNT(*)::int AS total FROM user_notifications ${whereClause}`,
      [userId],
    );

    const unreadRows = await db.query(
      `SELECT COUNT(*)::int AS unread FROM user_notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );

    const total = countRows.rows[0]?.total || 0;
    const unreadCount = unreadRows.rows[0]?.unread || 0;

    return {
      items: toCamelRows(rows),
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePageSize)),
      },
      unreadCount,
    };
  },

  async markRead({ userId, notificationId }, db = { query }) {
    const { rows } = await db.query(
      `UPDATE user_notifications
       SET read_at = COALESCE(read_at, NOW()),
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      [notificationId, userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async markAllReadByUser(userId, db = { query }) {
    await db.query(
      `UPDATE user_notifications
       SET read_at = COALESCE(read_at, NOW()),
           updated_at = NOW()
       WHERE user_id = $1
         AND read_at IS NULL`,
      [userId],
    );
  },
};
