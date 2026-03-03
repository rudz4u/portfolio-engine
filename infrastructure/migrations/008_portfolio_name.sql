-- Migration 008: Add name and description to portfolios table
-- Allows users to label their portfolios (e.g., "Upstox Long Term", "Short Term Trades")

ALTER TABLE portfolios
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS description text;

-- Backfill: set name from source for existing rows
UPDATE portfolios
SET name = CASE
  WHEN source = 'upstox' THEN 'Upstox Portfolio'
  WHEN source IS NOT NULL THEN initcap(source) || ' Portfolio'
  ELSE 'Default Portfolio'
END
WHERE name IS NULL;
