-- Migration 005: Add display columns to holdings table
-- These are denormalized from raw JSONB for faster querying/display

ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS trading_symbol text,
  ADD COLUMN IF NOT EXISTS company_name   text;

-- Backfill from raw JSONB for existing rows
UPDATE holdings
SET
  trading_symbol = COALESCE(
    raw->>'trading_symbol',
    raw->>'tradingsymbol',
    instrument_key
  ),
  company_name = COALESCE(
    raw->>'company_name',
    raw->>'tradingsymbol',
    instrument_key
  )
WHERE trading_symbol IS NULL;

-- Also ensure instruments table has all required columns
ALTER TABLE instruments
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS segment    text;
