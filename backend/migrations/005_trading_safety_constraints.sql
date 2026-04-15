-- Trading safety and wallet integrity constraints

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_locked_amount_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_locked_amount_check
      CHECK (locked_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN ('open', 'partially_filled', 'filled', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trades_liquidity_role_check'
  ) THEN
    ALTER TABLE trades
      ADD CONSTRAINT trades_liquidity_role_check
      CHECK (liquidity_role IS NULL OR liquidity_role IN ('maker', 'taker'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_non_negative_balances_check'
  ) THEN
    ALTER TABLE wallets
      ADD CONSTRAINT wallets_non_negative_balances_check
      CHECK (
        total_balance >= 0
        AND available_balance >= 0
        AND locked_balance >= 0
      );
  END IF;
END $$;
