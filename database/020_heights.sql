-- Heights table for length/height tracking alongside weights. Same shape and
-- semantics as the weights table (one entry per child per date) so existing
-- patterns (date-keyed local state, growth chart percentile overlay, etc.)
-- carry over directly.

CREATE TABLE IF NOT EXISTS public.heights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value DECIMAL NOT NULL,           -- centimetres
  notes TEXT,
  logged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, child_id, date)
);

CREATE INDEX IF NOT EXISTS idx_heights_family_child_date
  ON public.heights(family_id, child_id, date);

ALTER TABLE public.heights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "heights_select" ON public.heights;
CREATE POLICY "heights_select" ON public.heights
  FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "heights_insert" ON public.heights;
CREATE POLICY "heights_insert" ON public.heights
  FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "heights_update" ON public.heights;
CREATE POLICY "heights_update" ON public.heights
  FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "heights_delete" ON public.heights;
CREATE POLICY "heights_delete" ON public.heights
  FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- Realtime publication so cross-tab/device sync works
ALTER PUBLICATION supabase_realtime ADD TABLE public.heights;

-- Extend get_tracker_snapshot to include heights
CREATE OR REPLACE FUNCTION get_tracker_snapshot(
  p_family_id UUID,
  p_child_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'medications', COALESCE((
      SELECT jsonb_agg(m ORDER BY m.name) FROM public.medications m
      WHERE m.family_id = p_family_id AND m.child_id = p_child_id AND m.active = true
    ), '[]'::jsonb),
    'med_logs', COALESCE((
      SELECT jsonb_agg(ml) FROM public.med_logs ml
      WHERE ml.family_id = p_family_id AND ml.child_id = p_child_id
    ), '[]'::jsonb),
    'feeds', COALESCE((
      SELECT jsonb_agg(f ORDER BY f.date DESC, f.time DESC) FROM public.feeds f
      WHERE f.family_id = p_family_id AND f.child_id = p_child_id
    ), '[]'::jsonb),
    'feed_schedule', (
      SELECT to_jsonb(fs) FROM public.feed_schedules fs
      WHERE fs.family_id = p_family_id AND fs.child_id = p_child_id LIMIT 1
    ),
    'weights', COALESCE((
      SELECT jsonb_agg(w ORDER BY w.date) FROM public.weights w
      WHERE w.family_id = p_family_id AND w.child_id = p_child_id
    ), '[]'::jsonb),
    'heights', COALESCE((
      SELECT jsonb_agg(h ORDER BY h.date) FROM public.heights h
      WHERE h.family_id = p_family_id AND h.child_id = p_child_id
    ), '[]'::jsonb),
    'notes', COALESCE((
      SELECT jsonb_agg(n ORDER BY n.created_at DESC) FROM public.notes n
      WHERE n.family_id = p_family_id AND n.child_id = p_child_id
    ), '[]'::jsonb),
    'trackers', COALESCE((
      SELECT jsonb_agg(t) FROM public.trackers t
      WHERE t.family_id = p_family_id AND t.child_id = p_child_id
    ), '[]'::jsonb),
    'tracker_logs', COALESCE((
      SELECT jsonb_agg(tl) FROM public.tracker_logs tl
      WHERE tl.family_id = p_family_id AND tl.child_id = p_child_id
    ), '[]'::jsonb),
    'contacts', COALESCE((
      SELECT jsonb_agg(c ORDER BY c.name) FROM public.contacts c
      WHERE c.family_id = p_family_id AND c.child_id = p_child_id
    ), '[]'::jsonb),
    'settings', (
      SELECT to_jsonb(s) FROM public.settings s
      WHERE s.family_id = p_family_id AND s.child_id = p_child_id LIMIT 1
    ),
    'activity_log', COALESCE((
      SELECT jsonb_agg(latest ORDER BY latest.timestamp DESC)
      FROM (
        SELECT a.* FROM public.activity_log a
        WHERE a.family_id = p_family_id AND a.child_id = p_child_id
        ORDER BY a.timestamp DESC LIMIT 200
      ) latest
    ), '[]'::jsonb),
    'continuous_feed_sessions', COALESCE((
      SELECT jsonb_agg(cs ORDER BY cs.started_at DESC)
      FROM public.continuous_feed_sessions cs
      WHERE cs.family_id = p_family_id AND cs.child_id = p_child_id
    ), '[]'::jsonb),
    'continuous_feed_pauses', COALESCE((
      SELECT jsonb_agg(cp ORDER BY cp.disconnected_at DESC)
      FROM public.continuous_feed_pauses cp
      WHERE cp.family_id = p_family_id AND cp.child_id = p_child_id
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION get_tracker_snapshot(UUID, UUID) TO authenticated;
