"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import {
  addItemPhoto,
  createItem,
  deleteItem,
  deleteItemRating,
  getItemForUser,
  upsertItemRating,
} from "@/domain/items/service";
import { CreateItemInput, RateItemInput } from "@/lib/validation/item";

type State<T extends object = object> =
  | { error: string }
  | ({ ok: true } & T)
  | null;

export type CreateItemState = State<{ id: string }>;

export async function createItemAction(
  _: CreateItemState,
  formData: FormData,
): Promise<CreateItemState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const parsed = CreateItemInput.safeParse({
    placeId: formData.get("placeId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: "Niepoprawne dane." };

  const result = await createItem(parsed.data.placeId, parsed.data.name, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/places/${parsed.data.placeId}`);
  return { ok: true, id: result.data.id };
}

export type RateItemState = State;

export async function rateItemAction(
  _: RateItemState,
  formData: FormData,
): Promise<RateItemState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const parsed = RateItemInput.safeParse({
    itemId: formData.get("itemId"),
    score: Number(formData.get("score")),
    note: (formData.get("note") as string) || undefined,
  });
  if (!parsed.success) return { error: "Niepoprawna ocena." };

  const result = await upsertItemRating(
    parsed.data.itemId,
    user.id,
    parsed.data.score,
    parsed.data.note ?? null,
  );
  if (!result.ok) return { error: result.error };

  // Revalidate the place detail (shows item stats) and the item detail.
  const item = await getItemForUser(parsed.data.itemId, user.id);
  if (item) {
    revalidatePath(`/places/${item.placeId}`);
    revalidatePath(`/places/${item.placeId}/items/${item.id}`);
  }
  return { ok: true };
}

export type DeleteItemState = State;

export async function deleteItemAction(
  _: DeleteItemState,
  formData: FormData,
): Promise<DeleteItemState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const itemId = formData.get("itemId") as string | null;
  if (!itemId) return { error: "Brak produktu." };

  const item = await getItemForUser(itemId, user.id);
  if (!item) return { error: "Nie znaleziono produktu." };

  const result = await deleteItem(itemId, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/places/${item.placeId}`);
  redirect(`/places/${item.placeId}`);
}

export type AddItemPhotoState = State;

export async function addItemPhotoAction(
  _: AddItemPhotoState,
  formData: FormData,
): Promise<AddItemPhotoState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const itemId = formData.get("itemId") as string | null;
  const file = formData.get("photo") as File | null;
  if (!itemId) return { error: "Brak produktu." };
  if (!file || file.size === 0) return { error: "Wybierz plik." };
  if (file.size > 8 * 1024 * 1024) return { error: "Plik większy niż 8 MB." };
  if (!file.type.startsWith("image/")) return { error: "Tylko obrazy." };

  const width = Number(formData.get("width") ?? 0);
  const height = Number(formData.get("height") ?? 0);

  const result = await addItemPhoto(itemId, user.id, file, {
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  });
  if (!result.ok) return { error: result.error };

  const item = await getItemForUser(itemId, user.id);
  if (item) {
    revalidatePath(`/places/${item.placeId}`);
    revalidatePath(`/places/${item.placeId}/items/${item.id}`);
  }
  return { ok: true };
}

export type DeleteItemRatingState = { error: string } | { ok: true } | null;

export async function deleteItemRatingAction(
  _: DeleteItemRatingState,
  formData: FormData,
): Promise<DeleteItemRatingState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const itemId = formData.get("itemId") as string | null;
  if (!itemId) return { error: "Brak produktu." };

  const result = await deleteItemRating(itemId, user.id);
  if (!result.ok) return { error: result.error };

  const item = await getItemForUser(itemId, user.id);
  if (item) {
    revalidatePath(`/places/${item.placeId}`);
    revalidatePath(`/places/${item.placeId}/items/${item.id}`);
  }
  return { ok: true };
}
