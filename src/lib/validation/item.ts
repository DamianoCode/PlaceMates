import { z } from "zod";

export const CreateItemInput = z.object({
  placeId: z.string().uuid(),
  name: z.string().min(1).max(120),
});
export type CreateItemInput = z.infer<typeof CreateItemInput>;

// Half-step ratings in the 1.0 – 5.0 range.
const HalfStep = z
  .number()
  .min(1)
  .max(5)
  .refine((n) => Math.round(n * 2) === n * 2, "must be a half step");

export const RateItemInput = z.object({
  itemId: z.string().uuid(),
  score: HalfStep,
  note: z.string().max(2000).optional(),
});
export type RateItemInput = z.infer<typeof RateItemInput>;
