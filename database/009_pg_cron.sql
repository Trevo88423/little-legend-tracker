-- Enable pg_cron and pg_net extensions for scheduled Edge Function invocation
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule send-notifications Edge Function to run every minute
-- This checks for medications due and sends push notifications
SELECT cron.schedule(
  'send-medication-notifications',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sambxyadqbwqiurfwrxk.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWJ4eWFkcWJ3cWl1cmZ3cnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU2MTg1MiwiZXhwIjoyMDg5MTM3ODUyfQ.r6ggF-1tRgGlNS5i5_4rDurppBKpOiJg21FlkZ0qazQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
