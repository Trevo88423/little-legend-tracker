-- Expand the feeds.type CHECK constraint to include specific tube types
-- (NG, NJ, G, J) for the feeding-tube community. Existing 'tube' rows are
-- left intact as a legacy value so users can re-categorize them at their
-- own pace.
--
-- New allowed values: bottle, breast, tube (legacy), ng_tube, nj_tube,
-- g_tube, j_tube.
--
-- feed_schedules.feed_type does NOT have a CHECK constraint, so it
-- inherits the new values without a migration.

ALTER TABLE public.feeds
  DROP CONSTRAINT IF EXISTS feeds_type_check;

ALTER TABLE public.feeds
  ADD CONSTRAINT feeds_type_check
  CHECK (type IN ('bottle', 'breast', 'tube', 'ng_tube', 'nj_tube', 'g_tube', 'j_tube'));
