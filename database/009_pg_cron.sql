-- Enable pg_cron and pg_net extensions for scheduled Edge Function invocation
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule send-notifications Edge Function to run every minute
-- This checks for medications due and sends push notifications
-- Run this in the Supabase SQL Editor, replacing the placeholders:
--
-- SELECT cron.schedule(
--   'send-medication-notifications',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'YOUR_EDGE_FUNCTION_URL',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
