"use server";

import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import { toggleFavorite } from "@/domain/favorites/service";

export type ToggleState =
  | { error: string }
  | { ok: true; isFavorite: boolean }
  | null;

export async function toggleFavoriteAction(
  _: ToggleState,
  formData: FormData,
): Promise<ToggleState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };
  const placeId = formData.get("placeId") as string | null;
  if (!placeId) return { error: "Brak identyfikatora miejsca." };
  const result = await toggleFavorite(placeId, user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/places/${placeId}`);
  revalidatePath("/favorites");
  revalidatePath("/map");
  return { ok: true, isFavorite: result.data.isFavorite };
}
