CREATE TABLE IF NOT EXISTS wallet_assets (
  asset VARCHAR(20) PRIMARY KEY,
  display_name VARCHAR(60) NOT NULL,
  precision INTEGER NOT NULL DEFAULT 8,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_assets_precision_positive CHECK (precision >= 0 AND precision <= 18)
);

CREATE TABLE IF NOT EXISTS wallet_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  asset VARCHAR(20) NOT NULL,
  network VARCHAR(40) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  memo TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  provider_name VARCHAR(120),
  provider_reference VARCHAR(120),
  expires_at TIMESTAMPTZ,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_addresses_status_check CHECK (status IN ('active', 'expired', 'revoked'))
);

CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  asset VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  amount NUMERIC(30, 10) NOT NULL,
  balance_after NUMERIC(30, 10) NOT NULL,
  entry_type VARCHAR(40) NOT NULL DEFAULT 'wallet',
  reference_type VARCHAR(40) NOT NULL,
  reference_id VARCHAR(120),
  status VARCHAR(24) NOT NULL DEFAULT 'completed',
  description TEXT,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_ledger_direction_check CHECK (direction IN ('credit', 'debit')),
  CONSTRAINT wallet_ledger_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT wallet_ledger_balance_non_negative CHECK (balance_after >= 0)
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  asset VARCHAR(20) NOT NULL,
  network VARCHAR(40) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL,
  amount NUMERIC(30, 10) NOT NULL,
  fee NUMERIC(30, 10) NOT NULL,
  total_debit NUMERIC(30, 10) NOT NULL,
  destination_address TEXT NOT NULL,
  status VARCHAR(24) NOT NULL,
  provider_name VARCHAR(120),
  provider_reference VARCHAR(120),
  risk_score INTEGER NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT withdrawal_requests_amount_positive CHECK (amount > 0),
  CONSTRAINT withdrawal_requests_fee_non_negative CHECK (fee >= 0),
  CONSTRAINT withdrawal_requests_total_debit_positive CHECK (total_debit > 0)
);

CREATE TABLE IF NOT EXISTS deposit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  asset VARCHAR(20) NOT NULL,
  network VARCHAR(40) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL,
  expected_amount NUMERIC(30, 10),
  tx_hash VARCHAR(160),
  source_address TEXT,
  status VARCHAR(24) NOT NULL,
  confirmations_required INTEGER NOT NULL DEFAULT 1,
  confirmations_count INTEGER NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deposit_records_expected_amount_non_negative CHECK (expected_amount IS NULL OR expected_amount >= 0),
  CONSTRAINT deposit_records_confirmations_non_negative CHECK (confirmations_required >= 0 AND confirmations_count >= 0)
);

CREATE TABLE IF NOT EXISTS swap_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  to_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  wallet_type VARCHAR(20) NOT NULL,
  from_asset VARCHAR(20) NOT NULL,
  to_asset VARCHAR(20) NOT NULL,
  from_amount NUMERIC(30, 10) NOT NULL,
  to_amount NUMERIC(30, 10) NOT NULL,
  quoted_rate NUMERIC(30, 10) NOT NULL,
  fee_rate_bps INTEGER NOT NULL DEFAULT 0,
  fee_amount NUMERIC(30, 10) NOT NULL DEFAULT 0,
  slippage_bps INTEGER NOT NULL DEFAULT 0,
  quote_expires_at TIMESTAMPTZ,
  status VARCHAR(24) NOT NULL,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT swap_records_amount_positive CHECK (from_amount > 0 AND to_amount >= 0),
  CONSTRAINT swap_records_fee_non_negative CHECK (fee_amount >= 0)
);

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(160),
  ADD COLUMN IF NOT EXISTS source_address TEXT,
  ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(160),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_wallet_assets_active ON wallet_assets(is_active, asset);
