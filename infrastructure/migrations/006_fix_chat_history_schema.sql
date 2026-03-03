-- Migration 006: Fix chat_history schema
-- Adds 'reply' column (stored alongside the user message for single-row per exchange)
-- Also fixes the FK to reference auth.users instead of the custom users table,
-- preventing insert failures when auth.uid() != users.id.

-- Add reply column (stores the assistant response)
ALTER TABLE chat_history
  ADD COLUMN IF NOT EXISTS reply text;

-- Drop old FK that referenced custom users table (if it exists)
-- and add a new one referencing auth.users for reliability with Supabase Auth.
-- Supabase's auth.users always has the row; the custom users table may not.
ALTER TABLE chat_history
  DROP CONSTRAINT IF EXISTS chat_history_user_id_fkey;

ALTER TABLE chat_history
  ADD CONSTRAINT chat_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Apply same auth.users FK fix to other affected tables
ALTER TABLE portfolios
  DROP CONSTRAINT IF EXISTS portfolios_user_id_fkey;
ALTER TABLE portfolios
  ADD CONSTRAINT portfolios_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE api_tokens
  DROP CONSTRAINT IF EXISTS api_tokens_user_id_fkey;
ALTER TABLE api_tokens
  ADD CONSTRAINT api_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE analysis_reports
  DROP CONSTRAINT IF EXISTS analysis_reports_user_id_fkey;
ALTER TABLE analysis_reports
  ADD CONSTRAINT analysis_reports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
