-- Canonical places: provider-agnostic identity for real-world lookups.
-- External canonical (POI search / import) has (provider, external_id);
-- local canonical (pin-drop) has both NULL. Partial unique enforces
-- dedupe only for external entries.
CREATE TABLE "canonical_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text,
	"external_id" text,
	"name" text NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"category_hint" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_places_ext_uk"
	ON "canonical_places" ("provider", "external_id")
	WHERE "provider" IS NOT NULL AND "external_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "canonical_places_location_gix"
	ON "canonical_places" USING GIST ("location");
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "canonical_place_id" uuid;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_canonical_place_id_canonical_places_id_fk"
	FOREIGN KEY ("canonical_place_id")
	REFERENCES "public"."canonical_places"("id")
	ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "places_canonical_idx" ON "places" USING btree ("canonical_place_id");
--> statement-breakpoint
-- Backfill external canonical from existing places.osm_id values.
-- DISTINCT ON (osm_id) picks the earliest-created row per osm_id so the
-- canonical takes a consistent name/location snapshot.
INSERT INTO "canonical_places" ("provider", "external_id", "name", "location")
	SELECT DISTINCT ON ("osm_id") 'osm', "osm_id", "name", "location"
	  FROM "places"
	 WHERE "osm_id" IS NOT NULL
	 ORDER BY "osm_id", "created_at" ASC;
--> statement-breakpoint
UPDATE "places" p
	SET "canonical_place_id" = cp."id"
	FROM "canonical_places" cp
	WHERE p."osm_id" = cp."external_id"
	  AND cp."provider" = 'osm'
	  AND p."canonical_place_id" IS NULL;
--> statement-breakpoint
-- Backfill local canonical (provider NULL) for every remaining pin-drop.
-- One canonical per place, guaranteed by the per-row loop — a set-based
-- update can't safely pair inserted canonicals back to their source
-- places when the pin-drops share (name, location).
DO $$
DECLARE
	r RECORD;
	cid uuid;
BEGIN
	FOR r IN
		SELECT "id", "name", "location"
		  FROM "places"
		 WHERE "osm_id" IS NULL
		   AND "canonical_place_id" IS NULL
	LOOP
		INSERT INTO "canonical_places" ("provider", "external_id", "name", "location")
			VALUES (NULL, NULL, r."name", r."location")
			RETURNING "id" INTO cid;
		UPDATE "places" SET "canonical_place_id" = cid WHERE "id" = r."id";
	END LOOP;
END $$;
