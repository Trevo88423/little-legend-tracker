-- Add the trackers table to the supabase_realtime publication so changes
-- to custom tracker definitions sync across tabs/devices in real time.
-- The 001_schema.sql migration enabled realtime on tracker_logs but
-- omitted the trackers table itself.

ALTER PUBLICATION supabase_realtime ADD TABLE trackers;
