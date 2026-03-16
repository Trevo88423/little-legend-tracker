-- Push notification support: subscriptions, notification log, and RPC functions

-- Table: push_subscriptions
-- Stores Web Push API subscription info per user/device/child
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for Edge Function queries: find all subscriptions for a family+child
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_family_child
  ON push_subscriptions(family_id, child_id);

-- Index for cleanup: find subscriptions by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS: users can see their own subscriptions
CREATE POLICY push_subscriptions_select ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- RLS: users can insert their own subscriptions
CREATE POLICY push_subscriptions_insert ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS: users can update their own subscriptions
CREATE POLICY push_subscriptions_update ON push_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

-- RLS: users can delete their own subscriptions
CREATE POLICY push_subscriptions_delete ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());


-- Table: notification_log
-- Deduplication log to prevent sending the same notification twice
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  medication_id TEXT NOT NULL,
  med_time TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('early', 'due', 'late')),
  notification_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, child_id, medication_id, med_time, notification_type, notification_date)
);

-- Index for cleanup: delete old entries
CREATE INDEX IF NOT EXISTS idx_notification_log_date
  ON notification_log(notification_date);

-- Enable RLS
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- RLS: family members can read notification log (Edge Function writes via service_role)
CREATE POLICY notification_log_select ON notification_log
  FOR SELECT USING (user_belongs_to_family(family_id));


-- RPC: upsert_push_subscription
-- Called by the client when subscribing to push notifications.
-- Uses SECURITY DEFINER so auth.uid() is used server-side (not client-passed).
CREATE OR REPLACE FUNCTION upsert_push_subscription(
  p_family_id UUID,
  p_child_id UUID,
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS void AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user belongs to this family
  IF NOT public.user_belongs_to_family(p_family_id) THEN
    RAISE EXCEPTION 'Not a member of this family';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, family_id, child_id, endpoint, p256dh, auth, timezone, updated_at)
  VALUES (v_user_id, p_family_id, p_child_id, p_endpoint, p_p256dh, p_auth, p_timezone, now())
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = v_user_id,
    family_id = p_family_id,
    child_id = p_child_id,
    p256dh = p_p256dh,
    auth = p_auth,
    timezone = p_timezone,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- RPC: remove_push_subscription
-- Called by the client when unsubscribing from push notifications.
CREATE OR REPLACE FUNCTION remove_push_subscription(p_endpoint TEXT)
RETURNS void AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.push_subscriptions
  WHERE endpoint = p_endpoint AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- NOTE: pg_cron job must be set up manually in the Supabase SQL Editor:
--
-- 1. Enable extensions (if not already):
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- 2. Create the cron job (replace YOUR_EDGE_FUNCTION_URL and YOUR_SERVICE_ROLE_KEY):
--   SELECT cron.schedule(
--     'send-medication-notifications',
--     '* * * * *',
--     $$
--     SELECT net.http_post(
--       url := 'YOUR_EDGE_FUNCTION_URL',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
--         'Content-Type', 'application/json'
--       ),
--       body := '{}'::jsonb
--     );
--     $$
--   );