CREATE INDEX IF NOT EXISTS idx_wallet_addresses_user_asset_network ON wallet_addresses(user_id, asset, network, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_addresses_wallet_status ON wallet_addresses(wallet_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_entries_user_created ON wallet_ledger_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_entries_reference ON wallet_ledger_entries(reference_type, reference_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_status ON withdrawal_requests(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_records_user_status ON deposit_records(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_records_tx_hash ON deposit_records(tx_hash);
CREATE INDEX IF NOT EXISTS idx_swap_records_user_status ON swap_records(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_hash ON wallet_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status_created ON wallet_transactions(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_addresses_idempotency ON wallet_addresses(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_withdrawal_requests_idempotency ON withdrawal_requests(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_deposit_records_idempotency ON deposit_records(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_swap_records_idempotency ON swap_records(idempotency_key) WHERE idempotency_key IS NOT NULL;

INSERT INTO wallet_assets (asset, display_name, precision, is_active, metadata)
VALUES
  ('BTC', 'Bitcoin', 8, TRUE, '{"networks":["BTC"]}'::jsonb),
  ('ETH', 'Ethereum', 8, TRUE, '{"networks":["ERC20"]}'::jsonb),
  ('BNB', 'BNB', 8, TRUE, '{"networks":["BEP20"]}'::jsonb),
  ('BCH', 'Bitcoin Cash', 8, TRUE, '{"networks":["BCH"]}'::jsonb),
  ('LTC', 'Litecoin', 8, TRUE, '{"networks":["LTC"]}'::jsonb),
  ('SOL', 'Solana', 8, TRUE, '{"networks":["SOL"]}'::jsonb),
  ('TON', 'Toncoin', 8, TRUE, '{"networks":["TON"]}'::jsonb),
  ('TRON', 'TRON', 6, TRUE, '{"networks":["TRON"]}'::jsonb),
  ('USDC', 'USD Coin', 6, TRUE, '{"networks":["ERC20","SOL","TRC20"]}'::jsonb),
  ('USDT', 'Tether', 6, TRUE, '{"networks":["ERC20","TRC20","BEP20"]}'::jsonb)
ON CONFLICT (asset)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  precision = EXCLUDED.precision,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO wallet_addresses (
  user_id,
  wallet_id,
  asset,
  network,
  wallet_type,
  address,
  memo,
  status,
  is_primary,
  provider_name,
  provider_reference,
  expires_at,
  idempotency_key,
  metadata,
  created_at,
  updated_at
)
SELECT
  d.user_id,
  d.wallet_id,
  d.asset,
  d.network,
  d.wallet_type,
  d.address,
  d.memo,
  CASE WHEN d.expires_at IS NOT NULL AND d.expires_at <= NOW() THEN 'expired' ELSE 'active' END,
  TRUE,
  d.provider_name,
  d.provider_reference,
  d.expires_at,
  d.idempotency_key,
  d.metadata,
  d.created_at,
  d.updated_at
FROM deposit_addresses d
LEFT JOIN wallet_addresses wa
  ON wa.idempotency_key IS NOT DISTINCT FROM d.idempotency_key
WHERE wa.id IS NULL;

INSERT INTO wallet_ledger_entries (
  user_id,
  wallet_id,
  asset,
  direction,
  amount,
  balance_after,
  entry_type,
  reference_type,
  reference_id,
  status,
  description,
  idempotency_key,
  metadata,
  created_at,
  updated_at
)
SELECT
  l.user_id,
  l.wallet_id,
  l.asset,
  l.direction,
  l.amount,
  l.balance_after,
  'wallet',
  l.reference_type,
  l.reference_id,
  'completed',
  l.description,
  l.idempotency_key,
  l.metadata,
  l.created_at,
  l.updated_at
FROM ledger_entries l
LEFT JOIN wallet_ledger_entries wl
  ON wl.idempotency_key IS NOT DISTINCT FROM l.idempotency_key
  AND wl.reference_type = l.reference_type
  AND wl.reference_id IS NOT DISTINCT FROM l.reference_id
WHERE wl.id IS NULL;

INSERT INTO withdrawal_requests (
  user_id,
  wallet_id,
  wallet_transaction_id,
  asset,
  network,
  wallet_type,
  amount,
  fee,
  total_debit,
  destination_address,
  status,
  provider_name,
  provider_reference,
  risk_score,
  idempotency_key,
  metadata,
  created_at,
  updated_at
)
SELECT
  w.user_id,
  COALESCE(t.wallet_id, wallet_lookup.id),
  w.wallet_transaction_id,
  w.asset,
  w.network,
  COALESCE(t.wallet_type, wallet_lookup.wallet_type, 'funding'),
  w.amount,
  w.fee,
  (w.amount + w.fee),
  w.destination_address,
  w.status,
  w.provider_name,
  w.provider_reference,
  w.risk_score,
  w.idempotency_key,
  w.metadata,
  w.created_at,
  w.updated_at
FROM withdrawals w
LEFT JOIN wallet_transactions t ON t.id = w.wallet_transaction_id
LEFT JOIN wallets wallet_lookup
  ON wallet_lookup.user_id = w.user_id
  AND wallet_lookup.asset = w.asset
  AND wallet_lookup.wallet_type = COALESCE(t.wallet_type, 'funding')
LEFT JOIN withdrawal_requests wr
  ON wr.idempotency_key IS NOT DISTINCT FROM w.idempotency_key
WHERE wr.id IS NULL
  AND COALESCE(t.wallet_id, wallet_lookup.id) IS NOT NULL;

INSERT INTO deposit_records (
  user_id,
  wallet_id,
  wallet_transaction_id,
  asset,
  network,
  wallet_type,
  expected_amount,
  tx_hash,
  source_address,
  status,
  confirmations_required,
  confirmations_count,
  idempotency_key,
  metadata,
  created_at,
  updated_at
)
SELECT
  t.user_id,
  COALESCE(t.wallet_id, wallet_lookup.id),
  t.id,
  t.asset,
  COALESCE(t.network, 'unknown'),
  t.wallet_type,
  t.amount,
  t.tx_hash,
  t.source_address,
  t.status,
  1,
  CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END,
  COALESCE(t.idempotency_key, 'deposit_record_' || t.id::text),
  t.metadata,
  t.created_at,
  t.updated_at
FROM wallet_transactions t
LEFT JOIN wallets wallet_lookup
  ON wallet_lookup.user_id = t.user_id
  AND wallet_lookup.asset = t.asset
  AND wallet_lookup.wallet_type = t.wallet_type
LEFT JOIN deposit_records dr
  ON dr.wallet_transaction_id = t.id
WHERE t.transaction_type = 'deposit'
  AND dr.id IS NULL
  AND COALESCE(t.wallet_id, wallet_lookup.id) IS NOT NULL;

INSERT INTO swap_records (
  user_id,
  from_wallet_id,
  to_wallet_id,
  wallet_type,
  from_asset,
  to_asset,
  from_amount,
  to_amount,
  quoted_rate,
  fee_rate_bps,
  fee_amount,
  slippage_bps,
  quote_expires_at,
  status,
  idempotency_key,
  metadata,
  created_at,
  updated_at
)
SELECT
  c.user_id,
  source_wallet.id,
  target_wallet.id,
  c.wallet_type,
  c.from_asset,
  c.to_asset,
  c.source_amount,
  c.received_amount,
  c.price,
  0,
  c.fee,
  0,
  NULL,
  'completed',
  c.idempotency_key,
  c.metadata,
  c.created_at,
  c.updated_at
FROM conversions c
LEFT JOIN wallets source_wallet
  ON source_wallet.user_id = c.user_id
  AND source_wallet.wallet_type = c.wallet_type
  AND source_wallet.asset = c.from_asset
LEFT JOIN wallets target_wallet
  ON target_wallet.user_id = c.user_id
  AND target_wallet.wallet_type = c.wallet_type
  AND target_wallet.asset = c.to_asset
LEFT JOIN swap_records sr
  ON sr.idempotency_key IS NOT DISTINCT FROM c.idempotency_key
WHERE sr.id IS NULL
  AND source_wallet.id IS NOT NULL;
