-- Spot matching engine upgrades

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS filled_quantity NUMERIC(30, 10) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_amount NUMERIC(30, 10) NOT NULL DEFAULT 0;

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS buy_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sell_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_id UUID;

CREATE TABLE IF NOT EXISTS order_book (
  symbol VARCHAR(20) PRIMARY KEY REFERENCES market_pairs(symbol) ON DELETE CASCADE,
  bid_price NUMERIC(30, 10),
  ask_price NUMERIC(30, 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_filled_quantity_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_filled_quantity_check
      CHECK (filled_quantity >= 0 AND filled_quantity <= quantity);
  END IF;
END $$;

UPDATE orders
SET filled_quantity = CASE
  WHEN status = 'filled' THEN quantity
  WHEN status = 'partially_filled' THEN GREATEST(filled_quantity, 0)
  ELSE 0
END
WHERE filled_quantity IS NULL OR filled_quantity = 0;

UPDATE orders
SET locked_amount = CASE
  WHEN status IN ('open', 'partially_filled') THEN
    CASE
      WHEN side = 'buy' THEN GREATEST((COALESCE(price, 0) * GREATEST(quantity - filled_quantity, 0)) + (fee * (GREATEST(quantity - filled_quantity, 0) / NULLIF(quantity, 0))), 0)
      WHEN side = 'sell' THEN GREATEST(quantity - filled_quantity, 0)
      ELSE 0
    END
  ELSE 0
END
WHERE locked_amount IS NULL OR locked_amount = 0;

CREATE INDEX IF NOT EXISTS idx_orders_match_buy
  ON orders(symbol, price DESC, created_at ASC)
  WHERE side = 'buy' AND status IN ('open', 'partially_filled') AND order_type = 'limit';

CREATE INDEX IF NOT EXISTS idx_orders_match_sell
  ON orders(symbol, price ASC, created_at ASC)
  WHERE side = 'sell' AND status IN ('open', 'partially_filled') AND order_type = 'limit';

CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trades_symbol_created
  ON trades(symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trades_order_link
  ON trades(buy_order_id, sell_order_id, created_at DESC);
