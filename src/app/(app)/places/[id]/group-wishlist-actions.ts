"use server";

import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import { toggleGroupWishlist } from "@/domain/group-wishlist/service";

export type ToggleGroupWishlistState =
  | { error: string }
  | { ok: true; onGroupWishlist: boolean }
  | null;

export async function toggleGroupWishlistAction(
  _: ToggleGroupWishlistState,
  formData: FormData,
): Promise<ToggleGroupWishlistState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const placeId = formData.get("placeId") as string | null;
  if (!placeId) return { error: "Brak identyfikatora miejsca." };

  const result = await toggleGroupWishlist(placeId, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/places/${placeId}`);
  // /places list shows the group-wishlist filter pill — refresh.
  revalidatePath("/places");
  // Map also surfaces the marker badge.
  revalidatePath("/map");
  return { ok: true, onGroupWishlist: result.data.onGroupWishlist };
}
