-- Migration 009: Add provider column to orders table
--
-- Tracks which broker placed the order.  Defaults to 'upstox' so that all
-- existing rows continue to work without a backfill.
--
-- Run this in the Supabase SQL editor or via `supabase db push`.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'upstox';

COMMENT ON COLUMN orders.provider IS
  'Broker that placed the order. E.g. upstox, zerodha, groww.';

CREATE INDEX IF NOT EXISTS orders_provider_idx ON orders (provider);
CREATE INDEX IF NOT EXISTS orders_user_provider_idx ON orders (user_id, provider);
