import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const kycCasesRepository = {
  async create(caseRecord, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO kyc_cases (
        user_id, case_type, jurisdiction, selected_method, status, risk_score,
        sanctions_result, reviewer_id, reviewer_note, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
      RETURNING *`,
      [
        caseRecord.userId,
        caseRecord.caseType,
        caseRecord.jurisdiction,
        caseRecord.selectedMethod,
        caseRecord.status,
        caseRecord.riskScore,
        caseRecord.sanctionsResult,
        caseRecord.reviewerId || null,
        caseRecord.reviewerNote || null,
        caseRecord.idempotencyKey || null,
        asJson(caseRecord.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async findLatestByUser(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM kyc_cases WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listByUser(userId, limit = 10, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM kyc_cases WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );

    return toCamelRows(rows);
  },

  async listPending(db = { query }) {
    const { rows } = await db.query(
      `SELECT c.*, u.email AS user_email, u.full_name AS user_full_name
       FROM kyc_cases c
       JOIN users u ON u.id = c.user_id
       WHERE c.status IN ('pending', 'under_review')
       ORDER BY c.updated_at DESC`,
    );

    return rows.map((row) => ({
      ...toCamelRows([row])[0],
      user: {
        email: row.user_email,
        fullName: row.user_full_name,
      },
    }));
  },

  async findById(caseId, db = { query }) {
    const { rows } = await db.query(`SELECT * FROM kyc_cases WHERE id = $1 LIMIT 1`, [caseId]);
    return toCamelRows(rows)[0] || null;
  },

  async updateDecision({ caseId, status, reviewerId, reviewerNote }, db = { query }) {
    const { rows } = await db.query(
      `UPDATE kyc_cases
       SET status = $2,
           reviewer_id = $3,
           reviewer_note = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [caseId, status, reviewerId || null, reviewerNote || null],
    );

    return toCamelRows(rows)[0] || null;
  },
};
