import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

const marketplaceSelect = `
  SELECT
    o.*,
    u.full_name AS advertiser_nickname,
    COALESCE(stats.total_trades, 0) AS advertiser_total_trades,
    stats.completion_rate AS advertiser_completion_rate,
    COALESCE(pm.payment_methods, '[]'::jsonb) AS payment_methods
  FROM p2p_offers o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS total_trades,
      CASE
        WHEN COUNT(*) FILTER (WHERE po.status IN ('RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED')) = 0 THEN NULL
        ELSE ROUND(
          (
            COUNT(*) FILTER (WHERE po.status = 'RELEASED')::numeric /
            COUNT(*) FILTER (WHERE po.status IN ('RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED'))::numeric
          ) * 100,
          2
        )
      END AS completion_rate
    FROM p2p_orders po
    WHERE po.buyer_user_id = o.user_id OR po.seller_user_id = o.user_id
  ) stats ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', pm.id,
        'type', pm.method_type,
        'label', pm.label,
        'accountName', pm.account_name,
        'accountNumberMasked', pm.account_number_masked,
        'upiIdMasked', pm.upi_id_masked,
        'isActive', pm.is_active
      ) ORDER BY pm.created_at DESC
    ) AS payment_methods
    FROM p2p_offer_payment_methods opm
    JOIN p2p_payment_methods pm ON pm.id = opm.payment_method_id
    WHERE opm.offer_id = o.id
      AND pm.is_active = TRUE
  ) pm ON TRUE
`;

export const p2pOffersRepository = {
  async create(
    {
      userId,
      tradeType,
      assetCode,
      fiatCurrency,
      walletType,
      priceType,
      price,
      totalQuantity,
      remainingQuantity,
      minAmount,
      maxAmount,
      terms,
      status,
      autoCancelMinutes,
      metadata = {},
      createdBy,
      updatedBy,
    },
    db = { query },
  ) {
    const { rows } = await db.query(
      `INSERT INTO p2p_offers (
        user_id,
        trade_type,
        asset_code,
        fiat_currency,
        wallet_type,
        price_type,
        price,
        total_quantity,
        remaining_quantity,
        min_amount,
        max_amount,
        terms,
        status,
        auto_cancel_minutes,
        metadata,
        created_by,
        updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17)
      RETURNING *`,
      [
        userId,
        tradeType,
        String(assetCode || "").toUpperCase(),
        String(fiatCurrency || "").toUpperCase(),
        walletType || "funding",
        priceType || "fixed",
        price,
        totalQuantity,
        remainingQuantity,
        minAmount,
        maxAmount,
        terms || null,
        status || "ACTIVE",
        autoCancelMinutes,
        asJson(metadata),
        createdBy || userId,
        updatedBy || userId,
      ],
    );

    return toCamelRows(rows)[0];
  },

  async attachPaymentMethods(offerId, paymentMethodIds, db = { query }) {
    if (!Array.isArray(paymentMethodIds) || paymentMethodIds.length === 0) {
      return;
    }

    await db.query(
      `INSERT INTO p2p_offer_payment_methods (offer_id, payment_method_id)
       SELECT $1, UNNEST($2::uuid[])
       ON CONFLICT (offer_id, payment_method_id) DO NOTHING`,
      [offerId, paymentMethodIds],
    );
  },

  async replacePaymentMethods(offerId, paymentMethodIds, db = { query }) {
    await db.query(`DELETE FROM p2p_offer_payment_methods WHERE offer_id = $1`, [offerId]);
    await this.attachPaymentMethods(offerId, paymentMethodIds, db);
  },

  async findById(offerId, db = { query }) {
    const { rows } = await db.query(
      `${marketplaceSelect}
       WHERE o.id = $1
       LIMIT 1`,
      [offerId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findByIdForUpdate(offerId, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM p2p_offers
       WHERE id = $1
       FOR UPDATE`,
      [offerId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `${marketplaceSelect}
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId],
    );

    return toCamelRows(rows);
  },

  async listMarketplace(
    {
      requiredTradeType,
      assetCode,
      fiatCurrency,
      paymentMethodType,
      page = 1,
      pageSize = 20,
      excludeUserId,
    },
    db = { query },
  ) {
    const params = [];
    const clauses = ["o.status = 'ACTIVE'", "o.remaining_quantity > 0"];

    params.push(requiredTradeType);
    clauses.push(`o.trade_type = $${params.length}`);

    if (assetCode) {
      params.push(String(assetCode).toUpperCase());
      clauses.push(`o.asset_code = $${params.length}`);
    }

    if (fiatCurrency) {
      params.push(String(fiatCurrency).toUpperCase());
      clauses.push(`o.fiat_currency = $${params.length}`);
    }

    if (excludeUserId) {
      params.push(excludeUserId);
      clauses.push(`o.user_id <> $${params.length}`);
    }

    if (paymentMethodType) {
      params.push(String(paymentMethodType).toLowerCase());
      clauses.push(`EXISTS (
        SELECT 1
        FROM p2p_offer_payment_methods opm_filter
        JOIN p2p_payment_methods pm_filter ON pm_filter.id = opm_filter.payment_method_id
        WHERE opm_filter.offer_id = o.id
          AND pm_filter.is_active = TRUE
          AND pm_filter.method_type = $${params.length}
      )`);
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
    const offset = (safePage - 1) * safePageSize;

    params.push(safePageSize, offset);

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const { rows } = await db.query(
      `${marketplaceSelect}
       ${whereClause}
       ORDER BY o.price ASC, o.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params,
    );

    const countParams = params.slice(0, params.length - 2);
    const countQuery = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM p2p_offers o
       ${whereClause}`,
      countParams,
    );

    return {
      items: toCamelRows(rows),
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total: countQuery.rows[0]?.total || 0,
        totalPages: Math.max(1, Math.ceil((countQuery.rows[0]?.total || 0) / safePageSize)),
      },
    };
  },

  async adjustRemainingQuantity({ offerId, deltaQuantity, updatedBy }, db = { query }) {
    const { rows } = await db.query(
      `UPDATE p2p_offers
       SET remaining_quantity = remaining_quantity + $2,
           status = CASE
             WHEN (remaining_quantity + $2) <= 0 THEN 'CLOSED'
             WHEN status = 'CLOSED' AND (remaining_quantity + $2) > 0 THEN 'ACTIVE'
             ELSE status
           END,
           updated_by = COALESCE($3, updated_by),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [offerId, deltaQuantity, updatedBy || null],
    );

    return toCamelRows(rows)[0] || null;
  },

  async updateStatusForUser(offerId, userId, status, updatedBy, db = { query }) {
    const { rows } = await db.query(
      `UPDATE p2p_offers
       SET status = $3,
           updated_by = COALESCE($4, updated_by),
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      [offerId, userId, status, updatedBy || userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listOfferPaymentMethodIds(offerId, db = { query }) {
    const { rows } = await db.query(
      `SELECT payment_method_id
       FROM p2p_offer_payment_methods
       WHERE offer_id = $1`,
      [offerId],
    );

    return rows.map((row) => row.payment_method_id);
  },
};
