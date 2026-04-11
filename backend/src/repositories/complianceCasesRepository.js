import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const complianceCasesRepository = {
  async create(record, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO compliance_cases (
        user_id, case_type, severity, status, risk_score, title, description,
        assigned_to, resolution, tags, idempotency_key, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb)
      RETURNING *`,
      [
        record.userId,
        record.caseType,
        record.severity,
        record.status,
        record.riskScore,
        record.title,
        record.description || null,
        record.assignedTo || null,
        record.resolution || null,
        asJson(record.tags || []),
        record.idempotencyKey || null,
        asJson(record.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async findOpenBySignature({ userId, caseType, title }, db = { query }) {
    const { rows } = await db.query(
      `SELECT * FROM compliance_cases
       WHERE user_id = $1
         AND case_type = $2
         AND title = $3
         AND status = 'open'
       LIMIT 1`,
      [userId, caseType, title],
    );

    return toCamelRows(rows)[0] || null;
  },

  async findById(caseId, db = { query }) {
    const { rows } = await db.query(`SELECT * FROM compliance_cases WHERE id = $1 LIMIT 1`, [caseId]);
    return toCamelRows(rows)[0] || null;
  },

  async resolve(caseId, resolution, db = { query }) {
    const { rows } = await db.query(
      `UPDATE compliance_cases
       SET status = 'resolved',
           resolution = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [caseId, resolution || "resolved"],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listAll(db = { query }) {
    const { rows } = await db.query(
      `SELECT c.*, u.email AS user_email, u.full_name AS user_full_name
       FROM compliance_cases c
       LEFT JOIN users u ON u.id = c.user_id
       ORDER BY c.updated_at DESC`,
    );

    return rows.map((row) => {
      const base = toCamelRows([row])[0];
      return {
        ...base,
        user: row.user_email
          ? {
              email: row.user_email,
              fullName: row.user_full_name,
            }
          : null,
      };
    });
  },

  async countOpen(db = { query }) {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS count FROM compliance_cases WHERE status = 'open'`);
    return rows[0]?.count || 0;
  },

  async countOpenHighRisk(db = { query }) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM compliance_cases WHERE status = 'open' AND severity = 'high'`,
    );

    return rows[0]?.count || 0;
  },
};
