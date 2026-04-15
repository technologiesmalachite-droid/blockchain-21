-- Trade fee and liquidity role metadata for matching engine accounting

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS fee_asset VARCHAR(20),
  ADD COLUMN IF NOT EXISTS liquidity_role VARCHAR(16);

UPDATE trades
SET fee_asset = CASE
  WHEN symbol LIKE '%/%' THEN split_part(symbol, '/', 1)
  ELSE REGEXP_REPLACE(symbol, '^[A-Z0-9]+?(USDT|USD|BTC|ETH|BNB|FDUSD|TRY|EUR|BRL)$', '\1')
END
WHERE fee_asset IS NULL;

CREATE INDEX IF NOT EXISTS idx_trades_fee_asset_created
  ON trades(fee_asset, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trades_liquidity_role_created
  ON trades(liquidity_role, created_at DESC);
