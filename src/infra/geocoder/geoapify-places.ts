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
 * monuments, viewpoints etc. without enumerating each.
 *
 * Multiple categories per slug → join with `,` in the query — Geoapify
 * unions them in a single request, which is much friendlier than the
 * N-roundtrip approach Overpass would need.
 */
const CATEGORY_TO_GEOAPIFY: Record<string, string[]> = {
  restaurant: ["catering.restaurant"],
  cafe: ["catering.cafe"],
  "ice-cream": ["catering.ice_cream"],
  bakery: ["commercial.food_and_drink.bakery", "catering.bakery"],
  // Outdoor: peaks, viewpoints, waterfalls — Geoapify exposes these
  // under tourism.sights.viewpoint and natural.* siblings.
  viewpoint: [
    "tourism.sights.viewpoint",
    "natural.peak",
    "natural.water.waterfall",
  ],
  // tourism.sights covers castles, monuments, archaeological sites,
  // memorials, places of worship — much wider than raw Overpass.
  attraction: [
    "tourism.sights",
    "tourism.attraction_park",
    "entertainment.museum",
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

function pickCategoryHint(cats: string[] | undefined): string {
  if (!cats || cats.length === 0) return "";
  // Prefer the deepest dot-path so the row gets the most specific
  // label downstream.
  const sorted = cats.slice().sort((a, b) => b.length - a.length);
  return sorted[0];
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
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as GeoapifyResponse;
  const out: GeoapifyPoi[] = [];
  const seen = new Set<string>();
  for (const f of data.features ?? []) {
    const poi = toPoi(f);
    if (!poi) continue;
    if (seen.has(poi.externalId)) continue;
    seen.add(poi.externalId);
    out.push(poi);
  }
  return out;
}
