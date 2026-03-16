-- Fix Supabase Security Advisor warning: Function Search Path Mutable
-- Adds SET search_path = '' to all SECURITY DEFINER functions to prevent
-- malicious schema shadowing attacks.

-- 1. user_belongs_to_family
CREATE OR REPLACE FUNCTION user_belongs_to_family(fam_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = fam_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

-- 2. create_family_with_pin
CREATE OR REPLACE FUNCTION create_family_with_pin(
  family_id UUID,
  family_name TEXT,
  pin_input TEXT
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.families (id, name, pin_hash)
  VALUES (family_id, family_name, crypt(pin_input, gen_salt('bf')));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3. trim_activity_log (not SECURITY DEFINER but still flagged)
CREATE OR REPLACE FUNCTION trim_activity_log()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.activity_log
  WHERE id IN (
    SELECT id FROM public.activity_log
    WHERE family_id = NEW.family_id AND child_id = NEW.child_id
    ORDER BY timestamp DESC
    OFFSET 500
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 4. complete_join_family
CREATE OR REPLACE FUNCTION complete_join_family(
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
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.families
    WHERE id = p_family_id AND pin_hash = crypt(p_pin_input, pin_hash)
  ) INTO v_family_exists;

  IF NOT v_family_exists THEN
    RAISE EXCEPTION 'Invalid family PIN';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, display_name, role)
  VALUES (p_family_id, v_user_id, p_display_name, 'parent');

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 5. verify_family_pin
CREATE OR REPLACE FUNCTION verify_family_pin(pin_input TEXT, family_name_input TEXT)
RETURNS TABLE(family_id UUID) AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_recent_attempts INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO v_recent_attempts
  FROM public.pin_attempts
  WHERE user_id = v_user_id AND attempted_at > now() - interval '15 minutes';

  IF v_recent_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many PIN attempts. Please wait 15 minutes before trying again.';
  END IF;

  INSERT INTO public.pin_attempts (user_id) VALUES (v_user_id);

  DELETE FROM public.pin_attempts WHERE attempted_at < now() - interval '1 hour';

  RETURN QUERY
  SELECT f.id
  FROM public.families f
  WHERE f.pin_hash = crypt(pin_input, f.pin_hash)
    AND LOWER(f.name) = LOWER(family_name_input);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 6. complete_signup
CREATE OR REPLACE FUNCTION complete_signup(
  p_family_name TEXT,
  p_pin_input TEXT,
  p_display_name TEXT,
  p_child_name TEXT,
  p_child_dob DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID;
  v_child_id UUID;
  v_existing_family UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT fm.family_id INTO v_existing_family
  FROM public.family_members fm WHERE fm.user_id = v_user_id LIMIT 1;

  IF v_existing_family IS NOT NULL THEN
    RETURN json_build_object('success', true, 'family_id', v_existing_family, 'skipped', true);
  END IF;

  v_family_id := gen_random_uuid();
  v_child_id := gen_random_uuid();

  INSERT INTO public.families (id, name, pin_hash)
  VALUES (v_family_id, p_family_name, crypt(p_pin_input, gen_salt('bf')));

  INSERT INTO public.family_members (family_id, user_id, display_name, role)
  VALUES (v_family_id, v_user_id, p_display_name, 'owner');

  INSERT INTO public.children (id, family_id, name, date_of_birth)
  VALUES (v_child_id, v_family_id, p_child_name, p_child_dob);

  INSERT INTO public.settings (family_id, child_id) VALUES (v_family_id, v_child_id);

  RETURN json_build_object('success', true, 'family_id', v_family_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7. confirm_family_by_member_email
CREATE OR REPLACE FUNCTION confirm_family_by_member_email(
  p_family_ids UUID[],
  p_member_email TEXT
)
RETURNS UUID AS $$
DECLARE
  v_member_user_id UUID;
  v_matched_family_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_member_user_id
  FROM auth.users
  WHERE email = LOWER(TRIM(p_member_email));

  IF v_member_user_id IS NULL THEN
    RAISE EXCEPTION 'No family member found with that email. Please check and try again.';
  END IF;

  SELECT fm.family_id INTO v_matched_family_id
  FROM public.family_members fm
  WHERE fm.user_id = v_member_user_id
    AND fm.family_id = ANY(p_family_ids)
  LIMIT 1;

  IF v_matched_family_id IS NULL THEN
    RAISE EXCEPTION 'No family member found with that email. Please check and try again.';
  END IF;

  RETURN v_matched_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
