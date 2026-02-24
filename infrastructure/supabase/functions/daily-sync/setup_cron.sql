select
  cron.schedule(
    'daily-holdings-sync',
    '30 4 * * 1-5', -- 4:30 AM UTC is 10:00 AM IST (Mon-Fri)
    $$
    select
      net.http_post(
          url:='https://YOUR_PROJECT_ID_HERE.supabase.co/functions/v1/daily-sync',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY_HERE"}'::jsonb
      ) as request_id;
    $$
  );
