import { z } from "zod";

export const RatingDimensionDef = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  min: z.number().int().min(0).max(10),
  max: z.number().int().min(1).max(10),
}).refine((d) => d.max > d.min, "max must be greater than min");

export const RatingSchema = z.array(RatingDimensionDef).min(1).max(10);
export type RatingSchema = z.infer<typeof RatingSchema>;

export const UpsertRatingInput = z.object({
  placeId: z.string().uuid(),
  dimensions: z.record(z.string(), z.number()),
  note: z.string().max(2000).optional(),
});
export type UpsertRatingInput = z.infer<typeof UpsertRatingInput>;

/** Average of dimension values clamped to [0, 5]-style scale. */
export function computeOverall(dims: Record<string, number>, schema: RatingSchema): number {
  if (schema.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const d of schema) {
    const v = dims[d.key];
    if (typeof v !== "number") continue;
    // Normalize to 0..5 regardless of the dimension's own scale.
    const norm = ((v - d.min) / (d.max - d.min)) * 5;
    sum += norm;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.round((sum / count) * 100) / 100;
}
