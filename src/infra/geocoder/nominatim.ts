import type { PoiResult, PoiSearch } from "./provider";
import { fetchWithTimeout } from "./fetch-with-timeout";

const BASE = "https://nominatim.openstreetmap.org";

type NominatimHit = {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
};

function toOsmId(type: string, id: number): string {
  return `${type[0].toUpperCase()}${id}`;
}

function toResult(hit: NominatimHit): PoiResult {
  const name = hit.name ?? hit.display_name.split(",")[0] ?? "";
  const categoryHint = hit.type ?? hit.class ?? "";
  const externalId = toOsmId(hit.osm_type, hit.osm_id);
  return {
    provider: "osm",
    externalId,
    osmId: externalId,
    name,
    address: hit.display_name,
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    categoryHint,
  };
}

/** ~50km half-side viewbox around a point. Nominatim ranks inside-box
 *  hits higher; we leave `bounded=0` so far results still surface. */
function viewboxFromBias(bias: { lat: number; lng: number }): string {
  const dLat = 0.45; // ~50 km
  const dLng = 0.45 / Math.max(0.01, Math.cos((bias.lat * Math.PI) / 180));
  const left = bias.lng - dLng;
  const top = bias.lat + dLat;
  const right = bias.lng + dLng;
  const bottom = bias.lat - dLat;
  return `${left},${top},${right},${bottom}`;
}

export function createNominatim(userAgent: string): PoiSearch {
  const headers = { "User-Agent": userAgent, Accept: "application/json" };

  return {
    async search(query, opts) {
      if (query.trim().length < 2) return [];
      const url = new URL(`${BASE}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", String(Math.min(opts?.limit ?? 10, 20)));
      url.searchParams.set("addressdetails", "1");
      if (opts?.bias) {
        url.searchParams.set("viewbox", viewboxFromBias(opts.bias));
        // bounded=0 (default) keeps far hits as a tail; bias is a
        // ranking nudge, not a hard restrict.
      }
      const res = await fetchWithTimeout(url, { headers, cache: "no-store" });
      if (!res.ok) return [];
      const data = (await res.json()) as NominatimHit[];
      return data.map(toResult);
    },

    async reverse(lat, lng) {
      const url = new URL(`${BASE}/reverse`);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      const res = await fetchWithTimeout(url, { headers, cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as NominatimHit;
      if (!data.osm_id) return null;
      return toResult(data);
    },
  };
}
