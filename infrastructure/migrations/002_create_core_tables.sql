-- Migration: Create core tables (users, instruments, portfolios, holdings, orders, api_tokens, chat_history, analysis_reports)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE,
  email text UNIQUE,
  phone text,
  created_at timestamptz DEFAULT now()
);

-- Instruments
CREATE TABLE IF NOT EXISTS instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_key text UNIQUE,
  trading_symbol text,
  name text,
  exchange text,
  isin text,
  lot_size integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Portfolios
CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  source text,
  meta jsonb,
  fetched_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Holdings
CREATE TABLE IF NOT EXISTS holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE,
  instrument_key text,
  quantity numeric,
  avg_price numeric,
  invested_amount numeric,
  ltp numeric,
  unrealized_pl numeric,
  segment text,
  moving boolean,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  instrument_key text,
  side text,
  quantity numeric,
  price numeric,
  status text,
  external_order_id text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- API tokens
CREATE TABLE IF NOT EXISTS api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  provider text,
  token jsonb,
  encrypted boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Chat history
CREATE TABLE IF NOT EXISTS chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text,
  message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Analysis reports
CREATE TABLE IF NOT EXISTS analysis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  instrument_key text,
  report jsonb,
  created_at timestamptz DEFAULT now()
);
