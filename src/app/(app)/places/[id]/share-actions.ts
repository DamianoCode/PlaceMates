"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import { db } from "@/infra/db/client";
import { ratings } from "@/infra/db/schema";
import { createShare, revokeShare } from "@/domain/sharing/service";

export type ShareState =
  | { error: string }
  | { ok: true; slug: string | null }
  | null;

export async function createShareAction(
  _: ShareState,
  formData: FormData,
): Promise<ShareState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };
  const placeId = formData.get("placeId") as string | null;
  if (!placeId) return { error: "Brak miejsca." };

  // Find the user's rating for this place (the one we're sharing).
  const [myRating] = await db
    .select({ id: ratings.id })
    .from(ratings)
    .where(and(eq(ratings.placeId, placeId), eq(ratings.userId, user.id)))
    .limit(1);
  if (!myRating) return { error: "Najpierw wystaw ocenę, potem ją udostępnisz." };

  const res = await createShare(myRating.id, user.id);
  if (!res.ok) return { error: res.error };

  revalidatePath(`/places/${placeId}`);
  return { ok: true, slug: res.data.slug };
}

export async function revokeShareAction(
  _: ShareState,
  formData: FormData,
): Promise<ShareState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };
  const slug = formData.get("slug") as string | null;
  const placeId = formData.get("placeId") as string | null;
  if (!slug) return { error: "Brak identyfikatora udostępnienia." };

  const res = await revokeShare(slug, user.id);
  if (!res.ok) return { error: res.error };

  if (placeId) revalidatePath(`/places/${placeId}`);
  return { ok: true, slug: null };
}
