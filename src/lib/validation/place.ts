import { z } from "zod";

export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * External provider tag. `osm` covers Photon/Nominatim/Overpass which
 * all return OSM ids; `geoapify` carries Geoapify's opaque place_id.
 * Pin-drops set neither and fall through to a local canonical.
 */
export const ExternalProvider = z.enum(["osm", "geoapify"]);
export type ExternalProvider = z.infer<typeof ExternalProvider>;

export const CreatePlaceInput = z.object({
  name: z.string().min(1).max(200),
  categoryId: z.string().uuid(),
  groupId: z.string().uuid(),
  location: LatLng,
  address: z.string().max(500).optional(),
  /**
   * @deprecated Prefer `provider` + `externalId`. Retained for forms
   * that still post `osmId`; treated as `provider='osm'` when present
   * and `provider`/`externalId` aren't.
   */
  osmId: z.string().max(64).optional(),
  provider: ExternalProvider.optional(),
  // Geoapify place_ids are opaque hex that encodes the POI name, so they
  // routinely run 100-212+ chars (a 200-char name can push ~870). The DB
  // column is unbounded `text`; this cap is only an abuse guard, so keep
  // it generous or long-named POIs silently fail to import.
  externalId: z.string().max(1024).optional(),
});
export type CreatePlaceInput = z.infer<typeof CreatePlaceInput>;

export const UpdatePlaceInput = z.object({
  placeId: z.string().uuid(),
  name: z.string().min(1).max(200),
  categoryId: z.string().uuid(),
  location: LatLng,
  address: z.string().max(500).optional(),
});
export type UpdatePlaceInput = z.infer<typeof UpdatePlaceInput>;

export const BBox = z.object({
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
});
export type BBox = z.infer<typeof BBox>;
