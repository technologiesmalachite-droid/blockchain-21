CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  email CITEXT NOT NULL UNIQUE,
  phone VARCHAR(32) UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  country_code CHAR(2) NOT NULL,
  anti_phishing_code VARCHAR(50),
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_backup_code TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  kyc_tier VARCHAR(24) NOT NULL DEFAULT 'none',
  sanctions_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  risk_score INTEGER NOT NULL DEFAULT 0,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_restrictions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  withdrawals_locked BOOLEAN NOT NULL DEFAULT FALSE,
  trading_locked BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  factor_type VARCHAR(40) NOT NULL,
  channel VARCHAR(20),
  destination VARCHAR(255),
  code_hash TEXT,
  secret_encrypted TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  jurisdiction CHAR(2) NOT NULL,
  legal_name VARCHAR(180) NOT NULL,
  dob DATE NOT NULL,
  mobile VARCHAR(32),
  email VARCHAR(255) NOT NULL,
  residential_address TEXT NOT NULL,
  verification_method VARCHAR(80) NOT NULL,
  id_number_masked VARCHAR(80),
  selfie_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  liveness_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  documentary_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  non_documentary_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  address_verification_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  digilocker_reference VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_type VARCHAR(40) NOT NULL,
  jurisdiction CHAR(2) NOT NULL,
  selected_method VARCHAR(80) NOT NULL,
  status VARCHAR(24) NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  sanctions_result VARCHAR(24) NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_note TEXT,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sanctions_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name VARCHAR(120) NOT NULL,
  provider_reference VARCHAR(120),
  status VARCHAR(24) NOT NULL,
  match_score INTEGER NOT NULL DEFAULT 0,
  watchlists JSONB NOT NULL DEFAULT '[]'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_type VARCHAR(40) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  status VARCHAR(20) NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_type VARCHAR(20) NOT NULL,
  asset VARCHAR(20) NOT NULL,
  total_balance NUMERIC(30, 10) NOT NULL DEFAULT 0,
  available_balance NUMERIC(30, 10) NOT NULL DEFAULT 0,
  locked_balance NUMERIC(30, 10) NOT NULL DEFAULT 0,
  average_cost NUMERIC(30, 10) NOT NULL DEFAULT 0,
  custody_wallet_id VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, wallet_type, asset)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  asset VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  amount NUMERIC(30, 10) NOT NULL,
  balance_after NUMERIC(30, 10) NOT NULL,
  reference_type VARCHAR(40) NOT NULL,
  reference_id VARCHAR(120),
  description TEXT,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  asset VARCHAR(20) NOT NULL,
  network VARCHAR(40) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  memo TEXT,
  provider_name VARCHAR(120),
  provider_reference VARCHAR(120),
  expires_at TIMESTAMPTZ,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  transaction_type VARCHAR(30) NOT NULL,
  asset VARCHAR(20) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL,
  network VARCHAR(40),
  amount NUMERIC(30, 10) NOT NULL,
  fee NUMERIC(30, 10) NOT NULL DEFAULT 0,
  destination_address TEXT,
  status VARCHAR(24) NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  asset VARCHAR(20) NOT NULL,
  network VARCHAR(40) NOT NULL,
  amount NUMERIC(30, 10) NOT NULL,
  fee NUMERIC(30, 10) NOT NULL,
  destination_address TEXT NOT NULL,
  provider_name VARCHAR(120),
  provider_reference VARCHAR(120),
  status VARCHAR(24) NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_pairs (
  symbol VARCHAR(20) PRIMARY KEY,
  base_asset VARCHAR(20) NOT NULL,
  quote_asset VARCHAR(20) NOT NULL,
  last_price NUMERIC(30, 10) NOT NULL,
  previous_price NUMERIC(30, 10) NOT NULL,
  high_24h NUMERIC(30, 10) NOT NULL,
  low_24h NUMERIC(30, 10) NOT NULL,
  volume_24h NUMERIC(30, 10) NOT NULL,
  min_order_size NUMERIC(30, 10) NOT NULL,
  price_precision INTEGER NOT NULL DEFAULT 2,
  quantity_precision INTEGER NOT NULL DEFAULT 8,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL REFERENCES market_pairs(symbol),
  side VARCHAR(10) NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL,
  price NUMERIC(30, 10),
  quantity NUMERIC(30, 10) NOT NULL,
  notional NUMERIC(30, 10) NOT NULL,
  fee NUMERIC(30, 10) NOT NULL,
  status VARCHAR(24) NOT NULL,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  price NUMERIC(30, 10) NOT NULL,
  quantity NUMERIC(30, 10) NOT NULL,
  notional NUMERIC(30, 10) NOT NULL,
  fee NUMERIC(30, 10) NOT NULL,
  settlement_wallet_type VARCHAR(20) NOT NULL,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_asset VARCHAR(20) NOT NULL,
  to_asset VARCHAR(20) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL,
  source_amount NUMERIC(30, 10) NOT NULL,
  received_amount NUMERIC(30, 10) NOT NULL,
  price NUMERIC(30, 10) NOT NULL,
  fee NUMERIC(30, 10) NOT NULL,
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL,
  amount NUMERIC(30, 10) NOT NULL,
  fiat_currency CHAR(3) NOT NULL,
  asset VARCHAR(20) NOT NULL,
  payment_method VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL,
  provider_name VARCHAR(120),
  provider_intent_id VARCHAR(120),
  idempotency_key VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(80) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(80) NOT NULL,
  actor_id VARCHAR(120) NOT NULL,
  actor_role VARCHAR(20) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(120) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_created ON refresh_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_factors_user_type ON auth_factors(user_id, factor_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_cases_user_status ON kyc_cases(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_cases_status ON kyc_cases(status, risk_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sanctions_user_created ON sanctions_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_status ON compliance_cases(status, severity, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_user ON compliance_cases(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallets_user_type_asset ON wallets(user_id, wallet_type, asset);
CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON ledger_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON ledger_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user_asset ON deposit_addresses(user_id, asset, network, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type_status ON wallet_transactions(transaction_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON withdrawals(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_symbol_status ON orders(symbol, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user_created ON trades(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversions_user_created ON conversions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user_created ON payment_intents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_provider ON payment_intents(provider_intent_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status ON support_tickets(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action_created ON admin_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_outbox_status_available ON events_outbox(status, available_at);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_withdrawals_idempotency ON withdrawals(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversions_idempotency ON conversions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_intents_idempotency ON payment_intents(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_compliance_cases_idempotency ON compliance_cases(idempotency_key) WHERE idempotency_key IS NOT NULL;
