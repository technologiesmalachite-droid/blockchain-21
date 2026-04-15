import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const kycDocumentsRepository = {
  async create(document, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO kyc_documents (
        user_id, kyc_case_id, document_group, document_side, document_type, original_filename,
        mime_type, file_size_bytes, storage_key, checksum_sha256, encryption_version, status,
        masked_identifier, is_required, reviewed_at, retention_until, deleted_at, deleted_reason, metadata
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19::jsonb
      )
      RETURNING *`,
      [
        document.userId,
        document.kycCaseId || null,
        document.documentGroup,
        document.documentSide,
        document.documentType,
        document.originalFilename || null,
        document.mimeType,
        document.fileSizeBytes,
        document.storageKey,
        document.checksumSha256,
        document.encryptionVersion || "aes-256-gcm:v1",
        document.status || "submitted",
        document.maskedIdentifier || null,
        document.isRequired ?? true,
        document.reviewedAt || null,
        document.retentionUntil || null,
        document.deletedAt || null,
        document.deletedReason || null,
        asJson(document.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async listByUserId(userId, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM kyc_documents
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return toCamelRows(rows);
  },

  async listByCaseId(caseId, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM kyc_documents
       WHERE kyc_case_id = $1
       ORDER BY created_at DESC`,
      [caseId],
    );

    return toCamelRows(rows);
  },

  async findById(id, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM kyc_documents
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return toCamelRows(rows)[0] || null;
  },

  async attachToCase({ userId, caseId }, db = { query }) {
    await db.query(
      `UPDATE kyc_documents
       SET kyc_case_id = $2,
           updated_at = NOW()
       WHERE user_id = $1
         AND kyc_case_id IS NULL`,
      [userId, caseId],
    );
  },

  async updateStatusesByCase(caseId, status, db = { query }) {
    await db.query(
      `UPDATE kyc_documents
       SET status = $2,
           reviewed_at = CASE WHEN $2 IN ('approved', 'rejected', 'needs_resubmission') THEN NOW() ELSE reviewed_at END,
           updated_at = NOW()
       WHERE kyc_case_id = $1
         AND deleted_at IS NULL`,
      [caseId, status],
    );
  },

  async markSupersededByCase(caseId, db = { query }) {
    await db.query(
      `UPDATE kyc_documents
       SET status = 'superseded',
           updated_at = NOW()
       WHERE kyc_case_id = $1
         AND deleted_at IS NULL
         AND status IN ('submitted', 'under_review', 'needs_resubmission')`,
      [caseId],
    );
  },

  async softDeleteById({ id, reason }, db = { query }) {
    const { rows } = await db.query(
      `UPDATE kyc_documents
       SET deleted_at = NOW(),
           deleted_reason = $2,
           status = 'deleted',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, reason || "deleted_by_user"],
    );

    return toCamelRows(rows)[0] || null;
  },

  async listExpiredForPurge(limit = 100, db = { query }) {
    const { rows } = await db.query(
      `SELECT *
       FROM kyc_documents
       WHERE retention_until IS NOT NULL
         AND retention_until < NOW()
         AND status <> 'purged'
       ORDER BY retention_until ASC
       LIMIT $1`,
      [limit],
    );

    return toCamelRows(rows);
  },

  async markPurged(id, db = { query }) {
    await db.query(
      `UPDATE kyc_documents
       SET status = 'purged',
           deleted_at = COALESCE(deleted_at, NOW()),
           deleted_reason = COALESCE(deleted_reason, 'retention_policy_purge'),
           updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  },
};
