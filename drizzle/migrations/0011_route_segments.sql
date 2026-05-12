ALTER TABLE "trip_routes" ADD COLUMN "segments" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
-- Flush existing cache rows so the next access re-fetches with
-- per-segment data populated. Otherwise old rows would have empty
-- segments[] forever (until natural 7-day TTL), and the
-- "Od poprzedniego: …" UI bit would silently miss for those
-- trips. Cheap one-time invalidation — typical install has few
-- cached routes anyway.
DELETE FROM "trip_routes";