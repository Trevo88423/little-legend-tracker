-- Add sex column to children table for WHO percentile growth charts
-- Values: 'male', 'female', 'other' (or NULL = unknown)

-- 1. Add column (nullable so existing rows are unaffected)
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS sex TEXT
  CHECK (sex IS NULL OR sex IN ('male', 'female', 'other'));

-- 2. Update signup trigger to read child_sex from metadata
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
  v_child_sex TEXT;
BEGIN
  v_family_name := p_meta->>'family_name';
  v_pin_input := p_meta->>'family_pin';
  v_display_name := p_meta->>'display_name';
  v_child_name := p_meta->>'child_name';
  v_child_dob := NULLIF(p_meta->>'child_dob', '')::DATE;
  v_child_sex := NULLIF(p_meta->>'child_sex', '');

  -- Validate sex if provided
  IF v_child_sex IS NOT NULL AND v_child_sex NOT IN ('male', 'female', 'other') THEN
    v_child_sex := NULL;
  END IF;

  IF v_family_name IS NULL OR v_pin_input IS NULL OR v_display_name IS NULL OR v_child_name IS NULL THEN
    RAISE WARNING 'complete_signup_from_trigger: missing required metadata fields for user %', p_user_id;
    RETURN;
  END IF;

  SELECT fm.family_id INTO v_existing_family
  FROM public.family_members fm WHERE fm.user_id = p_user_id LIMIT 1;

  IF v_existing_family IS NOT NULL THEN
    RETURN;
  END IF;

  v_family_id := gen_random_uuid();
  v_child_id := gen_random_uuid();

  INSERT INTO public.families (id, name, pin_hash)
  VALUES (v_family_id, v_family_name, extensions.crypt(v_pin_input, extensions.gen_salt('bf', 8)));

  INSERT INTO public.family_members (family_id, user_id, display_name, role)
  VALUES (v_family_id, p_user_id, v_display_name, 'owner');

  INSERT INTO public.children (id, family_id, name, date_of_birth, sex)
  VALUES (v_child_id, v_family_id, v_child_name, v_child_dob, v_child_sex);

  INSERT INTO public.settings (family_id, child_id) VALUES (v_family_id, v_child_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
