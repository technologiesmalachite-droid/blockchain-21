import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

const normalizeMethodType = (value) => String(value || "").trim().toLowerCase();

export const p2pPaymentMethodsRepository = {
  async listByUser(userId, { includeInactive = false } = {}, db = { query }) {
    const whereActive = includeInactive ? "" : "AND is_active = TRUE";
    const { rows } = await db.query(
      `SELECT *
       FROM p2p_payment_methods
       WHERE user_id = $1
       ${whereActive}
       ORDER BY created_at DESC`,
      [userId],
    );

    return toCamelRows(rows);
  },

  async findByIdForUser(id, userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM p2p_payment_methods
       WHERE id = $1
         AND user_id = $2
       LIMIT 1`,
      [id, userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findManyByIdsForUser({ userId, ids, requireActive = true }, db = { query }) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const whereActive = requireActive ? "AND is_active = TRUE" : "";
    const { rows } = await db.query(
      `SELECT *
       FROM p2p_payment_methods
       WHERE user_id = $1
         AND id = ANY($2::uuid[])
         ${whereActive}`,
      [userId, ids],
    );

    return toCamelRows(rows);
  },

  async create(
    {
      userId,
      methodType,
      label,
      accountName,
      accountNumberMasked,
      upiIdMasked,
      metadata = {},
      isActive = true,
      createdBy,
      updatedBy,
    },
    db = { query },
  ) {
    const { rows } = await db.query(
      `INSERT INTO p2p_payment_methods (
        user_id,
        method_type,
        label,
        account_name,
        account_number_masked,
        upi_id_masked,
        metadata,
        is_active,
        created_by,
        updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
      RETURNING *`,
      [
        userId,
        normalizeMethodType(methodType),
        label,
        accountName,
        accountNumberMasked || null,
        upiIdMasked || null,
        asJson(metadata),
        Boolean(isActive),
        createdBy || userId,
        updatedBy || userId,
      ],
    );

    return toCamelRows(rows)[0];
  },

  async updateByIdForUser(
    id,
    userId,
    {
      methodType,
      label,
      accountName,
      accountNumberMasked,
      upiIdMasked,
      metadata,
      isActive,
      updatedBy,
    },
    db = { query },
  ) {
    const { rows } = await db.query(
      `UPDATE p2p_payment_methods
       SET method_type = COALESCE($3, method_type),
           label = COALESCE($4, label),
           account_name = COALESCE($5, account_name),
           account_number_masked = COALESCE($6, account_number_masked),
           upi_id_masked = COALESCE($7, upi_id_masked),
           metadata = p2p_payment_methods.metadata || $8::jsonb,
           is_active = COALESCE($9, is_active),
           updated_by = COALESCE($10, updated_by),
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      [
        id,
        userId,
        methodType ? normalizeMethodType(methodType) : null,
        label || null,
        accountName || null,
        accountNumberMasked || null,
        upiIdMasked || null,
        asJson(metadata || {}),
        isActive === undefined ? null : Boolean(isActive),
        updatedBy || userId,
      ],
    );

    return toCamelRows(rows)[0] || null;
  },

  async deactivateByIdForUser(id, userId, updatedBy, db = { query }) {
    const { rows } = await db.query(
      `UPDATE p2p_payment_methods
       SET is_active = FALSE,
           updated_by = COALESCE($3, updated_by),
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      [id, userId, updatedBy || userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listByOfferId(offerId, db = { query }) {
    const { rows } = await db.query(
      `SELECT pm.*
       FROM p2p_offer_payment_methods opm
       JOIN p2p_payment_methods pm ON pm.id = opm.payment_method_id
       WHERE opm.offer_id = $1
         AND pm.is_active = TRUE
       ORDER BY pm.created_at DESC`,
      [offerId],
    );

    return toCamelRows(rows);
  },
};
