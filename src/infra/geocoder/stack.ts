import type { PoiSearch } from "./provider";

/**
 * Tries geocoders in order; skips to the next when one returns no hits
 * or throws. Lets us ship Photon as the primary (better fuzzy matching)
 * while keeping Nominatim available as a last-resort fallback.
 */
export function createStack(providers: PoiSearch[]): PoiSearch {
  return {
    async search(query, limit) {
      for (const p of providers) {
        try {
          const hits = await p.search(query, limit);
          if (hits.length > 0) return hits;
        } catch {
          // fall through to the next provider
        }
      }
      return [];
    },

    async reverse(lat, lng) {
      for (const p of providers) {
        try {
          const hit = await p.reverse(lat, lng);
          if (hit) return hit;
        } catch {
          // fall through
        }
      }
      return null;
    },
  };
}
