import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const kycReviewsRepository = {
  async create(review, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO kyc_reviews (
        kyc_case_id, reviewer_id, decision, review_notes, rejection_reason, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
      RETURNING *`,
      [
        review.kycCaseId,
        review.reviewerId || null,
        review.decision,
        review.reviewNotes || null,
        review.rejectionReason || null,
        asJson(review.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByCaseId(caseId, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM kyc_reviews
       WHERE kyc_case_id = $1
       ORDER BY created_at DESC`,
      [caseId],
    );

    return toCamelRows(rows);
  },
};
