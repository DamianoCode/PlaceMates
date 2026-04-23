import { createNominatim } from "./nominatim";
import type { PoiSearch } from "./provider";

export type { PoiSearch, PoiResult } from "./provider";

export function getPoiSearch(): PoiSearch {
  const ua =
    process.env.NOMINATIM_USER_AGENT ??
    "ratings-app (https://github.com/local/ratings)";
  return createNominatim(ua);
}
