-- 003_enable_rls_and_policies.sql
-- Recommended Row-Level Security (RLS) policies for Supabase/Postgres
-- Assumptions:
-- 1) Your Supabase Auth user.id (UUID) is the same as `users.id` in the seeded `users` table.
--    If you seeded a separate users row, you must either:
--      a) create the Auth user with the same UUID, or
--      b) update the `users.id` value to match the Auth user's `id`.
-- 2) Service-role (server) operations should use the SUPABASE_SERVICE_ROLE_KEY.

-- Enable RLS for sensitive tables and add owner-only policies.

-- USERS: restrict read/write to the authenticated user owning the row
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_owner_policy" ON users;
CREATE POLICY "users_owner_policy"
  ON users
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- PORTFOLIOS: only owners can read/write their portfolios
ALTER TABLE IF EXISTS portfolios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portfolios_owner_policy" ON portfolios;
CREATE POLICY "portfolios_owner_policy"
  ON portfolios
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- HOLDINGS: only owners (via portfolio) can access holdings
ALTER TABLE IF EXISTS holdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "holdings_owner_via_portfolio" ON holdings;
CREATE POLICY "holdings_owner_via_portfolio"
  ON holdings
  FOR ALL
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- INSTRUMENTS: make instrument data publicly readable but restrict mutations to service role
ALTER TABLE IF EXISTS instruments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instruments_public_select" ON instruments;
CREATE POLICY "instruments_public_select"
  ON instruments
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "instruments_no_mutation_from_clients" ON instruments;
CREATE POLICY "instruments_no_mutation_from_clients"
  ON instruments
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- INDICATORS: public read, no client mutations (exposed via PostgREST)
ALTER TABLE IF EXISTS indicators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "indicators_public_select" ON indicators;
CREATE POLICY "indicators_public_select"
  ON indicators
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "indicators_no_mutation_from_clients" ON indicators;
CREATE POLICY "indicators_no_mutation_from_clients"
  ON indicators
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- COMPOSITE_SCORES: public read, no client mutations
ALTER TABLE IF EXISTS composite_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "composite_scores_public_select" ON composite_scores;
CREATE POLICY "composite_scores_public_select"
  ON composite_scores
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "composite_scores_no_mutation_from_clients" ON composite_scores;
CREATE POLICY "composite_scores_no_mutation_from_clients"
  ON composite_scores
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- API_TOKENS: restrict to service role only (no client access)
ALTER TABLE IF EXISTS api_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_tokens_block_clients" ON api_tokens;
CREATE POLICY "api_tokens_block_clients"
  ON api_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ORDERS: owners only (allow via user_id or portfolio owner)
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- If orders has portfolio_id, allow owners via user_id OR portfolio owner
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'portfolio_id'
  ) THEN
    EXECUTE $cmd$
      DROP POLICY IF EXISTS "orders_owner_policy" ON orders;
      CREATE POLICY "orders_owner_policy"
        ON orders
        FOR ALL
        USING (
          user_id = auth.uid()
          OR portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
        )
        WITH CHECK (
          user_id = auth.uid()
          OR portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
        );
    $cmd$;

  -- Else if orders has only user_id, restrict by user_id
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    EXECUTE $cmd$
      DROP POLICY IF EXISTS "orders_owner_policy" ON orders;
      CREATE POLICY "orders_owner_policy"
        ON orders
        FOR ALL
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    $cmd$;

  -- Otherwise, block client access to orders (no user mapping available)
  ELSE
    EXECUTE $cmd$
      DROP POLICY IF EXISTS "orders_owner_policy" ON orders;
      CREATE POLICY "orders_owner_policy"
        ON orders
        FOR ALL
        USING (false)
        WITH CHECK (false);
    $cmd$;
  END IF;
END
$$;

-- CHAT_HISTORY & ANALYSIS_REPORTS: owners only (assumes user_id column exists)
ALTER TABLE IF EXISTS chat_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_history_owner_policy" ON chat_history;
CREATE POLICY "chat_history_owner_policy"
  ON chat_history
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE IF EXISTS analysis_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analysis_reports_owner_policy" ON analysis_reports;
CREATE POLICY "analysis_reports_owner_policy"
  ON analysis_reports
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notes / Next steps:
-- 1) If you want to allow server-side functions (Edge Functions or backend) to bypass RLS,
--    use the SUPABASE_SERVICE_ROLE_KEY for those operations. The service role bypasses RLS.
-- 2) If you seeded a `users` row manually (see infrastructure/seeds/seed_rudranildas.sql),
--    create the Supabase Auth user with the same UUID or update the seeded row to match the
--    Auth user's `id`. Example to create an Auth user via CLI or API is provided in Docs/ENV.md.
-- 3) To apply these policies locally using `psql`:
--    psql "<POSTGRES_URL>" -f infrastructure/migrations/003_enable_rls_and_policies.sql
-- 4) After applying migrations, test with an authenticated client session to verify RLS.

-- End of file
