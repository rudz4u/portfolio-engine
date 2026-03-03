-- Schedule daily-email edge function at 4:00 AM UTC (9:30 AM IST) Mon-Fri
-- This runs ~30 minutes before daily-sync so email reflects yesterday's data

select
  cron.schedule(
    'daily-email',
    '0 4 * * 1-5', -- 4:00 AM UTC = 9:30 AM IST (Mon-Fri)
    $$
    select
      net.http_post(
          url:='https://itqbgrmnfsxjbecrymfe.supabase.co/functions/v1/daily-email',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY_HERE"}'::jsonb
      ) as request_id;
    $$
  );
