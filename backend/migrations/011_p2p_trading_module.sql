CREATE TABLE IF NOT EXISTS p2p_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type VARCHAR(24) NOT NULL,
  label VARCHAR(80) NOT NULL,
  account_name VARCHAR(120) NOT NULL,
  account_number_masked VARCHAR(64),
  upi_id_masked VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p2p_payment_methods_type_check CHECK (method_type IN ('bank_transfer', 'upi', 'manual')),
  CONSTRAINT p2p_payment_methods_masked_value_check CHECK (
    COALESCE(NULLIF(account_number_masked, ''), NULLIF(upi_id_masked, '')) IS NOT NULL
    OR method_type = 'manual'
  )
);

CREATE TABLE IF NOT EXISTS p2p_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trade_type VARCHAR(10) NOT NULL,
  asset_code VARCHAR(20) NOT NULL,
  fiat_currency VARCHAR(10) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL DEFAULT 'funding',
  price_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
  price NUMERIC(30, 10) NOT NULL,
  total_quantity NUMERIC(30, 10) NOT NULL,
  remaining_quantity NUMERIC(30, 10) NOT NULL,
  min_amount NUMERIC(30, 10) NOT NULL,
  max_amount NUMERIC(30, 10) NOT NULL,
  terms TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  auto_cancel_minutes INTEGER NOT NULL DEFAULT 15,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p2p_offers_trade_type_check CHECK (trade_type IN ('buy', 'sell')),
  CONSTRAINT p2p_offers_price_type_check CHECK (price_type IN ('fixed')),
  CONSTRAINT p2p_offers_status_check CHECK (status IN ('ACTIVE', 'PAUSED', 'CLOSED', 'CANCELLED')),
  CONSTRAINT p2p_offers_wallet_type_check CHECK (wallet_type IN ('spot', 'funding')),
  CONSTRAINT p2p_offers_price_positive CHECK (price > 0),
  CONSTRAINT p2p_offers_total_quantity_positive CHECK (total_quantity > 0),
  CONSTRAINT p2p_offers_remaining_quantity_non_negative CHECK (remaining_quantity >= 0),
  CONSTRAINT p2p_offers_remaining_lte_total CHECK (remaining_quantity <= total_quantity),
  CONSTRAINT p2p_offers_amount_bounds_check CHECK (min_amount > 0 AND max_amount >= min_amount),
  CONSTRAINT p2p_offers_auto_cancel_bounds CHECK (auto_cancel_minutes >= 5 AND auto_cancel_minutes <= 120)
);

CREATE TABLE IF NOT EXISTS p2p_offer_payment_methods (
  offer_id UUID NOT NULL REFERENCES p2p_offers(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES p2p_payment_methods(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (offer_id, payment_method_id)
);

CREATE TABLE IF NOT EXISTS p2p_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES p2p_offers(id) ON DELETE RESTRICT,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES p2p_payment_methods(id) ON DELETE SET NULL,
  asset_code VARCHAR(20) NOT NULL,
  fiat_currency VARCHAR(10) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL DEFAULT 'funding',
  unit_price NUMERIC(30, 10) NOT NULL,
  crypto_amount NUMERIC(30, 10) NOT NULL,
  fiat_amount NUMERIC(30, 10) NOT NULL,
  status VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  marked_paid_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  dispute_opened_at TIMESTAMPTZ,
  cancel_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p2p_orders_status_check CHECK (status IN ('PENDING_PAYMENT', 'PAID', 'RELEASED', 'CANCELLED', 'DISPUTED', 'EXPIRED')),
  CONSTRAINT p2p_orders_wallet_type_check CHECK (wallet_type IN ('spot', 'funding')),
  CONSTRAINT p2p_orders_unit_price_positive CHECK (unit_price > 0),
  CONSTRAINT p2p_orders_crypto_amount_positive CHECK (crypto_amount > 0),
  CONSTRAINT p2p_orders_fiat_amount_positive CHECK (fiat_amount > 0),
  CONSTRAINT p2p_orders_counterparty_check CHECK (buyer_user_id <> seller_user_id)
);

CREATE TABLE IF NOT EXISTS p2p_escrow_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES p2p_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_type VARCHAR(20) NOT NULL,
  asset_code VARCHAR(20) NOT NULL,
  amount NUMERIC(30, 10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'LOCKED',
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  unlocked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p2p_escrow_status_check CHECK (status IN ('LOCKED', 'RELEASED', 'UNLOCKED')),
  CONSTRAINT p2p_escrow_wallet_type_check CHECK (wallet_type IN ('spot', 'funding')),
  CONSTRAINT p2p_escrow_amount_positive CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS p2p_order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'USER',
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p2p_order_messages_type_check CHECK (message_type IN ('SYSTEM', 'USER')),
  CONSTRAINT p2p_order_messages_body_check CHECK (LENGTH(TRIM(body)) > 0)
);

CREATE TABLE IF NOT EXISTS p2p_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES p2p_orders(id) ON DELETE CASCADE,
  opened_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  reason TEXT NOT NULL,
  resolution_notes TEXT,
  internal_notes TEXT,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p2p_disputes_status_check CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
  CONSTRAINT p2p_disputes_reason_check CHECK (LENGTH(TRIM(reason)) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_p2p_payment_methods_user_active
  ON p2p_payment_methods(user_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p2p_offers_market_lookup
  ON p2p_offers(status, trade_type, asset_code, fiat_currency, price);

CREATE INDEX IF NOT EXISTS idx_p2p_offers_user_status
  ON p2p_offers(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p2p_offer_payment_methods_offer
  ON p2p_offer_payment_methods(offer_id);

CREATE INDEX IF NOT EXISTS idx_p2p_offer_payment_methods_method
  ON p2p_offer_payment_methods(payment_method_id);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_offer
  ON p2p_orders(offer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_buyer
  ON p2p_orders(buyer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_seller
  ON p2p_orders(seller_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_status_expiry
  ON p2p_orders(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_p2p_escrow_status
  ON p2p_escrow_locks(status, locked_at DESC);

CREATE INDEX IF NOT EXISTS idx_p2p_order_messages_order_created
  ON p2p_order_messages(order_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_p2p_disputes_status
  ON p2p_disputes(status, created_at DESC);
