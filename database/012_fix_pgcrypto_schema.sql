-- Fix: schema-qualify pgcrypto functions (crypt, gen_salt) for SECURITY DEFINER functions
-- with SET search_path = ''. On Supabase, pgcrypto is installed in the 'extensions' schema,
-- so bare crypt()/gen_salt() calls fail when search_path is empty.

-- 1. create_family_with_pin (orphaned but fix anyway)
CREATE OR REPLACE FUNCTION create_family_with_pin(
  family_id UUID,
  family_name TEXT,
  pin_input TEXT
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.families (id, name, pin_hash)
  VALUES (family_id, family_name, extensions.crypt(pin_input, extensions.gen_salt('bf')));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. complete_join_family
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
    WHERE id = p_family_id AND pin_hash = extensions.crypt(p_pin_input, pin_hash)
  ) INTO v_family_exists;

  IF NOT v_family_exists THEN
    RAISE EXCEPTION 'Invalid family PIN';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, display_name, role)
  VALUES (p_family_id, v_user_id, p_display_name, 'parent');

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3. verify_family_pin
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
  WHERE f.pin_hash = extensions.crypt(pin_input, f.pin_hash)
    AND LOWER(f.name) = LOWER(family_name_input);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 4. complete_signup
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
  VALUES (v_family_id, p_family_name, extensions.crypt(p_pin_input, extensions.gen_salt('bf')));

  INSERT INTO public.family_members (family_id, user_id, display_name, role)
  VALUES (v_family_id, v_user_id, p_display_name, 'owner');

  INSERT INTO public.children (id, family_id, name, date_of_birth)
  VALUES (v_child_id, v_family_id, p_child_name, p_child_dob);

  INSERT INTO public.settings (family_id, child_id) VALUES (v_family_id, v_child_id);

  RETURN json_build_object('success', true, 'family_id', v_family_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
