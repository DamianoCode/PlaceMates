import { z } from "zod";

export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const CreatePlaceInput = z.object({
  name: z.string().min(1).max(200),
  categoryId: z.string().uuid(),
  groupId: z.string().uuid(),
  location: LatLng,
  address: z.string().max(500).optional(),
  osmId: z.string().max(64).optional(),
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
