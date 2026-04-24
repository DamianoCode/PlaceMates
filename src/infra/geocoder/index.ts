import { createNominatim } from "./nominatim";
import { createPhoton } from "./photon";
import { createStack } from "./stack";
import type { PoiSearch } from "./provider";

export type { PoiSearch, PoiResult } from "./provider";

/**
 * Photon first (better fuzzy + diacritic tolerance, uses OSM data),
 * Nominatim as a fallback. Both are keyless and share OSM as a source;
 * between them we cover the vast majority of user queries.
 */
export function getPoiSearch(): PoiSearch {
  const ua =
    process.env.NOMINATIM_USER_AGENT ??
    "PlaceMates (https://github.com/local/placemates)";
  return createStack([createPhoton(ua, "pl"), createNominatim(ua)]);
}
