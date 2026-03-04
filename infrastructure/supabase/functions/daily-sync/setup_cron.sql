-- Run this SQL in the Supabase SQL editor to (re)schedule the cron job.
-- Replace <YOUR_SERVICE_ROLE_KEY> with the value from:
--   Supabase Dashboard → Project Settings → API → service_role key

-- Step 1: Enable pg_net extension (required for net.http_post)
-- If this errors, enable it via: Dashboard → Database → Extensions → search "pg_net" → Enable
create extension if not exists pg_net;

-- Step 2: Remove old job if it exists
select cron.unschedule('daily-sync');

-- Step 3: Schedule daily sync + email at 4:30 AM UTC (10:00 AM IST) Mon-Fri
select
  cron.schedule(
    'daily-sync',
    '30 4 * * 1-5',
    $$
    select
      net.http_post(
          url:='https://itqbgrmnfsxjbecrymfe.supabase.co/functions/v1/daily-sync',
          headers:=('{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}')::jsonb,
          body:='{"source":"cron"}'::jsonb
      ) as request_id;
    $$
  );

-- Verify it is registered
select jobid, jobname, schedule, active from cron.job where jobname = 'daily-sync';
