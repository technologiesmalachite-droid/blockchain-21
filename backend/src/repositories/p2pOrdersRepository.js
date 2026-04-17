import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

const baseOrderSelect = `
  SELECT
    o.*,
    offer.user_id AS offer_owner_user_id,
    offer.trade_type AS offer_trade_type,
    offer.terms AS offer_terms,
    offer.auto_cancel_minutes,
    offer.payment_methods AS offer_payment_methods,
    buyer.full_name AS buyer_nickname,
    seller.full_name AS seller_nickname,
    pm.method_type AS payment_method_type,
    pm.label AS payment_method_label,
    pm.account_name AS payment_method_account_name,
    pm.account_number_masked AS payment_method_account_number_masked,
    pm.upi_id_masked AS payment_method_upi_id_masked,
    pm.metadata AS payment_method_metadata
  FROM p2p_orders o
  JOIN users buyer ON buyer.id = o.buyer_user_id
  JOIN users seller ON seller.id = o.seller_user_id
  JOIN (
    SELECT
      po.id,
      po.user_id,
      po.trade_type,
      po.terms,
      po.auto_cancel_minutes,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', pm.id,
            'type', pm.method_type,
            'label', pm.label,
            'accountName', pm.account_name,
            'accountNumberMasked', pm.account_number_masked,
            'upiIdMasked', pm.upi_id_masked,
            'isActive', pm.is_active
          ) ORDER BY pm.created_at DESC
        ) FILTER (WHERE pm.id IS NOT NULL),
        '[]'::jsonb
      ) AS payment_methods
    FROM p2p_offers po
    LEFT JOIN p2p_offer_payment_methods opm ON opm.offer_id = po.id
    LEFT JOIN p2p_payment_methods pm ON pm.id = opm.payment_method_id
    GROUP BY po.id
  ) offer ON offer.id = o.offer_id
  LEFT JOIN p2p_payment_methods pm ON pm.id = o.payment_method_id
`;

export const p2pOrdersRepository = {
  async create(
    {
      offerId,
      buyerUserId,
      sellerUserId,
      paymentMethodId,
      assetCode,
      fiatCurrency,
      walletType,
      unitPrice,
      cryptoAmount,
      fiatAmount,
      status,
      expiresAt,
      metadata = {},
      createdBy,
      updatedBy,
    },
    db = { query },
  ) {
    const { rows } = await db.query(
      `INSERT INTO p2p_orders (
        offer_id,
        buyer_user_id,
        seller_user_id,
        payment_method_id,
        asset_code,
        fiat_currency,
        wallet_type,
        unit_price,
        crypto_amount,
        fiat_amount,
        status,
        expires_at,
        metadata,
        created_by,
        updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)
      RETURNING *`,
      [
        offerId,
        buyerUserId,
        sellerUserId,
        paymentMethodId || null,
        String(assetCode || "").toUpperCase(),
        String(fiatCurrency || "").toUpperCase(),
        walletType || "funding",
        unitPrice,
        cryptoAmount,
        fiatAmount,
        status,
        expiresAt,
        asJson(metadata),
        createdBy || buyerUserId,
        updatedBy || buyerUserId,
      ],
    );

    return toCamelRows(rows)[0];
  },

  async findById(orderId, db = { query }) {
    const { rows } = await db.query(
      `${baseOrderSelect}
       WHERE o.id = $1
       LIMIT 1`,
      [orderId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findByIdForUpdate(orderId, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM p2p_orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findByIdForParticipant(orderId, userId, db = { query }) {
    const { rows } = await db.query(
      `${baseOrderSelect}
       WHERE o.id = $1
         AND (o.buyer_user_id = $2 OR o.seller_user_id = $2)
       LIMIT 1`,
      [orderId, userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listByUser(userId, { status, page = 1, pageSize = 20 } = {}, db = { query }) {
    const params = [userId];
    const clauses = ["(o.buyer_user_id = $1 OR o.seller_user_id = $1)"];

    if (status) {
      params.push(status);
      clauses.push(`o.status = $${params.length}`);
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
    const offset = (safePage - 1) * safePageSize;

    params.push(safePageSize, offset);
    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const { rows } = await db.query(
      `${baseOrderSelect}
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params,
    );

    const countParams = params.slice(0, params.length - 2);
    const countRows = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM p2p_orders o
       ${whereClause}`,
      countParams,
    );

    return {
      items: toCamelRows(rows),
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total: countRows.rows[0]?.total || 0,
        totalPages: Math.max(1, Math.ceil((countRows.rows[0]?.total || 0) / safePageSize)),
      },
    };
  },

  async setStatus(
    orderId,
    {
      status,
      markedPaidAt,
      releasedAt,
      cancelledAt,
      disputeOpenedAt,
      cancelReason,
      metadata,
      updatedBy,
    },
    db = { query },
  ) {
    const { rows } = await db.query(
      `UPDATE p2p_orders
       SET status = COALESCE($2, status),
           marked_paid_at = COALESCE($3, marked_paid_at),
           released_at = COALESCE($4, released_at),
           cancelled_at = COALESCE($5, cancelled_at),
           dispute_opened_at = COALESCE($6, dispute_opened_at),
           cancel_reason = COALESCE($7, cancel_reason),
           metadata = p2p_orders.metadata || $8::jsonb,
           updated_by = COALESCE($9, updated_by),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        orderId,
        status || null,
        markedPaidAt || null,
        releasedAt || null,
        cancelledAt || null,
        disputeOpenedAt || null,
        cancelReason || null,
        asJson(metadata || {}),
        updatedBy || null,
      ],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listOverduePendingByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM p2p_orders
       WHERE status = 'PENDING_PAYMENT'
         AND expires_at <= NOW()
         AND (buyer_user_id = $1 OR seller_user_id = $1)
       ORDER BY expires_at ASC
       FOR UPDATE SKIP LOCKED`,
      [userId],
    );

    return toCamelRows(rows);
  },
};
