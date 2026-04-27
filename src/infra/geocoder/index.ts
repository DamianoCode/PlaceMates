import { createGeoapify } from "./geoapify";
import { createNominatim } from "./nominatim";
import { createPhoton } from "./photon";
import { createStack } from "./stack";
import type { PoiSearch } from "./provider";

export type { PoiSearch, PoiResult, PoiSearchOptions } from "./provider";

/**
 * Provider stack, ordered by quality of POI ranking (best first):
 *
 *   Geoapify (when GEOAPIFY_API_KEY is set) → Photon → Nominatim.
 *
 * Geoapify augments OSM with their own POI feed and natively supports
 * proximity bias, so for small-town queries it's noticeably better
 * than bare Photon. We treat the API key as optional — when absent we
 * fall back to the keyless Photon+Nominatim pair, so dev environments
 * and self-hosters still work out of the box.
 */
export function getPoiSearch(): PoiSearch {
  const ua =
    process.env.NOMINATIM_USER_AGENT ??
    "PlaceMates (https://github.com/local/placemates)";
  const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  const providers: PoiSearch[] = [];
  if (geoapifyKey) providers.push(createGeoapify(geoapifyKey, "pl"));
  providers.push(createPhoton(ua, "pl"));
  providers.push(createNominatim(ua));
  return createStack(providers);
}
