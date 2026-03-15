-- Security fixes migration
-- 1. RPC functions use auth.uid() instead of accepting user_id parameter
-- 2. pgcrypto extension ensured early
-- 3. Missing UPDATE RLS policies on feeds, notes, trackers, tracker_logs
-- 4. Management RLS policies on families, family_members, children
-- 5. PIN brute-force rate limiting
-- 6. (Client-side only: crypto.randomUUID() replaces Math.random IDs)

-- ==================== 1. ENSURE PGCRYPTO ====================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==================== 2. FIX RPC FUNCTIONS ====================

-- Recreate complete_signup: removes p_user_id, uses auth.uid() instead
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
  v_family_id UUID := gen_random_uuid();
  v_child_id UUID := gen_random_uuid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO families (id, name, pin_hash)
  VALUES (v_family_id, p_family_name, crypt(p_pin_input, gen_salt('bf')));

  INSERT INTO family_members (family_id, user_id, display_name, role)
  VALUES (v_family_id, v_user_id, p_display_name, 'owner');

  INSERT INTO children (id, family_id, name, date_of_birth)
  VALUES (v_child_id, v_family_id, p_child_name, p_child_dob);

  INSERT INTO settings (family_id, child_id, med_alarms, feed_alarms, sound_alerts)
  VALUES (v_family_id, v_child_id, true, false, false);

  RETURN json_build_object('family_id', v_family_id, 'child_id', v_child_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old signature that accepted p_user_id (6 params)
-- This is safe: the new function (5 params) was already created above
DROP FUNCTION IF EXISTS complete_signup(UUID, TEXT, TEXT, TEXT, TEXT, DATE);

-- Recreate complete_join_family: removes p_user_id, uses auth.uid() instead
CREATE OR REPLACE FUNCTION complete_join_family(
  p_family_id UUID,
  p_display_name TEXT,
  p_pin_input TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_exists BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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

-- Drop old signature that accepted p_user_id (4 params)
DROP FUNCTION IF EXISTS complete_join_family(UUID, UUID, TEXT, TEXT);

-- ==================== 3. MISSING UPDATE POLICIES ====================

-- Feeds
DO $$ BEGIN
  CREATE POLICY "feeds_update" ON feeds FOR UPDATE TO authenticated
    USING (user_belongs_to_family(family_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notes
DO $$ BEGIN
  CREATE POLICY "notes_update" ON notes FOR UPDATE TO authenticated
    USING (user_belongs_to_family(family_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trackers
DO $$ BEGIN
  CREATE POLICY "trackers_update" ON trackers FOR UPDATE TO authenticated
    USING (user_belongs_to_family(family_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tracker logs
DO $$ BEGIN
  CREATE POLICY "tracker_logs_update" ON tracker_logs FOR UPDATE TO authenticated
    USING (user_belongs_to_family(family_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==================== 4. MANAGEMENT POLICIES ====================

-- Families: members can update (e.g. rename)
DO $$ BEGIN
  CREATE POLICY "Family members can update their family" ON families FOR UPDATE TO authenticated
    USING (user_belongs_to_family(id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Family members: users can update their own membership (e.g. display name)
DO $$ BEGIN
  CREATE POLICY "Members can update own membership" ON family_members FOR UPDATE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Family members: users can leave a family (delete own membership)
DO $$ BEGIN
  CREATE POLICY "Members can leave family" ON family_members FOR DELETE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Children: family members can delete child profiles
DO $$ BEGIN
  CREATE POLICY "Family members can delete children" ON children FOR DELETE TO authenticated
    USING (user_belongs_to_family(family_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==================== 5. PIN RATE LIMITING ====================

-- Table to track PIN verification attempts
CREATE TABLE IF NOT EXISTS pin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pin_attempts_user_time ON pin_attempts(user_id, attempted_at DESC);

-- Recreate verify_family_pin with rate limiting
CREATE OR REPLACE FUNCTION verify_family_pin(pin_input TEXT)
RETURNS TABLE(family_id UUID, family_name TEXT) AS $$
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
  SELECT f.id, f.name
  FROM families f
  WHERE f.pin_hash = crypt(pin_input, f.pin_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
