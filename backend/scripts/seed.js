import bcrypt from "bcryptjs";
import { pool } from "../src/db/pool.js";

const now = new Date().toISOString();

const ids = {
  trader: "8de17c57-a0a2-4124-bfce-0be57b08f6da",
  admin: "c8f92682-a8b8-40ac-a65e-d988452ea5b0",
  spotUsdt: "efef06bb-9696-45b7-81e0-145e8d09dbb2",
  spotBtc: "80e46322-ea6a-4691-bf38-7d5b07ece704",
  spotEth: "f8d89ed4-95c5-4810-9490-e9c15d8b0e8a",
  spotSol: "3f6797a6-f6d9-4cdc-b7c4-5e19f57a8352",
  fundingUsdt: "cebf42bc-4626-4f6c-b801-4f7f2e24e5ec",
  fundingBtc: "67e38028-c73a-4fbc-a53b-d3ee616df2cd",
};

const marketPairs = [
  ["BTCUSDT", "BTC", "USDT", 68241.22, 67102.14, 68990.44, 66410.33, 84215.22, 0.0001, 2, 4],
  ["ETHUSDT", "ETH", "USDT", 3528.1, 3440.92, 3569.18, 3398.2, 221411.82, 0.001, 2, 4],
  ["SOLUSDT", "SOL", "USDT", 171.55, 166.13, 173.2, 162.1, 534118.54, 0.01, 2, 3],
  ["BNBUSDT", "BNB", "USDT", 612.41, 620.1, 624.4, 606.92, 88431.5, 0.01, 2, 3],
  ["XRPUSDT", "XRP", "USDT", 0.634, 0.609, 0.642, 0.602, 1425119.92, 1, 4, 1],
  ["ADAUSDT", "ADA", "USDT", 0.812, 0.831, 0.839, 0.801, 980124.33, 1, 4, 1],
];

