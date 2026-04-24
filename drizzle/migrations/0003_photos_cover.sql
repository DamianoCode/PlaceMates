ALTER TABLE "photos" ADD COLUMN "is_cover" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Backfill: promote the most recent photo of each place to be its cover,
-- so migrating an existing DB doesn't leave every place without a cover.
UPDATE "photos"
   SET "is_cover" = true
  WHERE "id" IN (
    SELECT DISTINCT ON (place_id) id
      FROM "photos"
     ORDER BY place_id, created_at DESC
  );