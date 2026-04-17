import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const p2pDisputesRepository = {
  async findByOrderId(orderId, db = { query }) {
    const { rows } = await db.query(
      `SELECT
         d.*,
         opened.full_name AS opened_by_nickname,
         resolved.full_name AS resolved_by_nickname
       FROM p2p_disputes d
       LEFT JOIN users opened ON opened.id = d.opened_by_user_id
       LEFT JOIN users resolved ON resolved.id = d.resolved_by_user_id
       WHERE d.order_id = $1
       LIMIT 1`,
      [orderId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async create(
    {
      orderId,
      openedByUserId,
      status = "OPEN",
      reason,
      resolutionNotes,
      internalNotes,
      resolvedByUserId,
      metadata = {},
      createdBy,
      updatedBy,
    },
    db = { query },
  ) {
    const { rows } = await db.query(
      `INSERT INTO p2p_disputes (
        order_id,
        opened_by_user_id,
        status,
        reason,
        resolution_notes,
        internal_notes,
        resolved_by_user_id,
        metadata,
        created_by,
        updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
      RETURNING *`,
      [
        orderId,
        openedByUserId,
        status,
        reason,
        resolutionNotes || null,
        internalNotes || null,
        resolvedByUserId || null,
        asJson(metadata),
        createdBy || openedByUserId,
        updatedBy || openedByUserId,
      ],
    );

    return toCamelRows(rows)[0];
  },

  async updateByOrderId(
    orderId,
    { status, resolutionNotes, internalNotes, resolvedByUserId, metadata = {}, updatedBy },
    db = { query },
  ) {
    const { rows } = await db.query(
      `UPDATE p2p_disputes
       SET status = COALESCE($2, status),
           resolution_notes = COALESCE($3, resolution_notes),
           internal_notes = COALESCE($4, internal_notes),
           resolved_by_user_id = COALESCE($5, resolved_by_user_id),
           metadata = p2p_disputes.metadata || $6::jsonb,
           updated_by = COALESCE($7, updated_by),
           updated_at = NOW()
       WHERE order_id = $1
       RETURNING *`,
      [orderId, status || null, resolutionNotes || null, internalNotes || null, resolvedByUserId || null, asJson(metadata), updatedBy || null],
    );

    return toCamelRows(rows)[0] || null;
  },
};
