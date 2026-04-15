-- KYC verification expansion for production workflow

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

ALTER TABLE users
  ALTER COLUMN kyc_status SET DEFAULT 'unverified';

UPDATE users
SET kyc_status = 'unverified'
WHERE kyc_status = 'pending'
  AND email_verified = FALSE
  AND phone_verified = FALSE;

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, updated_at)
WHERE email_verified = TRUE
  AND email_verified_at IS NULL;

UPDATE users
SET phone_verified_at = COALESCE(phone_verified_at, updated_at)
WHERE phone_verified = TRUE
  AND phone_verified_at IS NULL;

ALTER TABLE kyc_profiles
  ADD COLUMN IF NOT EXISTS pan_last4 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS id_document_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_notice_version VARCHAR(40),
  ADD COLUMN IF NOT EXISTS resubmission_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE kyc_cases
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  code_hash TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  resend_count INTEGER NOT NULL DEFAULT 0,
  max_resends INTEGER NOT NULL DEFAULT 5,
  cooldown_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_verifications_attempts_check'
  ) THEN
    ALTER TABLE email_verifications
      ADD CONSTRAINT email_verifications_attempts_check
      CHECK (attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_verifications_resends_check'
  ) THEN
    ALTER TABLE email_verifications
      ADD CONSTRAINT email_verifications_resends_check
      CHECK (resend_count >= 0 AND max_resends > 0 AND resend_count <= max_resends);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(32) NOT NULL,
  code_hash TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  resend_count INTEGER NOT NULL DEFAULT 0,
  max_resends INTEGER NOT NULL DEFAULT 5,
  cooldown_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phone_verifications_attempts_check'
  ) THEN
    ALTER TABLE phone_verifications
      ADD CONSTRAINT phone_verifications_attempts_check
      CHECK (attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phone_verifications_resends_check'
  ) THEN
    ALTER TABLE phone_verifications
      ADD CONSTRAINT phone_verifications_resends_check
      CHECK (resend_count >= 0 AND max_resends > 0 AND resend_count <= max_resends);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kyc_case_id UUID REFERENCES kyc_cases(id) ON DELETE SET NULL,
  document_group VARCHAR(40) NOT NULL,
  document_side VARCHAR(20) NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  original_filename VARCHAR(255),
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_key TEXT NOT NULL,
  checksum_sha256 VARCHAR(128) NOT NULL,
  encryption_version VARCHAR(16) NOT NULL DEFAULT 'aes-256-gcm:v1',
  status VARCHAR(24) NOT NULL DEFAULT 'submitted',
  masked_identifier VARCHAR(80),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  reviewed_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id UUID NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  decision VARCHAR(24) NOT NULL,
  review_notes TEXT,
  rejection_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(120) NOT NULL,
  actor_id VARCHAR(120) NOT NULL,
  actor_role VARCHAR(40) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(120) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill from legacy audit table when the new table is empty.
INSERT INTO audit_logs (action, actor_id, actor_role, resource_type, resource_id, metadata, created_at, updated_at)
SELECT action, actor_id, actor_role, resource_type, resource_id, metadata, created_at, updated_at
FROM admin_audit_logs
WHERE NOT EXISTS (SELECT 1 FROM audit_logs LIMIT 1);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_created ON email_verifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verifications_status ON email_verifications(status, expires_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_verifications_active
  ON email_verifications(user_id)
  WHERE consumed_at IS NULL AND status IN ('pending', 'sent');
CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_created ON phone_verifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_status ON phone_verifications(status, expires_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_phone_verifications_active
  ON phone_verifications(user_id)
  WHERE consumed_at IS NULL AND status IN ('pending', 'sent');
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_created ON kyc_documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_case_group ON kyc_documents(kyc_case_id, document_group, status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_retention_status ON kyc_documents(retention_until, status);
CREATE INDEX IF NOT EXISTS idx_kyc_reviews_case_created ON kyc_reviews(kyc_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
