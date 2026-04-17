import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const p2pOrderMessagesRepository = {
  async create({ orderId, senderUserId, messageType = "USER", body, metadata = {}, createdBy }, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO p2p_order_messages (
        order_id,
        sender_user_id,
        message_type,
        body,
        metadata,
        created_by
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)
      RETURNING *`,
      [orderId, senderUserId || null, messageType, body, asJson(metadata), createdBy || senderUserId || null],
    );

    return toCamelRows(rows)[0];
  },

  async listByOrderId(orderId, db = { query }) {
    const { rows } = await db.query(
      `SELECT
         m.*,
         u.full_name AS sender_nickname
       FROM p2p_order_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.order_id = $1
       ORDER BY m.created_at ASC`,
      [orderId],
    );

    return toCamelRows(rows);
  },
};
