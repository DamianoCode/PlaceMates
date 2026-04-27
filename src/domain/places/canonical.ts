import { eq, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { canonicalPlaces, categories } from "@/infra/db/schema";

export type ExternalSource = {
  provider: "osm"; // extend with "google" | "mapbox" when a new geocoder lands
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  /** Raw provider-specific category (e.g. OSM "ice_cream"). Normalised inside. */
  categoryHint?: string;
};

export type LocalSource = {
  name: string;
  lat: number;
  lng: number;
  /** Our own slug (e.g. "ice-cream"), usually pulled from categories.slug. */
  categoryHint?: string;
};

/**
 * OSM value → our slug. Keep aligned with scripts/seed-categories.ts
 * and the CATEGORY_TO_OSM map in overpass.ts. Unknown OSM tags yield
 * null so we never leak raw OSM identifiers into the ranking surface.
 */
const OSM_VALUE_TO_SLUG: Record<string, string> = {
  restaurant: "restaurant",
  cafe: "cafe",
  ice_cream: "ice-cream",
  bakery: "bakery",
  viewpoint: "viewpoint",
  attraction: "attraction",
  park: "park",
  beach: "beach",
  bar: "bar",
  pub: "bar",
  hotel: "accommodation",
  hostel: "accommodation",
  guest_house: "accommodation",
};

function normaliseCategoryHint(raw?: string | null): string | null {
  if (!raw) return null;
  return OSM_VALUE_TO_SLUG[raw.toLowerCase()] ?? null;
}

/**
 * Find-or-create a canonical for an external POI. The ON CONFLICT
 * clause targets the partial unique (canonical_places_ext_uk).
 *
 * On conflict we keep the original name (the first writer wins) so two
 * users typing slightly different labels for the same osm_id don't
 * fight over the row. Category hint only back-fills when the existing
 * row has NULL — never overwrites a good slug.
 *
 * The literal `name = canonical_places.name` is a deliberate no-op:
 * `DO NOTHING` would not return the existing id from RETURNING, and we
 * need the id either way. Touching the row this way costs one tuple
 * write but keeps the API a single round-trip.
 */
export async function findOrCreateExternalCanonical(
  source: ExternalSource,
): Promise<string> {
  const hint = normaliseCategoryHint(source.categoryHint);
  const wkt = `SRID=4326;POINT(${source.lng} ${source.lat})`;

  const rows = await db.execute<{ id: string }>(sql`
    INSERT INTO canonical_places (provider, external_id, name, location, category_hint)
    VALUES (
      ${source.provider},
      ${source.externalId},
      ${source.name},
      ${wkt}::geography,
      ${hint}
    )
    ON CONFLICT (provider, external_id)
      WHERE provider IS NOT NULL AND external_id IS NOT NULL
    DO UPDATE SET
      name = canonical_places.name,
      category_hint = COALESCE(canonical_places.category_hint, EXCLUDED.category_hint)
    RETURNING id
  `);
  return rows[0].id;
}

/**
 * Always creates a fresh canonical row for a pin-drop. No cross-group
 * dedupe — two people pinning the same real-world spot in different
 * groups each get their own canonical. Acceptable trade-off: the app
 * caters to small personal groups where this rarely matters, and
 * forcing fuzzy spatial dedupe would risk merging distinct places.
 */
export async function createLocalCanonical(source: LocalSource): Promise<string> {
  const [row] = await db
    .insert(canonicalPlaces)
    .values({
      provider: null,
      externalId: null,
      name: source.name,
      location: { lat: source.lat, lng: source.lng },
      categoryHint: source.categoryHint ?? null,
    })
    .returning({ id: canonicalPlaces.id });
  return row.id;
}

/** Pulled out so createPlace can feed the slug into createLocalCanonical
 *  without needing a second round-trip in the caller. */
export async function categorySlugForId(
  categoryId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  return row?.slug ?? null;
}
