-- Migration 011: Investor Profiles & Strategy Presets
--
-- Creates the investor_profiles and strategy_presets tables to support
-- granular investor profiling, personalized scoring, and strategy management.
--
-- Run in the Supabase SQL editor or via `supabase db push`.

-- ── 1. Custom ENUM types ──────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE investor_type AS ENUM (
    'short_term_trader', 'swing_trader', 'medium_term', 'long_term',
    'sector_specialist', 'value_investor', 'growth_investor', 'income_investor'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_tolerance AS ENUM (
    'very_conservative', 'conservative', 'moderate', 'aggressive', 'very_aggressive'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_capacity AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE decision_style AS ENUM (
    'data_driven', 'fundamental', 'technical', 'hybrid', 'advisory_dependent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rebalance_frequency AS ENUM (
    'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE annual_budget AS ENUM (
    'under_1L', '1L_5L', '5L_15L', '15L_50L', 'above_50L'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. strategy_presets ───────────────────────────────────────────────────
-- System-defined and user-created strategy templates.

CREATE TABLE IF NOT EXISTS strategy_presets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  description           text NOT NULL DEFAULT '',
  investor_types        text[] NOT NULL DEFAULT '{}',
  scoring_weights       jsonb NOT NULL DEFAULT '{"momentum":30,"valuation":25,"position":20,"advisory":25}',
  signal_thresholds     jsonb NOT NULL DEFAULT '{"strong_buy_min":80,"buy_min":65,"hold_min":45,"sell_max":35,"strong_sell_max":20}',
  horizon_filter_months int,
  volatility_tolerance  numeric(4,2) NOT NULL DEFAULT 1.0,
  is_system             boolean NOT NULL DEFAULT true,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE strategy_presets IS 'Strategy templates defining scoring weights, signal thresholds, and filtering rules.';
COMMENT ON COLUMN strategy_presets.investor_types IS 'Array of investor_type values this preset is suitable for.';
COMMENT ON COLUMN strategy_presets.horizon_filter_months IS 'Only consider advisory recs within this horizon window (NULL = no filter).';
COMMENT ON COLUMN strategy_presets.volatility_tolerance IS 'ATR multiplier: 0.5 = conservative, 1.0 = baseline, 2.0 = aggressive.';

CREATE UNIQUE INDEX IF NOT EXISTS strategy_presets_name_idx ON strategy_presets (name) WHERE is_system = true;

-- ── 3. investor_profiles ──────────────────────────────────────────────────
-- One profile per user capturing investment style, risk appetite, and preferences.

CREATE TABLE IF NOT EXISTS investor_profiles (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_type                   investor_type NOT NULL DEFAULT 'medium_term',
  investment_horizon              jsonb NOT NULL DEFAULT '{"default_months":12,"min_months":6,"max_months":24}',
  risk_tolerance                  risk_tolerance NOT NULL DEFAULT 'moderate',
  risk_capacity                   risk_capacity NOT NULL DEFAULT 'medium',
  max_portfolio_drawdown_pct      int NOT NULL DEFAULT 15 CHECK (max_portfolio_drawdown_pct BETWEEN 5 AND 50),
  max_single_stock_allocation_pct int NOT NULL DEFAULT 10 CHECK (max_single_stock_allocation_pct BETWEEN 2 AND 25),
  preferred_sectors               text[] NOT NULL DEFAULT '{}',
  avoided_sectors                 text[] NOT NULL DEFAULT '{}',
  investment_goals                text[] NOT NULL DEFAULT '{}',
  annual_investment_budget        annual_budget,
  experience_level                experience_level NOT NULL DEFAULT 'beginner',
  decision_style                  decision_style NOT NULL DEFAULT 'hybrid',
  rebalance_frequency             rebalance_frequency NOT NULL DEFAULT 'quarterly',
  active_strategy_preset_id       uuid REFERENCES strategy_presets(id) ON DELETE SET NULL,
  custom_overrides                jsonb,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE investor_profiles IS 'Granular investor profile per user — drives personalized scoring, signals, and AI context.';
COMMENT ON COLUMN investor_profiles.investment_horizon IS 'JSON: { default_months, min_months, max_months }';
COMMENT ON COLUMN investor_profiles.custom_overrides IS 'User tweaks on top of the active strategy preset (partial scoring_weights / signal_thresholds).';

CREATE UNIQUE INDEX IF NOT EXISTS investor_profiles_user_idx ON investor_profiles (user_id);
CREATE INDEX IF NOT EXISTS investor_profiles_type_idx ON investor_profiles (investor_type);

-- ── 4. RLS Policies ───────────────────────────────────────────────────────

ALTER TABLE investor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_presets  ENABLE ROW LEVEL SECURITY;

-- investor_profiles: users can only access their own profile

CREATE POLICY "Users can read own investor profile"
  ON investor_profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own investor profile"
  ON investor_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own investor profile"
  ON investor_profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own investor profile"
  ON investor_profiles
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- strategy_presets: all authenticated users can read; only service role can write system presets

CREATE POLICY "All authenticated users can read strategy presets"
  ON strategy_presets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own custom presets"
  ON strategy_presets
  FOR INSERT TO authenticated
  WITH CHECK (is_system = false AND (select auth.uid()) = created_by);

CREATE POLICY "Users can update own custom presets"
  ON strategy_presets
  FOR UPDATE TO authenticated
  USING (is_system = false AND (select auth.uid()) = created_by)
  WITH CHECK (is_system = false AND (select auth.uid()) = created_by);

CREATE POLICY "Users can delete own custom presets"
  ON strategy_presets
  FOR DELETE TO authenticated
  USING (is_system = false AND (select auth.uid()) = created_by);

-- ── 5. Updated_at trigger ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS investor_profiles_updated_at ON investor_profiles;
CREATE TRIGGER investor_profiles_updated_at
  BEFORE UPDATE ON investor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
