-- Firebase identity linkage for secure user sync

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128),
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(24) NOT NULL DEFAULT 'local';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_provider_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_auth_provider_check
      CHECK (auth_provider IN ('local', 'email', 'google', 'firebase'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_firebase_uid
  ON users(firebase_uid)
  WHERE firebase_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

