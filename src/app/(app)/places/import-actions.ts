"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuth } from "@/infra/auth";
import { bulkCreatePlaces } from "@/domain/places/service";

const BulkInput = z.object({
  groupId: z.string().uuid(),
  categoryId: z.string().uuid(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        address: z.string().max(500).nullable(),
        // Either the legacy `osmId` (kept for old clients) or the
        // explicit (provider, externalId) pair the multi-provider
        // nearby flow now ships.
        osmId: z.string().max(64).nullable().optional(),
        provider: z.enum(["osm", "geoapify"]).nullable().optional(),
        externalId: z.string().max(128).nullable().optional(),
      }),
    )
    .min(1)
    .max(200),
});

export type ImportResult =
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string };

export async function bulkImportAction(
  payload: unknown,
): Promise<ImportResult> {
  const user = await (await getAuth()).getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const parsed = BulkInput.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane importu." };

  const result = await bulkCreatePlaces(
    parsed.data.groupId,
    parsed.data.categoryId,
    parsed.data.items,
    user.id,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/map");
  revalidatePath("/places");
  return { ok: true, inserted: result.data.inserted, skipped: result.data.skipped };
}
