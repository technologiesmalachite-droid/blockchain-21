import { query } from "../db/pool.js";
import { asJson, toCamelRows } from "./helpers.js";

export const kycProfilesRepository = {
  async upsert(profile, db = { query }) {
    const { rows } = await db.query(
      `INSERT INTO kyc_profiles (
        user_id, jurisdiction, legal_name, dob, mobile, email, residential_address,
        verification_method, id_number_masked, selfie_status, liveness_status, documentary_status,
        non_documentary_status, address_verification_status, digilocker_reference, pan_last4,
        id_document_type, consented_at, privacy_notice_version, resubmission_count, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb)
      ON CONFLICT (user_id)
      DO UPDATE SET
        jurisdiction = EXCLUDED.jurisdiction,
        legal_name = EXCLUDED.legal_name,
        dob = EXCLUDED.dob,
        mobile = EXCLUDED.mobile,
        email = EXCLUDED.email,
        residential_address = EXCLUDED.residential_address,
        verification_method = EXCLUDED.verification_method,
        id_number_masked = EXCLUDED.id_number_masked,
        selfie_status = EXCLUDED.selfie_status,
        liveness_status = EXCLUDED.liveness_status,
        documentary_status = EXCLUDED.documentary_status,
        non_documentary_status = EXCLUDED.non_documentary_status,
        address_verification_status = EXCLUDED.address_verification_status,
        digilocker_reference = EXCLUDED.digilocker_reference,
        pan_last4 = EXCLUDED.pan_last4,
        id_document_type = EXCLUDED.id_document_type,
        consented_at = EXCLUDED.consented_at,
        privacy_notice_version = EXCLUDED.privacy_notice_version,
        resubmission_count = EXCLUDED.resubmission_count,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        profile.userId,
        profile.jurisdiction,
        profile.legalName,
        profile.dob,
        profile.mobile || null,
        profile.email,
        profile.residentialAddress,
        profile.verificationMethod,
        profile.idNumberMasked || null,
        profile.selfieStatus,
        profile.livenessStatus,
        profile.documentaryStatus,
        profile.nonDocumentaryStatus,
        profile.addressVerificationStatus,
        profile.digilockerReference || null,
        profile.panLast4 || null,
        profile.idDocumentType || null,
        profile.consentedAt || null,
        profile.privacyNoticeVersion || null,
        profile.resubmissionCount ?? 0,
        asJson(profile.metadata),
      ],
    );

    return toCamelRows(rows)[0];
  },

  async findByUserId(userId, db = { query }) {
    const { rows } = await db.query(`SELECT * FROM kyc_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
    return toCamelRows(rows)[0] || null;
  },

  async incrementResubmissionCount(userId, db = { query }) {
    const { rows } = await db.query(
      `UPDATE kyc_profiles
       SET resubmission_count = COALESCE(resubmission_count, 0) + 1,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId],
    );

    return toCamelRows(rows)[0] || null;
  },
};
