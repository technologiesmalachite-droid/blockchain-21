import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const p2pEscrowLocksRepository = {
  async create(
    {
      orderId,
      userId,
      walletType,
      assetCode,
      amount,
      status = "LOCKED",
      lockedAt,
      releasedAt,
      unlockedAt,
      metadata = {},
    },
    db = { query },
  ) {
    const { rows } = await db.query(
      `INSERT INTO p2p_escrow_locks (
        order_id,
        user_id,
        wallet_type,
        asset_code,
        amount,
        status,
        locked_at,
        released_at,
        unlocked_at,
        metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, NOW()),$8,$9,$10::jsonb)
      RETURNING *`,
      [
        orderId,
        userId,
        walletType,
        String(assetCode || "").toUpperCase(),
        amount,
        status,
        lockedAt || null,
        releasedAt || null,
        unlockedAt || null,
        asJson(metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async findByOrderId(orderId, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM p2p_escrow_locks
       WHERE order_id = $1
       LIMIT 1`,
      [orderId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findByOrderIdForUpdate(orderId, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM p2p_escrow_locks
       WHERE order_id = $1
       FOR UPDATE`,
      [orderId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async updateByOrderId(orderId, { status, releasedAt, unlockedAt, metadata = {} }, db = { query }) {
    const { rows } = await db.query(
      `UPDATE p2p_escrow_locks
       SET status = COALESCE($2, status),
           released_at = COALESCE($3, released_at),
           unlocked_at = COALESCE($4, unlocked_at),
           metadata = p2p_escrow_locks.metadata || $5::jsonb,
           updated_at = NOW()
       WHERE order_id = $1
       RETURNING *`,
      [orderId, status || null, releasedAt || null, unlockedAt || null, asJson(metadata)],
    );

    return toCamelRows(rows)[0] || null;
  },
};
