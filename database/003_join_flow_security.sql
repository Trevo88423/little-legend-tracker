-- Join flow security: require family name as second factor, partner email as fallback
-- 1. Update verify_family_pin to require family_name_input
-- 2. Add confirm_family_by_member_email for PIN+name collision fallback

-- ==================== 1. UPDATE verify_family_pin ====================

-- Drop the old single-param signature so callers must use the new one
DROP FUNCTION IF EXISTS verify_family_pin(TEXT);

-- New signature: requires both PIN and family name
CREATE OR REPLACE FUNCTION verify_family_pin(pin_input TEXT, family_name_input TEXT)
RETURNS TABLE(family_id UUID) AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_recent_attempts INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Count attempts in the last 15 minutes
  SELECT COUNT(*) INTO v_recent_attempts
  FROM pin_attempts
  WHERE user_id = v_user_id AND attempted_at > now() - interval '15 minutes';

  IF v_recent_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many PIN attempts. Please wait 15 minutes before trying again.';
  END IF;

  -- Log this attempt
  INSERT INTO pin_attempts (user_id) VALUES (v_user_id);

  -- Clean up old attempts (older than 1 hour)
  DELETE FROM pin_attempts WHERE attempted_at < now() - interval '1 hour';

  RETURN QUERY
  SELECT f.id
  FROM families f
  WHERE f.pin_hash = crypt(pin_input, f.pin_hash)
    AND LOWER(f.name) = LOWER(family_name_input);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 2. NEW confirm_family_by_member_email ====================

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

  -- Look up user_id from email in auth.users
  SELECT id INTO v_member_user_id
  FROM auth.users
  WHERE email = LOWER(TRIM(p_member_email));

  IF v_member_user_id IS NULL THEN
    RAISE EXCEPTION 'No family member found with that email. Please check and try again.';
  END IF;

  -- Find which of the candidate families has this user as a member
  SELECT fm.family_id INTO v_matched_family_id
  FROM family_members fm
  WHERE fm.user_id = v_member_user_id
    AND fm.family_id = ANY(p_family_ids)
  LIMIT 1;

  IF v_matched_family_id IS NULL THEN
    RAISE EXCEPTION 'No family member found with that email. Please check and try again.';
  END IF;

  RETURN v_matched_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
