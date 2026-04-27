export type PoiResult = {
  /**
   * Provider identity. Two halves so canonical_places can dedupe by
   * `(provider, external_id)` regardless of which backend hit. For OSM
   * sources we keep external_id in the legacy "N123"/"W123"/"R123"
   * format; for Geoapify we use their `place_id` opaque token.
   */
  provider: "osm" | "geoapify";
  externalId: string;
  /**
   * @deprecated Use `provider` + `externalId`. Retained as a transitional
   * alias for callers still threading raw OSM ids through `osm_id`
   * columns; equals `externalId` when `provider === "osm"`, "" otherwise.
   */
  osmId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Best-guess category hint (e.g. "restaurant", "cafe"). Empty if unknown. */
  categoryHint: string;
};

/**
 * Optional knobs every provider may honour. None are required — a
 * provider that ignores them still satisfies the interface.
 */
export type PoiSearchOptions = {
  limit?: number;
  /**
   * Pull results near this point to the top. Each provider applies it
   * differently (Photon/Geoapify: native bias param; Nominatim: derived
   * viewbox without `bounded` so far results still rank).
   */
  bias?: { lat: number; lng: number };
};

export interface PoiSearch {
  search(query: string, opts?: PoiSearchOptions): Promise<PoiResult[]>;
  reverse(lat: number, lng: number): Promise<PoiResult | null>;
}
