import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const paymentIntentsRepository = {
  async create(intent, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO payment_intents (
        user_id, direction, amount, fiat_currency, asset, payment_method,
        status, provider_name, provider_intent_id, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
      RETURNING *`,
      [
        intent.userId,
        intent.direction,
        intent.amount,
        intent.fiatCurrency,
        intent.asset,
        intent.paymentMethod,
        intent.status,
        intent.providerName || null,
        intent.providerIntentId || null,
        intent.idempotencyKey || null,
        asJson(intent.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUser(userId, isAdmin = false, db = { query }) {
    const { rows } = await db.query(
      isAdmin
        ? `SELECT * FROM payment_intents ORDER BY created_at DESC`
        : `SELECT * FROM payment_intents WHERE user_id = $1 ORDER BY created_at DESC`,
      isAdmin ? [] : [userId],
    );

    return toCamelRows(rows);
  },

  async updateByProviderReference(providerIntentId, patch, db = { query }) {
    const updates = [];
    const values = [];
    let index = 1;

    if (patch.status !== undefined) {
      updates.push(`status = $${index}`);
      values.push(patch.status);
      index += 1;
    }

    if (patch.metadata !== undefined) {
      updates.push(`metadata = $${index}::jsonb`);
      values.push(asJson(patch.metadata));
      index += 1;
    }

    if (!updates.length) {
      return null;
    }

    values.push(providerIntentId);

    const { rows } = await db.query(
      `UPDATE payment_intents
       SET ${updates.join(", ")}, updated_at = NOW()
       WHERE provider_intent_id = $${index}
       RETURNING *`,
      values,
    );

    return toCamelRows(rows)[0] || null;
  },
};
