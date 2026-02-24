-- Migration: Create indicators and composite_scores tables
-- Run with: `psql` or `supabase db push` / `supabase db remote set` then `supabase db push`

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Indicators table: per-instrument per-date technical indicators
CREATE TABLE IF NOT EXISTS indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_key text NOT NULL,
  date date NOT NULL,
  rsi numeric,
  sma_50 numeric,
  ema_12 numeric,
  macd numeric,
  atr_14 numeric,
  beta numeric,
  source text,
  raw jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT indicators_unique UNIQUE (instrument_key, date)
);
CREATE INDEX IF NOT EXISTS idx_indicators_instrument_key ON indicators(instrument_key);
CREATE INDEX IF NOT EXISTS idx_indicators_date ON indicators(date);

-- Composite scores table: final composite score per instrument per date
CREATE TABLE IF NOT EXISTS composite_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_key text NOT NULL,
  date date NOT NULL,
  score numeric NOT NULL,
  components jsonb NOT NULL, -- normalized component values and weights
  calculated_by text, -- e.g. 'quant-engine-v1'
  created_at timestamptz DEFAULT now(),
  CONSTRAINT composite_scores_unique UNIQUE (instrument_key, date)
);
CREATE INDEX IF NOT EXISTS idx_composite_scores_score_date ON composite_scores(date, score DESC);
CREATE INDEX IF NOT EXISTS idx_composite_scores_instrument_key ON composite_scores(instrument_key);

-- Guidance: apply Row-Level Security in Supabase to tie ownership to users.
COMMENT ON TABLE indicators IS 'Indicators table: computed by Quant Engine. Apply RLS to restrict rows by user ownership via instruments/portfolios mapping.';
COMMENT ON TABLE composite_scores IS 'Composite scores computed per instrument per date. components JSON should include normalized metrics and the weight breakdown.';
