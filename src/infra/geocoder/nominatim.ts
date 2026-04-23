import type { PoiResult, PoiSearch } from "./provider";

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
  return {
    osmId: toOsmId(hit.osm_type, hit.osm_id),
    name,
    address: hit.display_name,
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    categoryHint,
  };
}

export function createNominatim(userAgent: string): PoiSearch {
  const headers = { "User-Agent": userAgent, Accept: "application/json" };

  return {
    async search(query, limit = 10) {
      if (query.trim().length < 2) return [];
      const url = new URL(`${BASE}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", String(Math.min(limit, 20)));
      url.searchParams.set("addressdetails", "1");
      const res = await fetch(url, { headers, cache: "no-store" });
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
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as NominatimHit;
      if (!data.osm_id) return null;
      return toResult(data);
    },
  };
}
