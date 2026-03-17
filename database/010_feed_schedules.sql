-- Feed schedule support: scheduled feed times with target amounts

-- Table: feed_schedules
-- One schedule per child (family_id + child_id unique)
CREATE TABLE IF NOT EXISTS feed_schedules (
  id TEXT PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  times TEXT[] NOT NULL DEFAULT '{}',
  target_amount DECIMAL,
  feed_type TEXT NOT NULL DEFAULT 'bottle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, child_id)
);

-- Index for queries by family+child
CREATE INDEX IF NOT EXISTS idx_feed_schedules_family_child
  ON feed_schedules(family_id, child_id);

-- Enable RLS
ALTER TABLE feed_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as medications)
CREATE POLICY feed_schedules_select ON feed_schedules
  FOR SELECT USING (user_belongs_to_family(family_id));

CREATE POLICY feed_schedules_insert ON feed_schedules
  FOR INSERT WITH CHECK (user_belongs_to_family(family_id));

CREATE POLICY feed_schedules_update ON feed_schedules
  FOR UPDATE USING (user_belongs_to_family(family_id));

CREATE POLICY feed_schedules_delete ON feed_schedules
  FOR DELETE USING (user_belongs_to_family(family_id));

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE feed_schedules;

-- Extend notification_log CHECK constraint to include 'feed-due'
-- Drop existing constraint and recreate with new value
ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_notification_type_check;
ALTER TABLE notification_log ADD CONSTRAINT notification_log_notification_type_check
  CHECK (notification_type IN ('early', 'due', 'late', 'feed-due'));
