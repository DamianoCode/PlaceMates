import type { PoiResult, PoiSearch } from "./provider";
import { fetchWithTimeout } from "./fetch-with-timeout";

/**
 * Photon (https://photon.komoot.io) — OSM-backed search with better
 * fuzzy matching, diacritic tolerance, and ranking than raw Nominatim.
 * No API key. Respect their public instance fair-use policy: ≤1 req/s,
 * set a descriptive User-Agent, don't scrape.
 */
const BASE = "https://photon.komoot.io/api";

type PhotonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: "N" | "W" | "R" | "node" | "way" | "relation";
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    postcode?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    district?: string;
    county?: string;
  };
};

type PhotonResponse = {
  features: PhotonFeature[];
};

function toOsmTypePrefix(type?: string): string {
  if (!type) return "N";
  const first = type[0].toUpperCase();
  return first === "N" || first === "W" || first === "R" ? first : "N";
}

function formatAddress(p: PhotonFeature["properties"]): string {
  const parts = [
    [p.street, p.housenumber].filter(Boolean).join(" "),
    p.postcode,
    p.city ?? p.district ?? p.county,
    p.state,
    p.country,
  ].filter((s): s is string => !!s && s.length > 0);
  return parts.join(", ");
}

function toResult(f: PhotonFeature): PoiResult {
  const [lng, lat] = f.geometry.coordinates;
  const p = f.properties;
  const prefix = toOsmTypePrefix(p.osm_type);
  const externalId = p.osm_id ? `${prefix}${p.osm_id}` : "";
  return {
    provider: "osm",
    externalId,
    osmId: externalId,
    name: p.name ?? formatAddress(p).split(",")[0] ?? "",
    address: formatAddress(p),
    lat,
    lng,
    categoryHint: p.osm_value ?? p.osm_key ?? "",
  };
}

export function createPhoton(userAgent: string, defaultLang = "pl"): PoiSearch {
  const headers = { "User-Agent": userAgent, Accept: "application/json" };

  return {
    async search(query, opts) {
      if (query.trim().length < 2) return [];
      const url = new URL(`${BASE}/`);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(Math.min(opts?.limit ?? 10, 20)));
      url.searchParams.set("lang", defaultLang);
      // Soft proximity bias — pulls nearby results to the top without
      // hiding far-away ones. Critical for small-town queries that
      // would otherwise be drowned by warsaw/kraków hits.
      if (opts?.bias) {
        url.searchParams.set("lat", String(opts.bias.lat));
        url.searchParams.set("lon", String(opts.bias.lng));
        // Default scale is 0.2 (very weak); 1.6 keeps remote hits on
        // the page but reliably puts the user's neighbourhood first.
        url.searchParams.set("location_bias_scale", "1.6");
      }
      const res = await fetchWithTimeout(url, { headers, cache: "no-store" });
      if (!res.ok) return [];
      const data = (await res.json()) as PhotonResponse;
      return (data.features ?? []).filter((f) => f.properties?.name).map(toResult);
    },

    async reverse(lat, lng) {
      const url = new URL(`${BASE}/reverse`);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("lang", defaultLang);
      const res = await fetchWithTimeout(url, { headers, cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as PhotonResponse;
      const first = data.features?.[0];
      return first ? toResult(first) : null;
    },
  };
}
