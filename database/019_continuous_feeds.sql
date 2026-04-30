-- Continuous tube feed sessions with disconnect/reconnect tracking.
-- Required by the Feeding Tube Australia community for kids on pump feeds
-- (G/J tubes typically) where bolus tracking doesn't represent reality.
--
-- Workflow:
--   1. User starts a session: type, optional rate (mL/hr) → row inserted
--      with started_at = now(), ended_at = NULL.
--   2. During the feed, disconnect events: row in pauses with
--      disconnected_at = now(), reconnected_at = NULL.
--   3. Reconnect: update the open pause row, set reconnected_at = now().
--   4. End feed: update session, set ended_at = now() and optionally
--      total_ml_actual (read off the pump).
--
-- Constraint: only ONE active session per child at a time (enforced via
-- partial unique index on child_id WHERE ended_at IS NULL). Prevents
-- accidentally starting a second session when one is already running.

-- ============================================================
-- continuous_feed_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.continuous_feed_sessions (
  id TEXT PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('ng_tube', 'nj_tube', 'g_tube', 'j_tube')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  rate_ml_hr DECIMAL,
  total_ml_actual DECIMAL,
  notes TEXT,
  started_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cf_sessions_family_child
  ON public.continuous_feed_sessions(family_id, child_id, started_at DESC);

-- Only one active session per child at a time
CREATE UNIQUE INDEX IF NOT EXISTS cf_sessions_one_active_per_child
  ON public.continuous_feed_sessions(child_id)
  WHERE ended_at IS NULL;

ALTER TABLE public.continuous_feed_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cf_sessions_select" ON public.continuous_feed_sessions;
CREATE POLICY "cf_sessions_select" ON public.continuous_feed_sessions
  FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "cf_sessions_insert" ON public.continuous_feed_sessions;
CREATE POLICY "cf_sessions_insert" ON public.continuous_feed_sessions
  FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "cf_sessions_update" ON public.continuous_feed_sessions;
CREATE POLICY "cf_sessions_update" ON public.continuous_feed_sessions
  FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "cf_sessions_delete" ON public.continuous_feed_sessions;
CREATE POLICY "cf_sessions_delete" ON public.continuous_feed_sessions
  FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- ============================================================
-- continuous_feed_pauses (disconnect/reconnect events)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.continuous_feed_pauses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES public.continuous_feed_sessions(id) ON DELETE CASCADE,
  -- Denormalized for RLS — saves a join on every policy check
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  disconnected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cf_pauses_session
  ON public.continuous_feed_pauses(session_id, disconnected_at);

ALTER TABLE public.continuous_feed_pauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cf_pauses_select" ON public.continuous_feed_pauses;
CREATE POLICY "cf_pauses_select" ON public.continuous_feed_pauses
  FOR SELECT TO authenticated USING (user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "cf_pauses_insert" ON public.continuous_feed_pauses;
CREATE POLICY "cf_pauses_insert" ON public.continuous_feed_pauses
  FOR INSERT TO authenticated WITH CHECK (user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "cf_pauses_update" ON public.continuous_feed_pauses;
CREATE POLICY "cf_pauses_update" ON public.continuous_feed_pauses
  FOR UPDATE TO authenticated USING (user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "cf_pauses_delete" ON public.continuous_feed_pauses;
CREATE POLICY "cf_pauses_delete" ON public.continuous_feed_pauses
  FOR DELETE TO authenticated USING (user_belongs_to_family(family_id));

-- ============================================================
-- Realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.continuous_feed_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.continuous_feed_pauses;

-- ============================================================
-- Extend get_tracker_snapshot to include continuous feed sessions + pauses
-- so they load on app mount (not just via realtime deltas).
-- ============================================================
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
      SELECT jsonb_agg(m ORDER BY m.name)
      FROM public.medications m
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
