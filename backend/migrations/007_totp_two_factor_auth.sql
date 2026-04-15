ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMPTZ;

UPDATE users
SET two_factor_enabled_at = COALESCE(two_factor_enabled_at, updated_at, created_at)
WHERE two_factor_enabled = TRUE
  AND two_factor_enabled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_factors_totp_setup_active
  ON auth_factors (user_id, factor_type, consumed_at, expires_at)
  WHERE factor_type = 'totp_setup';

