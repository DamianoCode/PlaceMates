/**
 * Overpass API — queries raw OSM data. We use it to list POIs by category
 * within a bounding box, so the user can import many places at once.
 *
 * Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
 * Fair-use: keep timeouts short, avoid huge bboxes, cache server-side.
 */

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export type OverpassTagFilter = { key: string; value: string };

export type OverpassPoi = {
  osmId: string;
  name: string;
  lat: number;
  lng: number;
  categoryHint: string;
  address: string | null;
};

// Our built-in category slugs → OSM tag filters. A single slug maps to
// one or more tag filters, joined as a union in the Overpass query.
export const CATEGORY_TO_OSM: Record<string, OverpassTagFilter[]> = {
  restaurant: [{ key: "amenity", value: "restaurant" }],
  cafe: [{ key: "amenity", value: "cafe" }],
  "ice-cream": [{ key: "amenity", value: "ice_cream" }],
  bakery: [{ key: "shop", value: "bakery" }],
  viewpoint: [{ key: "tourism", value: "viewpoint" }],
  attraction: [{ key: "tourism", value: "attraction" }],
  park: [{ key: "leisure", value: "park" }],
  beach: [{ key: "natural", value: "beach" }],
  bar: [
    { key: "amenity", value: "bar" },
    { key: "amenity", value: "pub" },
  ],
  accommodation: [
    { key: "tourism", value: "hotel" },
    { key: "tourism", value: "guest_house" },
    { key: "tourism", value: "hostel" },
  ],
  shop: [
    { key: "shop", value: "deli" },
    { key: "shop", value: "greengrocer" },
    { key: "shop", value: "farm" },
  ],
};

function buildQuery(
  filters: OverpassTagFilter[],
  bbox: { south: number; west: number; north: number; east: number },
  limit: number,
): string {
  const inner = filters
    .map(
      (f) =>
        `node["${f.key}"="${f.value}"]["name"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});` +
        `way["${f.key}"="${f.value}"]["name"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});`,
    )
    .join("");
  return `[out:json][timeout:20];(${inner});out center ${Math.min(limit, 200)};`;
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements: OverpassElement[] };

function toAddress(tags: Record<string, string>): string | null {
  const parts = [
    [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" "),
    tags["addr:postcode"],
    tags["addr:city"],
  ].filter((s) => s && s.length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

function elementToPoi(el: OverpassElement): OverpassPoi | null {
  const tags = el.tags ?? {};
  const name = tags.name;
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const prefix = el.type[0].toUpperCase();
  const categoryHint =
    tags.amenity ?? tags.shop ?? tags.tourism ?? tags.leisure ?? tags.natural ?? "";
  return {
    osmId: `${prefix}${el.id}`,
    name,
    lat,
    lng,
    categoryHint,
    address: toAddress(tags),
  };
}

/**
 * Approximate metres → degrees conversion. Latitude is uniform
 * (~111 km/deg); longitude shrinks toward the poles (~111 km × cos lat).
 * Plenty good for the small 50–100 m bbox we use for pin-drop matches.
 */
function metersToBbox(
  lat: number,
  lng: number,
  radiusM: number,
): { south: number; west: number; north: number; east: number } {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return {
    south: lat - dLat,
    north: lat + dLat,
    west: lng - dLng,
    east: lng + dLng,
  };
}

/**
 * Find OSM POIs near a point that match our category slug. Used after
 * a pin-drop to ask "did you mean: …?" and link to an external
 * canonical instead of creating a fresh local one — avoids fragmenting
 * the ranking when the same real-world spot already exists in OSM.
 */
export async function overpassNearbyByCategory(
  categorySlug: string,
  lat: number,
  lng: number,
  radiusM: number,
  opts?: { limit?: number; userAgent?: string },
): Promise<OverpassPoi[]> {
  const bbox = metersToBbox(lat, lng, radiusM);
  return overpassSearchByCategory(categorySlug, bbox, opts);
}

export async function overpassSearchByCategory(
  categorySlug: string,
  bbox: { south: number; west: number; north: number; east: number },
  opts?: { limit?: number; userAgent?: string },
): Promise<OverpassPoi[]> {
  const filters = CATEGORY_TO_OSM[categorySlug];
  if (!filters || filters.length === 0) return [];
  const query = buildQuery(filters, bbox, opts?.limit ?? 100);
  const headers = {
    "User-Agent": opts?.userAgent ?? "PlaceMates (placemates.app)",
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: `data=${encodeURIComponent(query)}`,
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as OverpassResponse;
      const out: OverpassPoi[] = [];
      const seen = new Set<string>();
      for (const el of data.elements) {
        const poi = elementToPoi(el);
        if (!poi) continue;
        // Dedupe multiple OSM type variants of the same place.
        const key = `${poi.lat.toFixed(5)}:${poi.lng.toFixed(5)}:${poi.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(poi);
      }
      return out;
    } catch {
      // try next endpoint
    }
  }
  return [];
}
