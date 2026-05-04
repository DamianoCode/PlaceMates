-- Group-shared "do odwiedzenia" list. Coexists with the personal
-- `wishlist` table — same semantics but owned by the whole group.
-- Each pin is unique per (place, group); `added_by` is informational.
CREATE TABLE "group_wishlist" (
  "place_id" uuid NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "added_by" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("place_id", "group_id")
);
--> statement-breakpoint
CREATE INDEX "group_wishlist_group_idx" ON "group_wishlist" ("group_id");
