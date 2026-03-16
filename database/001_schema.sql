-- Little Legend Tracker - Database Schema
-- Multi-tenant schema with family_id + child_id isolation

-- ==================== EXTENSIONS ====================
-- pgcrypto provides crypt() and gen_salt() used for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==================== CORE IDENTITY TABLES ====================

CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('owner', 'parent', 'carer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, user_id)
);

CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== DATA TABLES ====================

CREATE TABLE medications (
  id TEXT PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purpose TEXT,
  dose TEXT NOT NULL,
  category TEXT DEFAULT 'other' CHECK (category IN ('heart', 'diuretic', 'stomach', 'blood', 'other')),
  times TEXT[] NOT NULL DEFAULT '{}',
  instructions TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE med_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  med_key TEXT NOT NULL,
  medication_id TEXT REFERENCES medications(id),
  given_at TEXT,
  given_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, child_id, date, med_key)
);

CREATE TABLE feeds (
  id TEXT PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bottle', 'tube', 'breast')),
  amount DECIMAL NOT NULL,
  notes TEXT,
  logged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value DECIMAL NOT NULL,
  notes TEXT,
  logged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, child_id, date)
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  text TEXT NOT NULL,
  logged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trackers (
  id TEXT PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📝',
  unit TEXT,
  type TEXT NOT NULL DEFAULT 'number' CHECK (type IN ('number', 'counter', 'note')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tracker_logs (
  id TEXT PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  tracker_id TEXT NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  value TEXT,
  notes TEXT,
  logged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  med_alarms BOOLEAN DEFAULT true,
  feed_alarms BOOLEAN DEFAULT false,
  sound_alerts BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, child_id)
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  type TEXT NOT NULL,
  message TEXT NOT NULL
);

-- ==================== INDEXES ====================

CREATE INDEX idx_family_members_user ON family_members(user_id);
CREATE INDEX idx_children_family ON children(family_id);
CREATE INDEX idx_medications_family_child ON medications(family_id, child_id);
CREATE INDEX idx_med_logs_family_child_date ON med_logs(family_id, child_id, date);
CREATE INDEX idx_feeds_family_child_date ON feeds(family_id, child_id, date);
CREATE INDEX idx_weights_family_child_date ON weights(family_id, child_id, date);
CREATE INDEX idx_notes_family_child_date ON notes(family_id, child_id, date);
CREATE INDEX idx_tracker_logs_family_child_date ON tracker_logs(family_id, child_id, date);
CREATE INDEX idx_activity_log_family_child ON activity_log(family_id, child_id);
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp DESC);

-- ==================== RLS POLICIES ====================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE med_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user belongs to a family
CREATE OR REPLACE FUNCTION user_belongs_to_family(fam_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = fam_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Families: authenticated users can create, members can read/update
CREATE POLICY "Users can create families" ON families FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Family members can read their family" ON families FOR SELECT TO authenticated
  USING (user_belongs_to_family(id));
CREATE POLICY "Family members can update their family" ON families FOR UPDATE TO authenticated
  USING (user_belongs_to_family(id));

-- Family members: members can read their family's members, manage own membership
CREATE POLICY "Members can read family members" ON family_members FOR SELECT TO authenticated
  USING (user_belongs_to_family(family_id));
CREATE POLICY "Authenticated users can join families" ON family_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members can update own membership" ON family_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Members can leave family" ON family_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Children: family members have full access
CREATE POLICY "Family members can read children" ON children FOR SELECT TO authenticated
  USING (user_belongs_to_family(family_id));
CREATE POLICY "Family members can insert children" ON children FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_family(family_id));
CREATE POLICY "Family members can update children" ON children FOR UPDATE TO authenticated
  USING (user_belongs_to_family(family_id));
CREATE POLICY "Family members can delete children" ON children FOR DELETE TO authenticated
  USING (user_belongs_to_family(family_id));

-- Data tables: family members have full CRUD
-- Medications
CREATE POLICY "meds_select" ON medications FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "meds_insert" ON medications FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));
CREATE POLICY "meds_update" ON medications FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "meds_delete" ON medications FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- Med logs
CREATE POLICY "med_logs_select" ON med_logs FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "med_logs_insert" ON med_logs FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));
CREATE POLICY "med_logs_update" ON med_logs FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "med_logs_delete" ON med_logs FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- Feeds
CREATE POLICY "feeds_select" ON feeds FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "feeds_insert" ON feeds FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));
CREATE POLICY "feeds_update" ON feeds FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "feeds_delete" ON feeds FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- Weights
CREATE POLICY "weights_select" ON weights FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "weights_insert" ON weights FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));
CREATE POLICY "weights_update" ON weights FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "weights_delete" ON weights FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- Notes
CREATE POLICY "notes_select" ON notes FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "notes_insert" ON notes FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));
CREATE POLICY "notes_update" ON notes FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "notes_delete" ON notes FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- Trackers
CREATE POLICY "trackers_select" ON trackers FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "trackers_insert" ON trackers FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));
CREATE POLICY "trackers_update" ON trackers FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "trackers_delete" ON trackers FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- Tracker logs
CREATE POLICY "tracker_logs_select" ON tracker_logs FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "tracker_logs_insert" ON tracker_logs FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));
CREATE POLICY "tracker_logs_update" ON tracker_logs FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "tracker_logs_delete" ON tracker_logs FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- Settings
CREATE POLICY "settings_select" ON settings FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "settings_insert" ON settings FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));
CREATE POLICY "settings_update" ON settings FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));

-- Activity log
CREATE POLICY "activity_select" ON activity_log FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));
CREATE POLICY "activity_insert" ON activity_log FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));

-- ==================== PIN RATE LIMITING ====================

-- Track PIN verification attempts per user (max 5 per 15 minutes)
CREATE TABLE pin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pin_attempts_user_time ON pin_attempts(user_id, attempted_at DESC);

-- ==================== PIN FUNCTIONS ====================

-- Create a family with a hashed PIN (called from signup)
CREATE OR REPLACE FUNCTION create_family_with_pin(
  family_id UUID,
  family_name TEXT,
  pin_input TEXT
)
RETURNS void AS $$
BEGIN
  INSERT INTO families (id, name, pin_hash)
  VALUES (family_id, family_name, crypt(pin_input, gen_salt('bf')));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify a family PIN + name with rate limiting (called from join)
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

-- Confirm family by existing member email (fallback for PIN+name collisions)
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

-- Complete signup: creates family, member, child, and settings in one transaction
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

-- Complete join family: verifies PIN and adds member in one transaction
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

-- ==================== AUTO-TRIM ACTIVITY LOG ====================

CREATE OR REPLACE FUNCTION trim_activity_log()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM activity_log
  WHERE id IN (
    SELECT id FROM activity_log
    WHERE family_id = NEW.family_id AND child_id = NEW.child_id
    ORDER BY timestamp DESC
    OFFSET 500
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_trim_activity_log
AFTER INSERT ON activity_log
FOR EACH ROW EXECUTE FUNCTION trim_activity_log();

-- ==================== ENABLE REALTIME ====================

ALTER PUBLICATION supabase_realtime ADD TABLE med_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE feeds;
ALTER PUBLICATION supabase_realtime ADD TABLE weights;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE tracker_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE medications;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
