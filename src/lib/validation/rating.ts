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

/**
 * Average of the dimension values, expressed on a 1..5 scale.
 *
 * Each dimension is normalized onto 1..5 so dimensions with a different
 * own scale still combine fairly. For the common case where a dimension
 * already uses 1..5 this is the identity, so the result is just the
 * plain average of the inputs (e.g. {4.5, 4, 4} → 4.17).
 *
 * The previous version normalized to 0..5 — `((v - min) / (max - min)) * 5`
 * — which mapped the scale floor (1) to 0 and pulled every score down
 * (a straight "3/5" surfaced as 2.5). Existing `ratings.overall` rows
 * written under that formula must be backfilled with this one.
 */
export function computeOverall(dims: Record<string, number>, schema: RatingSchema): number {
  if (schema.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const d of schema) {
    const v = dims[d.key];
    if (typeof v !== "number") continue;
    // Normalize onto 1..5 regardless of the dimension's own [min, max].
    const norm = 1 + ((v - d.min) / (d.max - d.min)) * 4;
    sum += norm;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.round((sum / count) * 100) / 100;
}
