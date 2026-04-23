"use server";

import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import { toggleWishlist } from "@/domain/wishlist/service";

export type ToggleState = { error: string } | { ok: true; onWishlist: boolean } | null;

export async function toggleWishlistAction(
  _: ToggleState,
  formData: FormData,
): Promise<ToggleState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };
  const placeId = formData.get("placeId") as string | null;
  if (!placeId) return { error: "Brak identyfikatora miejsca." };
  const result = await toggleWishlist(placeId, user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/places/${placeId}`);
  revalidatePath("/wishlist");
  revalidatePath("/map");
  return { ok: true, onWishlist: result.data.onWishlist };
}
