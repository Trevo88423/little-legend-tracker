-- Make complete_signup idempotent: skip if user already has a family
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

  -- Check if user already belongs to a family (prevent duplicates)
  SELECT family_id INTO v_existing_family
  FROM family_members WHERE user_id = v_user_id LIMIT 1;

  IF v_existing_family IS NOT NULL THEN
    RETURN json_build_object('success', true, 'family_id', v_existing_family, 'skipped', true);
  END IF;

  v_family_id := gen_random_uuid();
  v_child_id := gen_random_uuid();

  INSERT INTO families (id, name, pin_hash)
  VALUES (v_family_id, p_family_name, crypt(p_pin_input, gen_salt('bf')));

  INSERT INTO family_members (family_id, user_id, display_name, role)
  VALUES (v_family_id, v_user_id, p_display_name, 'owner');

  INSERT INTO children (id, family_id, name, date_of_birth)
  VALUES (v_child_id, v_family_id, p_child_name, p_child_dob);

  INSERT INTO settings (family_id, child_id) VALUES (v_family_id, v_child_id);

  RETURN json_build_object('success', true, 'family_id', v_family_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make complete_join_family idempotent: skip if already a member
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

  -- Check if already a member of this family
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND user_id = v_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

  -- Verify PIN
  SELECT EXISTS (
    SELECT 1 FROM families
    WHERE id = p_family_id AND pin_hash = crypt(p_pin_input, pin_hash)
  ) INTO v_family_exists;

  IF NOT v_family_exists THEN
    RAISE EXCEPTION 'Invalid family PIN';
  END IF;

  INSERT INTO family_members (family_id, user_id, display_name, role)
  VALUES (p_family_id, v_user_id, p_display_name, 'parent');

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
