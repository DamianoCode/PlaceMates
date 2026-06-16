"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import { getCategory } from "@/domain/categories/service";
import { getPlaceForUser } from "@/domain/places/service";
import { deleteRating, upsertRating } from "@/domain/ratings/service";
import { addVisit, deleteVisit } from "@/domain/visits/service";
import { addPhoto, deletePhoto, setCoverPhoto } from "@/domain/photos/service";
import { pushRatingCreated } from "@/infra/push/events";
import { recordPhotoAdded, recordRatingAdded } from "@/domain/activity/service";

type ActionState = { error: string } | { ok: true } | null;

export async function submitRatingAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const placeId = formData.get("placeId") as string | null;
  if (!placeId) return { error: "Brak identyfikatora miejsca." };

  const place = await getPlaceForUser(placeId, user.id);
  if (!place) return { error: "Nie znaleziono miejsca." };

  const category = await getCategory(place.categoryId);
  if (!category) return { error: "Nie znaleziono kategorii." };

  const dimensions: Record<string, number> = {};
  for (const dim of category.ratingSchema) {
    const raw = formData.get(`dim_${dim.key}`);
    if (raw === null || raw === "") continue;
    const num = Number(raw);
    if (Number.isNaN(num)) return { error: `Niepoprawna wartość: ${dim.label}` };
    dimensions[dim.key] = num;
  }
  if (Object.keys(dimensions).length === 0) {
    return { error: "Ocena przynajmniej jednego wymiaru jest wymagana." };
  }

  const note = ((formData.get("note") as string) ?? "").trim() || null;

  const result = await upsertRating(
    placeId,
    user.id,
    dimensions,
    note,
    category.ratingSchema,
  );
  if (!result.ok) return { error: result.error };

  revalidatePath(`/places/${placeId}`);
  revalidatePath("/map");
  // Fire-and-forget push to the place creator. `after` keeps the
  // serverless instance alive until this resolves, but the user's
  // response has already been sent — zero added latency.
  after(() => pushRatingCreated(user.id, placeId, result.data.overall));
  after(() => recordRatingAdded(user.id, placeId, result.data.overall));
  return { ok: true };
}

export async function addVisitAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const placeId = formData.get("placeId") as string | null;
  if (!placeId) return { error: "Brak identyfikatora miejsca." };

  const note = ((formData.get("note") as string) ?? "").trim() || null;
  const result = await addVisit(placeId, user.id, note);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/places/${placeId}`);
  return { ok: true };
}

export async function addPhotoAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const placeId = formData.get("placeId") as string | null;
  const file = formData.get("photo") as File | null;
  if (!placeId) return { error: "Brak identyfikatora miejsca." };
  if (!file || file.size === 0) return { error: "Wybierz plik." };
  if (file.size > 8 * 1024 * 1024) return { error: "Plik większy niż 8 MB." };
  if (!file.type.startsWith("image/")) return { error: "Tylko obrazy." };

  const width = Number(formData.get("width") ?? 0);
  const height = Number(formData.get("height") ?? 0);

  const result = await addPhoto(placeId, user.id, file, {
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/places/${placeId}`);
  after(() => recordPhotoAdded(user.id, placeId));
  return { ok: true };
}

export type SetCoverState = { error: string } | { ok: true } | null;

export async function setCoverPhotoAction(
  _: SetCoverState,
  formData: FormData,
): Promise<SetCoverState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const photoId = formData.get("photoId") as string | null;
  if (!photoId) return { error: "Brak zdjęcia." };

  const result = await setCoverPhoto(photoId, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/places/${result.data.placeId}`);
  revalidatePath("/map");
  revalidatePath("/places");
  return { ok: true };
}

export type DeletePhotoState = { error: string } | { ok: true } | null;

export async function deletePhotoAction(
  _: DeletePhotoState,
  formData: FormData,
): Promise<DeletePhotoState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const photoId = formData.get("photoId") as string | null;
  if (!photoId) return { error: "Brak zdjęcia." };

  const result = await deletePhoto(photoId, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/places/${result.data.placeId}`);
  revalidatePath("/map");
  revalidatePath("/places");
  return { ok: true };
}

export type DeleteVisitState = { error: string } | { ok: true } | null;

export async function deleteVisitAction(
  _: DeleteVisitState,
  formData: FormData,
): Promise<DeleteVisitState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const visitId = formData.get("visitId") as string | null;
  const placeId = formData.get("placeId") as string | null;
  if (!visitId) return { error: "Brak wpisu." };

  const result = await deleteVisit(visitId, user.id);
  if (!result.ok) return { error: result.error };
  if (placeId) revalidatePath(`/places/${placeId}`);
  return { ok: true };
}

export type DeleteRatingState = { error: string } | { ok: true } | null;

export async function deleteRatingAction(
  _: DeleteRatingState,
  formData: FormData,
): Promise<DeleteRatingState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const placeId = formData.get("placeId") as string | null;
  if (!placeId) return { error: "Brak miejsca." };

  const result = await deleteRating(placeId, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/places/${placeId}`);
  revalidatePath("/map");
  return { ok: true };
}
