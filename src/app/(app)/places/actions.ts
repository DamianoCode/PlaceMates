"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { createPlace, deletePlace, updatePlace } from "@/domain/places/service";
import { CreatePlaceInput, UpdatePlaceInput } from "@/lib/validation/place";

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

export type UpdatePlaceState = { error: string } | { ok: true } | null;

export async function updatePlaceAction(
  _: UpdatePlaceState,
  formData: FormData,
): Promise<UpdatePlaceState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const parsed = UpdatePlaceInput.safeParse({
    placeId: formData.get("placeId"),
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    location: {
      lat: Number(formData.get("lat")),
      lng: Number(formData.get("lng")),
    },
    address: (formData.get("address") as string) || undefined,
  });
  if (!parsed.success) return { error: "Niepoprawne dane miejsca." };

  const result = await updatePlace(parsed.data, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath("/map");
  revalidatePath("/places");
  revalidatePath(`/places/${parsed.data.placeId}`);
  redirect(`/places/${parsed.data.placeId}`);
}

export type DeletePlaceState = { error: string } | { ok: true } | null;

export async function deletePlaceAction(
  _: DeletePlaceState,
  formData: FormData,
): Promise<DeletePlaceState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const placeId = formData.get("placeId") as string | null;
  if (!placeId) return { error: "Brak identyfikatora miejsca." };

  const result = await deletePlace(placeId, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath("/map");
  revalidatePath("/places");
  revalidatePath("/wishlist");
  revalidatePath("/favorites");
  redirect("/map");
}
