-- Migration 010: Advisory Intelligence System
--
-- Creates four tables for tracking SEBI-registered advisor recommendations,
-- computing weighted consensus signals, and recording accuracy track records.
--
-- Run in the Supabase SQL editor or via `supabase db push`.

-- ── 1. advisory_sources ───────────────────────────────────────────────────
-- Static configuration for each advisor / research house. Seeded once.

CREATE TABLE IF NOT EXISTS advisory_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,                 -- e.g. "ICICI Securities"
  sebi_reg_no     text,                          -- e.g. "INH000000990"
  website_url     text,                          -- primary scrape URL
  rss_url         text,                          -- optional RSS/XML feed
  tier            int  NOT NULL DEFAULT 3,       -- 1 (highest) → 4 (lowest)
  base_weight     numeric(4,2) NOT NULL DEFAULT 0.65,  -- 0.55–0.85
  active          boolean NOT NULL DEFAULT true,
  scrape_mode     text NOT NULL DEFAULT 'tavily' CHECK (scrape_mode IN ('tavily','fetch','both')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE advisory_sources IS 'SEBI-registered advisory firms tracked by the advisory intelligence system.';
COMMENT ON COLUMN advisory_sources.tier IS '1=premier broker (0.85), 2=major broker (0.75), 3=research portal (0.65), 4=independent (0.55)';
COMMENT ON COLUMN advisory_sources.base_weight IS 'Initial accuracy multiplier (0–1) before track-record adjustment';

CREATE UNIQUE INDEX IF NOT EXISTS advisory_sources_name_idx ON advisory_sources (name);

-- ── 2. advisory_recommendations ──────────────────────────────────────────
-- Individual scraped/extracted signals per stock from each source.

CREATE TABLE IF NOT EXISTS advisory_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid NOT NULL REFERENCES advisory_sources(id) ON DELETE CASCADE,
  trading_symbol  text NOT NULL,           -- NSE symbol e.g. "RELIANCE"
  instrument_key  text,                    -- resolved from instruments table
  signal          text NOT NULL CHECK (signal IN ('BUY','SELL','HOLD','NEUTRAL')),
  target_price    numeric(12,2),
  stop_loss       numeric(12,2),
  horizon         text,                    -- e.g. "3 months", "1 year"
  rationale       text,                    -- LLM-extracted rationale snippet
  source_url      text,                    -- URL where this was found
  published_at    timestamptz,             -- original publish date (best-effort)
  scraped_at      timestamptz NOT NULL DEFAULT now(),
  outcome         text CHECK (outcome IN ('hit_target','hit_stop','expired','pending') OR outcome IS NULL),
  outcome_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE advisory_recommendations IS 'Individual buy/sell/hold signals scraped from advisory sources.';

-- Prevent duplicate signals: same source + symbol + signal + day (UTC).
-- date_trunc on timestamptz is STABLE (timezone-dependent), so we cast to
-- UTC timestamp first — that expression IS immutable and can index correctly.
CREATE UNIQUE INDEX IF NOT EXISTS advisory_recs_dedup_idx
  ON advisory_recommendations (source_id, trading_symbol, signal,
    date_trunc('day', COALESCE(published_at, scraped_at) AT TIME ZONE 'UTC'));

CREATE INDEX IF NOT EXISTS advisory_recs_symbol_idx   ON advisory_recommendations (trading_symbol);
CREATE INDEX IF NOT EXISTS advisory_recs_scraped_idx  ON advisory_recommendations (scraped_at DESC);
CREATE INDEX IF NOT EXISTS advisory_recs_source_idx   ON advisory_recommendations (source_id);

-- ── 3. advisory_consensus ─────────────────────────────────────────────────
-- Aggregated weighted consensus per trading symbol per day.
-- Recomputed by the advisory-scan cron after each scrape run.

CREATE TABLE IF NOT EXISTS advisory_consensus (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_symbol      text NOT NULL,
  instrument_key      text,
  consensus_date      date NOT NULL DEFAULT CURRENT_DATE,
  -- Counts
  buy_count           int  NOT NULL DEFAULT 0,
  sell_count          int  NOT NULL DEFAULT 0,
  hold_count          int  NOT NULL DEFAULT 0,
  neutral_count       int  NOT NULL DEFAULT 0,
  total_sources       int  NOT NULL DEFAULT 0,
  -- Weighted aggregate (0–100 where 0=strong sell, 50=neutral, 100=strong buy)
  weighted_score      numeric(5,2) NOT NULL DEFAULT 50,
  -- Constituent source IDs (array of advisory_sources.id)
  contributing_sources uuid[],
  -- Composite advisory score component (0–25, used by scoring engine)
  advisory_score      int NOT NULL DEFAULT 12,
  -- Human-readable signal: STRONG_BUY / BUY / HOLD / SELL / STRONG_SELL
  consensus_signal    text NOT NULL DEFAULT 'HOLD'
    CHECK (consensus_signal IN ('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL')),
  computed_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE advisory_consensus IS 'Aggregated weighted consensus per stock per day. Recomputed each scan.';

-- One consensus row per symbol per day
CREATE UNIQUE INDEX IF NOT EXISTS advisory_consensus_symbol_date_idx
  ON advisory_consensus (trading_symbol, consensus_date);

CREATE INDEX IF NOT EXISTS advisory_consensus_date_idx    ON advisory_consensus (consensus_date DESC);
CREATE INDEX IF NOT EXISTS advisory_consensus_symbol_idx  ON advisory_consensus (trading_symbol);

-- ── 4. advisory_track_records ─────────────────────────────────────────────
-- Accuracy stats per source, updated nightly by outcome evaluation.

CREATE TABLE IF NOT EXISTS advisory_track_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           uuid NOT NULL REFERENCES advisory_sources(id) ON DELETE CASCADE,
  period_days         int NOT NULL,               -- 7 or 30
  total_calls         int NOT NULL DEFAULT 0,
  hit_target          int NOT NULL DEFAULT 0,
  hit_stop            int NOT NULL DEFAULT 0,
  expired_neutral     int NOT NULL DEFAULT 0,
  accuracy_pct        numeric(5,2),               -- hit_target / (hit_target + hit_stop) * 100
  -- Multiplier applied on top of base_weight (0.5–1.5)
  track_record_multiplier  numeric(4,2) NOT NULL DEFAULT 1.0,
  evaluated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE advisory_track_records IS 'Accuracy track record per advisory source, recalculated nightly.';

CREATE UNIQUE INDEX IF NOT EXISTS advisory_track_records_source_period_idx
  ON advisory_track_records (source_id, period_days);

-- ── 5. RLS — service-role + authenticated users ───────────────────────────
ALTER TABLE advisory_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisory_recommendations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisory_consensus        ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisory_track_records    ENABLE ROW LEVEL SECURITY;

-- advisory_sources: readable by all authenticated users; writable only by service role
CREATE POLICY "advisory_sources_read"  ON advisory_sources  FOR SELECT TO authenticated USING (true);
CREATE POLICY "advisory_sources_write" ON advisory_sources  FOR ALL    USING (auth.role() = 'service_role');

-- advisory_recommendations: read all (authenticated); write service role only
CREATE POLICY "advisory_recs_read"  ON advisory_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "advisory_recs_write" ON advisory_recommendations FOR ALL    USING (auth.role() = 'service_role');

-- advisory_consensus: read all (authenticated); write service role only
CREATE POLICY "advisory_cons_read"  ON advisory_consensus FOR SELECT TO authenticated USING (true);
CREATE POLICY "advisory_cons_write" ON advisory_consensus FOR ALL    USING (auth.role() = 'service_role');

-- advisory_track_records: read all (authenticated); write service role only
CREATE POLICY "advisory_tr_read"  ON advisory_track_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "advisory_tr_write" ON advisory_track_records FOR ALL    USING (auth.role() = 'service_role');
