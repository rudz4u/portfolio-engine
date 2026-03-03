-- Migration 007: Portfolio value snapshots
-- Stores one row per portfolio per day so we can show a portfolio value trend chart.

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  snapshot_date   date NOT NULL,
  total_invested  numeric NOT NULL DEFAULT 0,
  total_value     numeric NOT NULL DEFAULT 0,
  total_pnl       numeric NOT NULL DEFAULT 0,
  pnl_pct         numeric NOT NULL DEFAULT 0,
  holdings_count  integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT portfolio_snapshots_unique UNIQUE (portfolio_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_portfolio_date
  ON portfolio_snapshots(portfolio_id, snapshot_date DESC);

-- RLS: each user sees only their own snapshots
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_snapshots_owner" ON portfolio_snapshots;
CREATE POLICY "portfolio_snapshots_owner"
  ON portfolio_snapshots
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
