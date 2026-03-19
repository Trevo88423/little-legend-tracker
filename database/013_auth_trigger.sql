-- Server-side onboarding: auto-complete signup/join when email is confirmed
-- Uses user metadata (set at signUp time) so it works cross-device.

-- 1. complete_signup_from_trigger: same logic as complete_signup but takes user_id param
CREATE OR REPLACE FUNCTION complete_signup_from_trigger(p_user_id UUID, p_meta JSONB)
RETURNS void AS $$
DECLARE
  v_family_id UUID;
  v_child_id UUID;
  v_existing_family UUID;
  v_family_name TEXT;
  v_pin_input TEXT;
  v_display_name TEXT;
  v_child_name TEXT;
  v_child_dob DATE;
BEGIN
  -- Read fields from metadata
  v_family_name := p_meta->>'family_name';
  v_pin_input := p_meta->>'family_pin';
  v_display_name := p_meta->>'display_name';
  v_child_name := p_meta->>'child_name';
  v_child_dob := NULLIF(p_meta->>'child_dob', '')::DATE;

  IF v_family_name IS NULL OR v_pin_input IS NULL OR v_display_name IS NULL OR v_child_name IS NULL THEN
    RAISE WARNING 'complete_signup_from_trigger: missing required metadata fields for user %', p_user_id;
    RETURN;
  END IF;

  -- Idempotent: skip if user already has a family
  SELECT fm.family_id INTO v_existing_family
  FROM public.family_members fm WHERE fm.user_id = p_user_id LIMIT 1;

  IF v_existing_family IS NOT NULL THEN
    RETURN;
  END IF;

  v_family_id := gen_random_uuid();
  v_child_id := gen_random_uuid();

  -- Use cost factor 8 (vs default 10) to keep trigger fast during email verify
  -- PIN is only 6-8 digits so high-cost bcrypt adds no meaningful security
  INSERT INTO public.families (id, name, pin_hash)
  VALUES (v_family_id, v_family_name, extensions.crypt(v_pin_input, extensions.gen_salt('bf', 8)));

  INSERT INTO public.family_members (family_id, user_id, display_name, role)
  VALUES (v_family_id, p_user_id, v_display_name, 'owner');

  INSERT INTO public.children (id, family_id, name, date_of_birth)
  VALUES (v_child_id, v_family_id, v_child_name, v_child_dob);

  INSERT INTO public.settings (family_id, child_id) VALUES (v_family_id, v_child_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- 2. complete_join_from_trigger: finds family by PIN+name and joins
CREATE OR REPLACE FUNCTION complete_join_from_trigger(p_user_id UUID, p_meta JSONB)
RETURNS void AS $$
DECLARE
  v_family_id UUID;
  v_family_name TEXT;
  v_pin_input TEXT;
  v_display_name TEXT;
  v_already_member BOOLEAN;
BEGIN
  v_family_name := p_meta->>'family_name';
  v_pin_input := p_meta->>'family_pin';
  v_display_name := p_meta->>'display_name';

  IF v_family_name IS NULL OR v_pin_input IS NULL OR v_display_name IS NULL THEN
    RAISE WARNING 'complete_join_from_trigger: missing required metadata fields for user %', p_user_id;
    RETURN;
  END IF;

  -- Idempotent: skip if user already in any family
  SELECT EXISTS (
    SELECT 1 FROM public.family_members WHERE user_id = p_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    RETURN;
  END IF;

  -- Find family by PIN + case-insensitive name match (no rate limiting in trigger context)
  SELECT f.id INTO v_family_id
  FROM public.families f
  WHERE f.pin_hash = extensions.crypt(v_pin_input, f.pin_hash)
    AND LOWER(f.name) = LOWER(v_family_name)
  LIMIT 1;

  IF v_family_id IS NULL THEN
    RAISE WARNING 'complete_join_from_trigger: no matching family for user % (name: %)', p_user_id, v_family_name;
    RETURN;
  END IF;

  INSERT INTO public.family_members (family_id, user_id, display_name, role)
  VALUES (v_family_id, p_user_id, v_display_name, 'parent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- 3. handle_new_user: trigger function that dispatches based on metadata flow
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_flow TEXT;
  v_meta JSONB;
BEGIN
  v_meta := NEW.raw_user_meta_data;
  v_flow := v_meta->>'flow';

  -- Only act when frontend sets the flow key (backward-compatible)
  IF v_flow IS NULL THEN
    RETURN NEW;
  END IF;

  -- Wrap in exception handler so auth operations never fail due to trigger errors
  BEGIN
    IF v_flow = 'signup' THEN
      PERFORM public.complete_signup_from_trigger(NEW.id, v_meta);
    ELSIF v_flow = 'join' THEN
      PERFORM public.complete_join_from_trigger(NEW.id, v_meta);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user trigger error for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- 4. Triggers on auth.users
-- Drop first in case re-running migration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

-- Fires on INSERT when email_confirmed_at is already set (no email confirmation needed)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- Fires on UPDATE when email_confirmed_at transitions from NULL to non-NULL
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();
