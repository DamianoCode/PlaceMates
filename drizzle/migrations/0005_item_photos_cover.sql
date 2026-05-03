-- item_photos.is_cover — same pattern as photos.is_cover (places).
-- Single source of truth for "this is the hero photo of the item".
-- Service-layer enforces uniqueness per item.
ALTER TABLE "item_photos" ADD COLUMN "is_cover" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Backfill: promote the most recent photo of each item to be its
-- cover, so existing items get a sensible default without the user
-- having to click anywhere.
UPDATE "item_photos"
   SET "is_cover" = true
  WHERE "id" IN (
    SELECT DISTINCT ON (item_id) id
      FROM "item_photos"
     ORDER BY item_id, created_at DESC
  );
