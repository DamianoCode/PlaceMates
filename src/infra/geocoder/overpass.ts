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

/**
 * Tag filter for one OSM category. `nameOptional=true` means we accept
 * unnamed POIs too — necessary for outdoor categories (viewpoints,
 * peaks, cliffs) where mappers often only tag the type, not the name.
 * Indoor/commercial categories (cafe, restaurant) keep the name
 * filter on — an unnamed café is just noise.
 */
export type OverpassTagFilter = {
  key: string;
  value: string;
  nameOptional?: boolean;
};

export type OverpassPoi = {
  osmId: string;
  name: string;
  lat: number;
  lng: number;
  categoryHint: string;
  address: string | null;
};

// Our built-in category slugs → OSM tag filters. A single slug maps to
// one or more tag filters; the Overpass query unions them.
//
// Outdoor categories are intentionally wide. Mappers tag the same
// concept under different keys: a viewpoint may be tourism=viewpoint
// OR natural=peak OR man_made=tower with viewpoint=yes. Hitting just
// one of those keys (the original implementation) misses 60–80% of
// real-world POIs in a typical Polish provincial city.
export const CATEGORY_TO_OSM: Record<string, OverpassTagFilter[]> = {
  restaurant: [{ key: "amenity", value: "restaurant" }],
  cafe: [{ key: "amenity", value: "cafe" }],
  "ice-cream": [{ key: "amenity", value: "ice_cream" }],
  bakery: [{ key: "shop", value: "bakery" }],

  // Viewpoints + nearby outdoor scenery. Most peaks, cliffs and
  // waterfalls have no `name` in OSM — accept them anyway and we'll
  // synthesize a label downstream.
  viewpoint: [
    { key: "tourism", value: "viewpoint", nameOptional: true },
    { key: "natural", value: "peak", nameOptional: true },
    { key: "natural", value: "cliff", nameOptional: true },
    { key: "natural", value: "waterfall", nameOptional: true },
    { key: "man_made", value: "tower", nameOptional: true },
  ],

  // Cultural / historic / sights.
  attraction: [
    { key: "tourism", value: "attraction", nameOptional: true },
    { key: "tourism", value: "museum" },
    { key: "tourism", value: "artwork", nameOptional: true },
    { key: "historic", value: "castle" },
    { key: "historic", value: "ruins", nameOptional: true },
    { key: "historic", value: "monument", nameOptional: true },
    { key: "historic", value: "memorial", nameOptional: true },
    { key: "historic", value: "archaeological_site", nameOptional: true },
    { key: "man_made", value: "lighthouse" },
  ],

  park: [
    { key: "leisure", value: "park", nameOptional: true },
    { key: "leisure", value: "nature_reserve", nameOptional: true },
    { key: "boundary", value: "protected_area", nameOptional: true },
  ],

  beach: [{ key: "natural", value: "beach", nameOptional: true }],

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

function bboxArgs(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): string {
  return `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
}

function buildQuery(
  filters: OverpassTagFilter[],
  bbox: { south: number; west: number; north: number; east: number },
  limit: number,
): string {
  const args = bboxArgs(bbox);
  const inner = filters
    .map((f) => {
      // Name-required filter: every element type carries the ["name"]
      // restriction. Optional means we accept unnamed too.
      const nameRestrict = f.nameOptional ? "" : '["name"]';
      const tag = `["${f.key}"="${f.value}"]`;
      // node + way + relation. Relations matter for big features
      // (city parks, lakes, protected areas) which are often modeled
      // as multipolygon relations in OSM.
      return (
        `node${tag}${nameRestrict}(${args});` +
        `way${tag}${nameRestrict}(${args});` +
        `relation${tag}${nameRestrict}(${args});`
      );
    })
    .join("");
  // `out center` gives ways and relations a representative point
  // (centroid of the bbox) so we can render them as pins without
  // resolving every member node.
  return `[out:json][timeout:25];(${inner});out center ${Math.min(limit, 200)};`;
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

/**
 * Polish fallback label for unnamed POIs, derived from the most
 * specific OSM tag we see. Without this an unnamed peak shows up as
 * empty string in the import sheet and the user can't identify it.
 */
function synthesizeName(tags: Record<string, string>): string {
  // Most specific first.
  if (tags.tourism === "viewpoint") return "Punkt widokowy";
  if (tags.tourism === "attraction") return "Atrakcja";
  if (tags.tourism === "artwork") return "Sztuka publiczna";
  if (tags.tourism === "museum") return "Muzeum";
  if (tags.tourism === "picnic_site") return "Miejsce piknikowe";
  if (tags.historic === "castle") return "Zamek";
  if (tags.historic === "ruins") return "Ruiny";
  if (tags.historic === "monument") return "Pomnik";
  if (tags.historic === "memorial") return "Pamiątkowe miejsce";
  if (tags.historic === "archaeological_site") return "Stanowisko archeologiczne";
  if (tags.natural === "peak") return tags.ele ? `Szczyt (${tags.ele} m)` : "Szczyt";
  if (tags.natural === "cliff") return "Klif";
  if (tags.natural === "waterfall") return "Wodospad";
  if (tags.natural === "beach") return "Plaża";
  if (tags.man_made === "tower") {
    return tags["tower:type"] === "observation"
      ? "Wieża widokowa"
      : "Wieża";
  }
  if (tags.man_made === "lighthouse") return "Latarnia morska";
  if (tags.leisure === "park") return "Park";
  if (tags.leisure === "nature_reserve") return "Rezerwat przyrody";
  if (tags.boundary === "protected_area") return "Obszar chroniony";
  return "Bez nazwy";
}

function elementToPoi(el: OverpassElement): OverpassPoi | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  // Prefer the OSM `name`; fall back to a human-readable label derived
  // from tags so unnamed outdoor features still render meaningfully.
  const name = tags.name ?? synthesizeName(tags);
  const prefix = el.type[0].toUpperCase();
  const categoryHint =
    tags.amenity ??
    tags.shop ??
    tags.tourism ??
    tags.historic ??
    tags.leisure ??
    tags.natural ??
    tags.man_made ??
    tags.boundary ??
    "";
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
        // Dedupe multiple OSM type variants of the same place. With
        // synthesized fallback names many unnamed POIs would all
        // collide on the same fake "Bez nazwy" key, so include the
        // OSM type prefix too — keeps node/way/relation duplicates
        // collapsed but preserves distinct nearby features.
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
