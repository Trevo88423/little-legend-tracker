-- ============================================================
-- Onboarding refactor:
--   1. Add user_setup_status table (replaces orphan-detection-via-empty-rows)
--   2. Remove unauthenticated flow:'join' trigger path (security)
--   3. Update complete_signup RPC to accept child_sex
--   4. Add mark_onboarding_complete RPC
--   5. Trigger no longer swallows errors silently — it records last_error
-- ============================================================

-- 1. STATUS TABLE -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_setup_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_setup_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_setup_status_self_read" ON public.user_setup_status;
CREATE POLICY "user_setup_status_self_read" ON public.user_setup_status
  FOR SELECT USING (user_id = auth.uid());

-- No client-side write policy — only SECURITY DEFINER functions can write.

-- 2. BACKFILL ---------------------------------------------------------------
-- Existing users with a family membership are considered onboarded.
INSERT INTO public.user_setup_status (user_id, onboarding_complete)
SELECT DISTINCT fm.user_id, TRUE
FROM public.family_members fm
WHERE fm.user_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET onboarding_complete = TRUE;

-- Also seed a row for any auth user that doesn't have one yet
INSERT INTO public.user_setup_status (user_id, onboarding_complete)
SELECT u.id, FALSE
FROM auth.users u
LEFT JOIN public.user_setup_status s ON s.user_id = u.id
WHERE s.user_id IS NULL;

-- 3. MARK ONBOARDING COMPLETE RPC ------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_onboarding_complete()
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_setup_status (user_id, onboarding_complete, last_error)
  VALUES (auth.uid(), TRUE, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET onboarding_complete = TRUE,
        last_error = NULL,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 4. UPDATED complete_signup RPC (adds child_sex, marks complete) -----------
CREATE OR REPLACE FUNCTION public.complete_signup(
  p_family_name TEXT,
  p_pin_input TEXT,
  p_display_name TEXT,
  p_child_name TEXT,
  p_child_dob DATE DEFAULT NULL,
  p_child_sex TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID;
  v_child_id UUID;
  v_existing_family UUID;
  v_sex TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_pin_input !~ '^[0-9]{6,8}$' THEN
    RAISE EXCEPTION 'PIN must be 6-8 digits';
  END IF;

  -- Validate sex
  v_sex := NULLIF(p_child_sex, '');
  IF v_sex IS NOT NULL AND v_sex NOT IN ('male', 'female', 'other') THEN
    v_sex := NULL;
  END IF;

  -- Idempotent
  SELECT family_id INTO v_existing_family
  FROM public.family_members WHERE user_id = v_user_id LIMIT 1;

  IF v_existing_family IS NOT NULL THEN
    PERFORM public.mark_onboarding_complete();
    RETURN json_build_object('success', true, 'family_id', v_existing_family, 'skipped', true);
  END IF;

  v_family_id := gen_random_uuid();
  v_child_id := gen_random_uuid();

  INSERT INTO public.families (id, name, pin_hash)
  VALUES (v_family_id, p_family_name, extensions.crypt(p_pin_input, extensions.gen_salt('bf', 8)));

  INSERT INTO public.family_members (family_id, user_id, display_name, role)
  VALUES (v_family_id, v_user_id, p_display_name, 'owner');

  INSERT INTO public.children (id, family_id, name, date_of_birth, sex)
  VALUES (v_child_id, v_family_id, p_child_name, p_child_dob, v_sex);

  INSERT INTO public.settings (family_id, child_id) VALUES (v_family_id, v_child_id);

  PERFORM public.mark_onboarding_complete();
  RETURN json_build_object('success', true, 'family_id', v_family_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 5. UPDATED complete_join_family RPC (marks complete on success) -----------
CREATE OR REPLACE FUNCTION public.complete_join_family(
  p_family_id UUID,
  p_display_name TEXT,
  p_pin_input TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_exists BOOLEAN;
  v_already_member BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND user_id = v_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    PERFORM public.mark_onboarding_complete();
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.families
    WHERE id = p_family_id AND pin_hash = extensions.crypt(p_pin_input, pin_hash)
  ) INTO v_family_exists;

  IF NOT v_family_exists THEN
    RAISE EXCEPTION 'Invalid family PIN';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, display_name, role)
  VALUES (p_family_id, v_user_id, p_display_name, 'parent');

  PERFORM public.mark_onboarding_complete();
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 6. NEW handle_new_user TRIGGER --------------------------------------------
-- Changes from 013_auth_trigger.sql:
--   • Always insert user_setup_status row (so frontend can detect orphan state)
--   • REMOVE flow:'join' path entirely (was unauthenticated, bypassed PIN rate limit)
--   • flow:'signup' fast-path kept for backward compat with old form (still sends full metadata)
--   • Failures recorded in user_setup_status.last_error instead of silently swallowed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_flow TEXT;
  v_meta JSONB;
BEGIN
  v_meta := NEW.raw_user_meta_data;
  v_flow := v_meta->>'flow';

  -- Always create the status row
  INSERT INTO public.user_setup_status (user_id, onboarding_complete)
  VALUES (NEW.id, FALSE)
  ON CONFLICT (user_id) DO NOTHING;

  -- Backward-compat: if signup metadata includes the legacy full payload, run
  -- the old fast-path. New signup form sends only display_name so this is skipped.
  -- The flow:'join' branch from migration 013 is INTENTIONALLY REMOVED — joining
  -- now requires an authenticated, rate-limited RPC call.
  IF v_flow = 'signup' AND v_meta ? 'family_pin' AND v_meta ? 'child_name' THEN
    BEGIN
      PERFORM public.complete_signup_from_trigger(NEW.id, v_meta);
      UPDATE public.user_setup_status
        SET onboarding_complete = TRUE, last_error = NULL, updated_at = NOW()
        WHERE user_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.user_setup_status
        SET last_error = SQLERRM, updated_at = NOW()
        WHERE user_id = NEW.id;
      RAISE WARNING 'handle_new_user signup fast-path failed for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Re-bind triggers (definition in 013 still applies; CREATE OR REPLACE above
-- updates the function body that both triggers point at).

-- 7. SAFETY: drop the unauthenticated complete_join_from_trigger entirely ---
-- It's no longer called from anywhere. Removing it prevents future re-use.
DROP FUNCTION IF EXISTS public.complete_join_from_trigger(UUID, JSONB);
