import type { PoiResult, PoiSearch } from "./provider";

/**
 * Geoapify Geocoding API (https://www.geoapify.com/geocoding-api).
 *
 * Why we like it for PlaceMates:
 * - Generous free tier (3000 req/day) — plenty for personal-scale apps.
 * - Native `bias=proximity:lng,lat` so small-town queries don't get
 *   buried under capital-city hits the way bare Photon does.
 * - Richer categorisation than raw OSM (Geoapify augments OSM with
 *   their own POI feed, esp. in EU). Falls back to OSM otherwise.
 *
 * Identity: we use Geoapify's `place_id` as the canonical
 * `external_id` with `provider='geoapify'`. The canonical layer's
 * partial unique on `(provider, external_id)` then dedupes Geoapify
 * results across groups the same way it does for OSM.
 */
const BASE = "https://api.geoapify.com/v1/geocode";

type GeoapifyProperties = {
  place_id?: string;
  name?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  lat?: number;
  lon?: number;
  category?: string;
  categories?: string[];
  result_type?: string;
};

type GeoapifyFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: GeoapifyProperties;
};

type GeoapifyResponse = { features: GeoapifyFeature[] };

/**
 * Geoapify exposes a hierarchical taxonomy like `catering.ice_cream`
 * or `tourism.attraction`. Map the leaves we actually use back to our
 * own slugs so the canonical layer stays normalised. Anything missing
 * falls back to the raw value (which the existing OSM_VALUE_TO_SLUG
 * map in canonical.ts already understands for many cases).
 */
const GEOAPIFY_TO_HINT: Record<string, string> = {
  "catering.restaurant": "restaurant",
  "catering.cafe": "cafe",
  "catering.ice_cream": "ice_cream",
  "catering.bar": "bar",
  "catering.pub": "pub",
  "commercial.food_and_drink.bakery": "bakery",
  "tourism.attraction": "attraction",
  "tourism.viewpoint": "viewpoint",
  "leisure.park": "park",
  "natural.beach": "beach",
  "accommodation.hotel": "hotel",
  "accommodation.hostel": "hostel",
  "accommodation.guest_house": "guest_house",
};

function pickCategoryHint(p: GeoapifyProperties): string {
  // Prefer the most specific category (longest dot-path); fall back
  // to whatever single category was returned.
  const cats = (p.categories ?? []).slice().sort((a, b) => b.length - a.length);
  for (const c of cats) {
    const mapped = GEOAPIFY_TO_HINT[c];
    if (mapped) return mapped;
  }
  // No mapped slug — surface the raw leaf so unknown categories at
  // least show *something* downstream. canonical.ts treats unknown
  // strings as null hint anyway.
  return cats[0]?.split(".").pop() ?? p.category ?? "";
}

function toResult(f: GeoapifyFeature): PoiResult | null {
  const p = f.properties ?? {};
  const placeId = p.place_id;
  if (!placeId) return null;
  const [lng, lat] = f.geometry.coordinates;
  const name =
    p.name ?? p.address_line1 ?? p.formatted?.split(",")[0] ?? "";
  return {
    provider: "geoapify",
    externalId: placeId,
    osmId: "",
    name,
    address: p.formatted ?? [p.address_line1, p.address_line2].filter(Boolean).join(", "),
    lat: p.lat ?? lat,
    lng: p.lon ?? lng,
    categoryHint: pickCategoryHint(p),
  };
}

export function createGeoapify(apiKey: string, lang = "pl"): PoiSearch {
  const headers = { Accept: "application/json" };

  return {
    async search(query, opts) {
      if (query.trim().length < 2) return [];
      const url = new URL(`${BASE}/search`);
      url.searchParams.set("text", query);
      url.searchParams.set("limit", String(Math.min(opts?.limit ?? 10, 20)));
      url.searchParams.set("lang", lang);
      url.searchParams.set("apiKey", apiKey);
      // `proximity:lng,lat` is Geoapify's documented bias param —
      // their docs are explicit about lng-then-lat ordering.
      if (opts?.bias) {
        url.searchParams.set(
          "bias",
          `proximity:${opts.bias.lng},${opts.bias.lat}`,
        );
      }
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) return [];
      const data = (await res.json()) as GeoapifyResponse;
      return (data.features ?? [])
        .map(toResult)
        .filter((r): r is PoiResult => r !== null);
    },

    async reverse(lat, lng) {
      const url = new URL(`${BASE}/reverse`);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("lang", lang);
      url.searchParams.set("apiKey", apiKey);
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as GeoapifyResponse;
      const first = data.features?.[0];
      return first ? toResult(first) : null;
    },
  };
}
