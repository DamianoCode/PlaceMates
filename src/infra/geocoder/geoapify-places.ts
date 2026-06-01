/**
 * Geoapify Places API (https://apidocs.geoapify.com/docs/places/).
 *
 * Sibling to ./geoapify.ts (which is the geocoder). Places is a
 * separate endpoint optimised for "POIs in this area" — it accepts a
 * rich category taxonomy, filters by bbox/circle/polygon, and (unlike
 * raw Overpass) augments OSM with Geoapify's own POI feed which has
 * better coverage in EU small cities.
 *
 * Free tier: 3000 req/day shared with the geocoder.
 */

const BASE = "https://api.geoapify.com/v2/places";

type GeoapifyPlace = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    place_id?: string;
    name?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    lat?: number;
    lon?: number;
    categories?: string[];
  };
};

type GeoapifyResponse = { features: GeoapifyPlace[] };

/**
 * Map our app's category slugs → Geoapify Places category strings.
 * The taxonomy is hierarchical and dot-separated; specifying a parent
 * category includes its children, so `tourism.sights` covers castles,
 * monuments, archaeological sites etc. without enumerating each.
 *
 * Multiple categories per slug → join with `,` in the query — Geoapify
 * unions them in a single request, which is much friendlier than the
 * N-roundtrip approach Overpass would need.
 *
 * IMPORTANT: every string here must be a real Geoapify category.
 * Geoapify rejects the WHOLE request with HTTP 400 if even one
 * category is unknown — so a single typo silently disables nearby
 * search for any selection that includes the offending slug, falling
 * back to the thinner Overpass path. `npm run check:geoapify` guards
 * this against the vendored taxonomy in ./geoapify-categories.ts.
 */
export const CATEGORY_TO_GEOAPIFY: Record<string, string[]> = {
  restaurant: ["catering.restaurant"],
  cafe: ["catering.cafe"],
  "ice-cream": ["catering.ice_cream"],
  bakery: ["commercial.food_and_drink.bakery"],
  // Outdoor scenery: viewpoints live under tourism.attraction.viewpoint
  // and summits under natural.mountain.peak (Geoapify has no waterfall
  // category — those surface via Overpass instead).
  viewpoint: ["tourism.attraction.viewpoint", "natural.mountain.peak"],
  // Sights, generic attractions (artwork/fountain/clock), museums and
  // places of worship. religion.place_of_worship is what surfaces big
  // churches like Bazylika Mariacka that tourism.sights alone can miss.
  attraction: [
    "tourism.sights",
    "tourism.attraction",
    "entertainment.museum",
    "religion.place_of_worship",
  ],
  park: ["leisure.park", "natural.forest", "natural.protected_area"],
  beach: ["beach"],
  bar: ["catering.bar", "catering.pub"],
  accommodation: [
    "accommodation.hotel",
    "accommodation.hostel",
    "accommodation.guest_house",
  ],
  shop: [
    "commercial.food_and_drink",
    "commercial.health_and_beauty",
    "commercial.outdoor_and_sport",
  ],
};

export type GeoapifyPoi = {
  // Wire-shape compatible with OverpassPoi so the client doesn't care
  // which provider replied.
  osmId: string;            // empty for Geoapify hits — kept for type parity
  provider: "geoapify";
  externalId: string;       // Geoapify place_id
  name: string;
  lat: number;
  lng: number;
  categoryHint: string;
  address: string | null;
};

// Priority roots for picking a *meaningful* category. Geoapify tags a
// place with many categories (a tower is also `building.public_and_civil`,
// which is useless as a label and doesn't route to a sensible bucket).
// We walk these roots in order and take the deepest match under the first
// that hits, so the hint carries the real type (tower, church, statue…).
const HINT_ROOT_PRIORITY = [
  "religion.place_of_worship",
  "tourism.sights",
  "tourism.attraction",
  "entertainment.museum",
  "entertainment.culture",
  "entertainment",
  "leisure",
  "natural",
  "catering",
  "commercial",
  "accommodation",
  "tourism",
];

function pickCategoryHint(cats: string[] | undefined): string {
  if (!cats || cats.length === 0) return "";
  for (const root of HINT_ROOT_PRIORITY) {
    const matches = cats.filter((c) => c === root || c.startsWith(`${root}.`));
    if (matches.length > 0) {
      // Deepest (most specific) wins within the chosen root.
      return matches.sort((a, b) => b.length - a.length)[0];
    }
  }
  // Nothing recognised — deepest overall so downstream can still try.
  return cats.slice().sort((a, b) => b.length - a.length)[0];
}

function toPoi(feature: GeoapifyPlace): GeoapifyPoi | null {
  const p = feature.properties ?? {};
  const placeId = p.place_id;
  if (!placeId) return null;
  const [lng, lat] = feature.geometry.coordinates;
  return {
    osmId: "",
    provider: "geoapify",
    externalId: placeId,
    name:
      p.name ??
      p.address_line1 ??
      p.formatted?.split(",")[0] ??
      "Bez nazwy",
    lat: p.lat ?? lat,
    lng: p.lon ?? lng,
    categoryHint: pickCategoryHint(p.categories),
    address: p.formatted ??
      [p.address_line1, p.address_line2].filter(Boolean).join(", ") ?? null,
  };
}

/**
 * Query Geoapify Places for one or more of our category slugs inside
 * a bbox. Returns merged + deduped (by place_id) results. Empty array
 * on any failure — caller is responsible for the Overpass fallback.
 */
export async function geoapifyPlacesByCategories(
  apiKey: string,
  categorySlugs: string[],
  bbox: { south: number; west: number; north: number; east: number },
  limit = 80,
): Promise<GeoapifyPoi[]> {
  // Flatten our slugs to Geoapify's taxonomy. Skip slugs we don't
  // know — caller can fall back to Overpass for those.
  const cats = categorySlugs
    .flatMap((slug) => CATEGORY_TO_GEOAPIFY[slug] ?? [])
    .join(",");
  if (!cats) return [];

  const url = new URL(BASE);
  // Geoapify rect filter is `west,north,east,south` (lon,lat order).
  url.searchParams.set(
    "filter",
    `rect:${bbox.west},${bbox.north},${bbox.east},${bbox.south}`,
  );
  url.searchParams.set("categories", cats);
  url.searchParams.set("limit", String(Math.min(limit, 500)));
  // Polish names/addresses — without this Geoapify returns English
  // defaults ("Main Market Square" instead of "Rynek Główny"). Mirrors
  // the "pl" language passed to the geocoder.
  url.searchParams.set("lang", "pl");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as GeoapifyResponse;
  const out: GeoapifyPoi[] = [];
  const seenIds = new Set<string>();
  const seenPlaces = new Set<string>();
  for (const f of data.features ?? []) {
    const poi = toPoi(f);
    if (!poi) continue;
    if (seenIds.has(poi.externalId)) continue;
    // Geoapify frequently returns one real place as several features
    // (a node plus its building polygon, or the same monument under two
    // taxonomies) with different place_ids — dedup by externalId alone
    // leaves visible doubles. Collapse same-name hits within ~100 m
    // (3 decimal degrees) so the list isn't padded with duplicates.
    const placeKey = `${poi.name.toLowerCase()}@${poi.lat.toFixed(3)},${poi.lng.toFixed(3)}`;
    if (seenPlaces.has(placeKey)) continue;
    seenIds.add(poi.externalId);
    seenPlaces.add(placeKey);
    out.push(poi);
  }
  return out;
}
