-- Single-shot loader: replaces 11 separate select queries on app mount with
-- one RPC call that returns the full tracker state for a (family, child) pair.
--
-- Returns a JSONB blob with one key per collection. Field shapes match what
-- the corresponding tables would return via the REST API, so the existing
-- dbToX transformers in src/lib/realtimeUtils.js work unchanged.
--
-- SECURITY INVOKER: runs as the calling user, so existing RLS policies on
-- each table naturally restrict what the caller can see. If the user isn't
-- a member of the requested family, every sub-query returns zero rows and
-- the result is a blob of empty arrays / nulls.

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
      WHERE m.family_id = p_family_id
        AND m.child_id = p_child_id
        AND m.active = true
    ), '[]'::jsonb),

    'med_logs', COALESCE((
      SELECT jsonb_agg(ml)
      FROM public.med_logs ml
      WHERE ml.family_id = p_family_id
        AND ml.child_id = p_child_id
    ), '[]'::jsonb),

    'feeds', COALESCE((
      SELECT jsonb_agg(f ORDER BY f.date DESC, f.time DESC)
      FROM public.feeds f
      WHERE f.family_id = p_family_id
        AND f.child_id = p_child_id
    ), '[]'::jsonb),

    'feed_schedule', (
      SELECT to_jsonb(fs)
      FROM public.feed_schedules fs
      WHERE fs.family_id = p_family_id
        AND fs.child_id = p_child_id
      LIMIT 1
    ),

    'weights', COALESCE((
      SELECT jsonb_agg(w ORDER BY w.date)
      FROM public.weights w
      WHERE w.family_id = p_family_id
        AND w.child_id = p_child_id
    ), '[]'::jsonb),

    'notes', COALESCE((
      SELECT jsonb_agg(n ORDER BY n.created_at DESC)
      FROM public.notes n
      WHERE n.family_id = p_family_id
        AND n.child_id = p_child_id
    ), '[]'::jsonb),

    'trackers', COALESCE((
      SELECT jsonb_agg(t)
      FROM public.trackers t
      WHERE t.family_id = p_family_id
        AND t.child_id = p_child_id
    ), '[]'::jsonb),

    'tracker_logs', COALESCE((
      SELECT jsonb_agg(tl)
      FROM public.tracker_logs tl
      WHERE tl.family_id = p_family_id
        AND tl.child_id = p_child_id
    ), '[]'::jsonb),

    'contacts', COALESCE((
      SELECT jsonb_agg(c ORDER BY c.name)
      FROM public.contacts c
      WHERE c.family_id = p_family_id
        AND c.child_id = p_child_id
    ), '[]'::jsonb),

    'settings', (
      SELECT to_jsonb(s)
      FROM public.settings s
      WHERE s.family_id = p_family_id
        AND s.child_id = p_child_id
      LIMIT 1
    ),

    'activity_log', COALESCE((
      SELECT jsonb_agg(latest ORDER BY latest.timestamp DESC)
      FROM (
        SELECT a.*
        FROM public.activity_log a
        WHERE a.family_id = p_family_id
          AND a.child_id = p_child_id
        ORDER BY a.timestamp DESC
        LIMIT 200
      ) latest
    ), '[]'::jsonb)
  );
$$;

-- Allow authenticated users to call this function. RLS on each underlying
-- table still enforces row-level access.
GRANT EXECUTE ON FUNCTION get_tracker_snapshot(UUID, UUID) TO authenticated;