const seed = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("TRUNCATE TABLE events_outbox, admin_audit_logs, support_tickets, payment_intents, conversions, trades, orders, withdrawals, wallet_transactions, deposit_addresses, ledger_entries, wallets, compliance_cases, sanctions_results, kyc_cases, kyc_profiles, auth_factors, refresh_sessions, account_restrictions, users, market_pairs RESTART IDENTITY CASCADE");

    const traderPasswordHash = await bcrypt.hash("DemoTrader123!", 12);
    const adminPasswordHash = await bcrypt.hash("AdminVault123!", 12);

    await client.query(
      `INSERT INTO users (
        id, role, status, email, phone, password_hash, full_name, country_code,
        anti_phishing_code, two_factor_enabled, two_factor_secret, two_factor_backup_code,
        email_verified, phone_verified, kyc_status, kyc_tier, sanctions_status, risk_score,
        terms_accepted_at, privacy_accepted_at, created_at, updated_at
      ) VALUES
      ($1, 'user', 'active', 'trader@malachitex.com', '+1 415 555 0182', $3, 'Aarav Patel', 'US', 'MXLIVE', true, 'LIVETOTPSECRETSAMPLE', '246810', true, true, 'approved', 'enhanced', 'clear', 16, $5, $5, $5, $5),
      ($2, 'admin', 'active', 'admin@malachitex.com', '+1 415 555 0131', $4, 'Mira Chen', 'US', 'VAULT', true, 'ADMINTOTPSECRETSAMPLE', '246810', true, true, 'approved', 'enhanced', 'clear', 8, $5, $5, $5, $5)
      `,
      [ids.trader, ids.admin, traderPasswordHash, adminPasswordHash, now],
    );

    await client.query(
      `INSERT INTO account_restrictions (user_id, frozen, withdrawals_locked, trading_locked, reason, metadata, created_at, updated_at)
       VALUES ($1, false, false, false, null, '{}'::jsonb, $2, $2),
              ($3, false, false, false, null, '{}'::jsonb, $2, $2)`,
      [ids.trader, now, ids.admin],
    );

    for (const pair of marketPairs) {
      await client.query(
        `INSERT INTO market_pairs (
          symbol, base_asset, quote_asset, last_price, previous_price, high_24h, low_24h, volume_24h, min_order_size, price_precision, quantity_precision, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [...pair, now],
      );
    }

    const wallets = [
      [ids.spotUsdt, ids.trader, "spot", "USDT", 18880.12, 18080.12, 800, 1],
      [ids.spotBtc, ids.trader, "spot", "BTC", 0.8462, 0.7462, 0.1, 62110.4],
      [ids.spotEth, ids.trader, "spot", "ETH", 6.182, 6.182, 0, 3194.2],
      [ids.spotSol, ids.trader, "spot", "SOL", 122.4, 118.1, 4.3, 143.88],
      [ids.fundingUsdt, ids.trader, "funding", "USDT", 5970, 5970, 0, 1],
      [ids.fundingBtc, ids.trader, "funding", "BTC", 0.05, 0.05, 0, 63990],
    ];

    for (const wallet of wallets) {
      await client.query(
        `INSERT INTO wallets (id, user_id, wallet_type, asset, total_balance, available_balance, locked_balance, average_cost, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
        [...wallet, now],
      );

      await client.query(
        `INSERT INTO ledger_entries (
          user_id, wallet_id, asset, direction, amount, balance_after, reference_type, reference_id, description, idempotency_key, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, 'credit', $4, $4, 'seed_balance', $2::text, $5, $6, '{}'::jsonb, $7, $7)`,
        [ids.trader, wallet[0], wallet[3], wallet[4], `Initial ${wallet[2]} wallet funding`, `seed_${wallet[0]}`, now],
      );
    }

    await client.query(
      `INSERT INTO kyc_profiles (
        user_id, jurisdiction, legal_name, dob, mobile, email, residential_address,
        verification_method, id_number_masked, selfie_status, liveness_status, documentary_status,
        non_documentary_status, address_verification_status, digilocker_reference, metadata, created_at, updated_at
      ) VALUES (
        $1, 'US', 'Aarav Patel', '1994-04-12', '+1 415 555 0182', 'trader@malachitex.com',
        '1700 Market St, San Francisco, CA', 'driver_license', '**-**-1482', 'passed', 'passed', 'passed',
        'passed', 'passed', null, '{}'::jsonb, $2, $2
      )`,
      [ids.trader, now],
    );

    await client.query(
      `INSERT INTO kyc_cases (
        user_id, case_type, jurisdiction, selected_method, status, risk_score, sanctions_result,
        reviewer_id, reviewer_note, idempotency_key, metadata, created_at, updated_at
      ) VALUES (
        $1, 'submission', 'US', 'driver_license', 'approved', 16, 'clear', $2,
        'Documents valid, no adverse watchlist findings.', 'seed_kyc_case', '{}'::jsonb, $3, $3
      )`,
      [ids.trader, ids.admin, now],
    );

    await client.query(
      `INSERT INTO sanctions_results (
        user_id, provider_name, provider_reference, status, match_score, watchlists, metadata, created_at, updated_at
      ) VALUES ($1, 'mock_sanctions_provider', 'san_seed_ref', 'clear', 7, '[]'::jsonb, '{}'::jsonb, $2, $2)`,
      [ids.trader, now],
    );

    await client.query(
      `INSERT INTO compliance_cases (
        user_id, case_type, severity, status, risk_score, title, description,
        assigned_to, resolution, tags, idempotency_key, metadata, created_at, updated_at
      ) VALUES (
        $1, 'transaction_monitoring', 'medium', 'open', 41,
        'Withdrawal velocity check',
        'Multiple withdrawal attempts detected in a 24 hour window.',
        $2, null, '["velocity","withdrawal"]'::jsonb, 'seed_compliance_case', '{}'::jsonb, $3, $3
      )`,
      [ids.trader, ids.admin, now],
    );

    const walletTxResult = await client.query(
      `INSERT INTO wallet_transactions (
        user_id, wallet_id, transaction_type, asset, wallet_type, network, amount, fee, destination_address,
        status, risk_score, idempotency_key, metadata, created_at, updated_at
      ) VALUES
      ($1, $2, 'deposit', 'USDT', 'funding', 'TRC20', 5000, 0, 'TQ1yLiveAddress', 'completed', 6, 'seed_deposit_tx', '{}'::jsonb, $4, $4),
      ($1, $3, 'wallet_transfer', 'USDT', 'spot', 'internal', 1000, 0, 'Funding to Spot', 'completed', 4, 'seed_transfer_tx', '{}'::jsonb, $4, $4),
      ($1, $3, 'withdrawal', 'BTC', 'spot', 'Bitcoin', 0.05, 0.0002, 'bc1qliveaddress', 'processing', 31, 'seed_withdrawal_tx', '{}'::jsonb, $4, $4)
      RETURNING id, transaction_type`,
      [ids.trader, ids.fundingUsdt, ids.spotUsdt, now],
    );

    const withdrawalTx = walletTxResult.rows.find((row) => row.transaction_type === "withdrawal")?.id || null;

    await client.query(
      `INSERT INTO withdrawals (
        user_id, wallet_transaction_id, asset, network, amount, fee, destination_address, provider_name,
        provider_reference, status, risk_score, idempotency_key, metadata, created_at, updated_at
      ) VALUES ($1, $2, 'BTC', 'Bitcoin', 0.05, 0.0002, 'bc1qliveaddress', 'mock_custody', 'wd_seed_ref', 'processing', 31, 'seed_withdrawal', '{}'::jsonb, $3, $3)`,
      [ids.trader, withdrawalTx, now],
    );

    const orderResult = await client.query(
      `INSERT INTO orders (
        user_id, symbol, side, order_type, wallet_type, price, quantity, notional, fee, status, idempotency_key, metadata, created_at, updated_at
      ) VALUES
      ($1, 'BTCUSDT', 'buy', 'limit', 'spot', 67500, 0.12, 8100, 8.1, 'open', 'seed_order_open', '{}'::jsonb, $2, $2),
      ($1, 'ETHUSDT', 'sell', 'limit', 'spot', 3610, 1.5, 5415, 5.41, 'partially_filled', 'seed_order_partial', '{}'::jsonb, $2, $2)
      RETURNING id`,
      [ids.trader, now],
    );

    await client.query(
      `INSERT INTO trades (
        order_id, user_id, symbol, side, order_type, price, quantity, notional, fee, settlement_wallet_type, idempotency_key, metadata, created_at, updated_at
      ) VALUES
      ($1, $3, 'BTCUSDT', 'buy', 'market', 66421.55, 0.09, 5977.94, 5.98, 'spot', 'seed_trade_1', '{}'::jsonb, $2, $2),
      ($1, $3, 'SOLUSDT', 'buy', 'market', 160.12, 25, 4003, 4, 'spot', 'seed_trade_2', '{}'::jsonb, $2, $2)
      `,
      [orderResult.rows[0]?.id || null, now, ids.trader],
    );

    await client.query(
      `INSERT INTO support_tickets (
        user_id, subject, category, priority, status, message, metadata, created_at, updated_at
      ) VALUES (
        $1, 'Withdrawal confirmation delay', 'Wallet', 'high', 'open',
        'Please confirm whether the BTC withdrawal is awaiting review.', '{}'::jsonb, $2, $2
      )`,
      [ids.trader, now],
    );

    await client.query(
      `INSERT INTO admin_audit_logs (action, actor_id, actor_role, resource_type, resource_id, metadata, created_at, updated_at)
       VALUES
       ('platform_bootstrap', 'system', 'system', 'platform', 'boot', '{"environment":"development"}'::jsonb, $1, $1),
       ('seed_completed', 'system', 'system', 'database', 'seed', '{}'::jsonb, $1, $1)
      `,
      [now],
    );

    await client.query("COMMIT");
    console.log("Seed data applied.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed", error);
    throw error;
  } finally {
    client.release();
  }
};

seed()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
