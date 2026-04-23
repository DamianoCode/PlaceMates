"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { createPlace } from "@/domain/places/service";
import { CreatePlaceInput } from "@/lib/validation/place";

export type CreatePlaceState =
  | { error: string }
  | { ok: true; id: string }
  | null;

export async function createPlaceAction(
  _: CreatePlaceState,
  formData: FormData,
): Promise<CreatePlaceState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const parsed = CreatePlaceInput.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    groupId: formData.get("groupId"),
    location: {
      lat: Number(formData.get("lat")),
      lng: Number(formData.get("lng")),
    },
    address: (formData.get("address") as string) || undefined,
    osmId: (formData.get("osmId") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: "Niepoprawne dane miejsca." };
  }

  const result = await createPlace(parsed.data, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath("/map");
  revalidatePath("/places");
  redirect(`/places/${result.data.id}`);
}
