"use server";

import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import {
  addStop,
  addStops,
  createTrip,
  deleteTrip,
  removeStop,
  reorderStops,
  toggleStopCompleted,
  updateStop,
  updateTrip,
} from "@/domain/trips/service";
import { err, type Result } from "@/domain/result";

/**
 * Server actions for the trip planner. Each one auths the user and
 * delegates to the domain service. Path revalidation: `/plans` for
 * lists, `/plans/[id]` for the trip detail; `/places/[id]` when a
 * place's "in plans" affordance might change.
 */

export async function createTripAction(input: {
  groupId: string;
  name: string;
  plannedFor: string | null;
  description?: string | null;
  firstPlaceId?: string;
}): Promise<Result<{ id: string }>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const plannedFor = input.plannedFor
    ? parseDateOnly(input.plannedFor)
    : null;
  if (input.plannedFor && plannedFor === null) {
    return err("Niepoprawna data.");
  }

  const result = await createTrip(
    {
      groupId: input.groupId,
      name: input.name,
      plannedFor,
      description: input.description ?? null,
      firstPlaceId: input.firstPlaceId,
    },
    user.id,
  );
  if (!result.ok) return result;

  revalidatePath("/plans");
  if (input.firstPlaceId) {
    revalidatePath(`/places/${input.firstPlaceId}`);
  }
  return result;
}

export async function updateTripAction(input: {
  tripId: string;
  name?: string;
  description?: string | null;
  plannedFor?: string | null;
}): Promise<Result<null>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const plannedFor =
    input.plannedFor === undefined
      ? undefined
      : input.plannedFor === null
        ? null
        : parseDateOnly(input.plannedFor);
  if (input.plannedFor && plannedFor === null) {
    return err("Niepoprawna data.");
  }

  const result = await updateTrip(
    {
      tripId: input.tripId,
      name: input.name,
      description: input.description,
      plannedFor: plannedFor as Date | null | undefined,
    },
    user.id,
  );
  if (!result.ok) return result;

  revalidatePath("/plans");
  revalidatePath(`/plans/${input.tripId}`);
  return result;
}

export async function deleteTripAction(
  tripId: string,
): Promise<Result<null>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const result = await deleteTrip(tripId, user.id);
  if (!result.ok) return result;

  revalidatePath("/plans");
  return result;
}

export async function addStopAction(
  tripId: string,
  placeId: string,
): Promise<Result<{ id: string }>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const result = await addStop(tripId, placeId, user.id);
  if (!result.ok) return result;

  revalidatePath(`/plans/${tripId}`);
  revalidatePath(`/places/${placeId}`);
  revalidatePath("/plans");
  return result;
}

export async function addStopsAction(
  tripId: string,
  placeIds: string[],
): Promise<Result<{ added: number; skipped: number }>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const result = await addStops(tripId, placeIds, user.id);
  if (!result.ok) return result;

  revalidatePath(`/plans/${tripId}`);
  revalidatePath("/plans");
  // Each affected place's "Do planu" affordance might flip.
  for (const id of placeIds) revalidatePath(`/places/${id}`);
  return result;
}

export async function removeStopAction(
  stopId: string,
  tripId: string,
): Promise<Result<null>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const result = await removeStop(stopId, user.id);
  if (!result.ok) return result;

  revalidatePath(`/plans/${tripId}`);
  revalidatePath("/plans");
  return result;
}

export async function reorderStopsAction(
  tripId: string,
  orderedStopIds: string[],
): Promise<Result<null>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const result = await reorderStops(tripId, orderedStopIds, user.id);
  if (!result.ok) return result;

  revalidatePath(`/plans/${tripId}`);
  return result;
}

export async function toggleStopCompletedAction(
  stopId: string,
  tripId: string,
): Promise<Result<{ completed: boolean }>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const result = await toggleStopCompleted(stopId, user.id);
  if (!result.ok) return result;

  revalidatePath(`/plans/${tripId}`);
  revalidatePath("/plans");
  return result;
}

export async function updateStopAction(input: {
  stopId: string;
  tripId: string;
  plannedAtTime?: string | null;
  note?: string | null;
}): Promise<Result<null>> {
  const user = await (await getAuth()).getUser();
  if (!user) return err("Wymagane zalogowanie.");

  const result = await updateStop(
    {
      stopId: input.stopId,
      plannedAtTime: input.plannedAtTime,
      note: input.note,
    },
    user.id,
  );
  if (!result.ok) return result;

  revalidatePath(`/plans/${input.tripId}`);
  return result;
}

/** Strict YYYY-MM-DD parse — anything else returns null. The Date
 *  constructor accepts a lot of fuzzy formats which we don't want
 *  bleeding through from form inputs. */
function parseDateOnly(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
