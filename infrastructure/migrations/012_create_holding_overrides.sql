-- Migration 012: Stock-Level Strategy Overrides (holding_overrides)
--
-- Allows users to set per-stock goals, target prices, stop-losses,
-- and strategy overrides that personalise signals at the individual
-- holding level — beyond the portfolio-wide investor profile.
--
-- Run in the Supabase SQL editor or via `supabase db push`.

CREATE TABLE IF NOT EXISTS holding_overrides (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument_key          text NOT NULL,
  trading_symbol          text NOT NULL,

  -- Per-stock investment goal
  goal                    text CHECK (goal IN (
    'growth', 'income', 'swing_trade', 'short_term_trade',
    'value_hold', 'sector_bet', 'speculative', 'learning'
  )),
  goal_notes              text,                   -- Free-form notes about this stock's purpose

  -- Price targets & stop-loss
  target_price            numeric,                -- User's target sell price
  stop_loss_price         numeric,                -- User's stop-loss trigger price
  trailing_stop_pct       numeric,                -- Optional trailing stop-loss percentage

  -- Strategy override (overrides portfolio-level preset for this stock)
  strategy_preset_id      uuid REFERENCES strategy_presets(id) ON DELETE SET NULL,
  custom_signal_override  text CHECK (custom_signal_override IN (
    'force_hold', 'force_watch', null            -- User can pin a stock to HOLD or WATCH regardless of score
  )),

  -- Risk & allocation override
  max_allocation_pct      numeric CHECK (max_allocation_pct BETWEEN 1 AND 50),
  risk_note               text,                   -- "High-risk speculative bet" etc.

  -- Time horizon override
  hold_until              date,                   -- "Don't suggest SELL before this date"
  min_hold_months         integer,                -- Minimum holding period override

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- One override per user per instrument
  CONSTRAINT uq_holding_override UNIQUE (user_id, instrument_key)
);

-- Index for fast lookup during scoring
CREATE INDEX IF NOT EXISTS idx_holding_overrides_user
  ON holding_overrides(user_id);

CREATE INDEX IF NOT EXISTS idx_holding_overrides_instrument
  ON holding_overrides(user_id, instrument_key);

-- ── RLS Policies ─────────────────────────────────────────────────────────

ALTER TABLE holding_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own holding overrides"
  ON holding_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holding overrides"
  ON holding_overrides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holding overrides"
  ON holding_overrides FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own holding overrides"
  ON holding_overrides FOR DELETE
  USING (auth.uid() = user_id);
