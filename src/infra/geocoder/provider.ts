export type PoiResult = {
  /** OSM id in the form "N123"/"W123"/"R123" (type prefix + id). */
  osmId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Best-guess category hint (e.g. "restaurant", "cafe"). Empty if unknown. */
  categoryHint: string;
};

export interface PoiSearch {
  search(query: string, limit?: number): Promise<PoiResult[]>;
  reverse(lat: number, lng: number): Promise<PoiResult | null>;
}
