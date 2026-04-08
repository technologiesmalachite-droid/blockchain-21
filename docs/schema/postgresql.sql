CREATE TABLE users (
  id UUID PRIMARY KEY,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(32),
  password_hash TEXT NOT NULL,
  full_name VARCHAR(120),
  country VARCHAR(80),
  anti_phishing_code VARCHAR(50),
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  asset VARCHAR(20) NOT NULL,
  balance NUMERIC(24, 8) NOT NULL DEFAULT 0,
  available NUMERIC(24, 8) NOT NULL DEFAULT 0,
  average_cost NUMERIC(24, 8) NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  price NUMERIC(24, 8),
  quantity NUMERIC(24, 8) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  asset VARCHAR(20) NOT NULL,
  network VARCHAR(40),
  amount NUMERIC(24, 8) NOT NULL,
  fee NUMERIC(24, 8) NOT NULL DEFAULT 0,
  address TEXT,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE kyc_submissions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  legal_name VARCHAR(160) NOT NULL,
  dob DATE,
  nationality VARCHAR(80),
  address_line TEXT,
  id_type VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'under_review',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(60) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

