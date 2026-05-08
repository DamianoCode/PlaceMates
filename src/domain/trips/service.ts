import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  groupMembers,
  groups,
  photos,
  places,
  profiles,
  trips,
  tripStops,
} from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";
import { err, ok, type Result } from "../result";

/**
 * Trip (itinerary) domain. A trip belongs to a group; any group
 * member can add stops, reorder, mark complete. Only the creator or
 * a group owner can delete.
 *
 * Stops carry a group-level `completed_at` (anyone in the group can
 * mark them done) — separate from the per-user `visits` table which
 * is the personal history. A stop being "completed" means *the trip
 * checked it off*, not necessarily that any specific member visited.
 *
 * Cross-group: a stop's place must live in the same group as the
 * trip. Bringing a place from group A into a group B trip is done
 * via `sharePlaceToGroup` first — keeps the data model clean and
 * avoids confusing the "we visited it" semantics across boundaries.
 */

// Lifecycle / list views ------------------------------------------------

export type TripSummary = {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  plannedFor: Date | null;
  createdAt: Date;
  stopCount: number;
  completedCount: number;
};

export type TripsView = {
  active: TripSummary[];
  archived: TripSummary[];
};

/**
 * Trips visible to the user — every group they belong to, split into
 * "active" (something still to do, not yet past) and "archived"
 * (everything done, or planned date already gone). Empty trips count
 * as active drafts.
 */
export async function listTripsForUser(userId: string): Promise<TripsView> {
  // Single query — group join for name, sub-aggregate for stop counts.
  // We sort active by planned_for ASC (closest deadline first), archived
  // by created_at DESC (most recent past trips on top).
  const rows = await db.execute<{
    id: string;
    group_id: string;
    group_name: string;
    name: string;
    planned_for: Date | null;
    created_at: Date;
    stop_count: number;
    completed_count: number;
  }>(sql`
    SELECT t.id,
           t.group_id,
           g.name AS group_name,
           t.name,
           t.planned_for,
           t.created_at,
           COALESCE(s.stop_count, 0)::int AS stop_count,
           COALESCE(s.completed_count, 0)::int AS completed_count
      FROM ${trips} t
      JOIN ${groups} g ON g.id = t.group_id
      JOIN ${groupMembers} gm
        ON gm.group_id = t.group_id AND gm.user_id = ${userId}
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS stop_count,
               COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completed_count
          FROM ${tripStops}
         WHERE trip_id = t.id
      ) s ON true
     ORDER BY t.planned_for ASC NULLS LAST, t.created_at DESC
  `);

  const today = startOfToday();
  const summaries: TripSummary[] = rows.map((r) => ({
    id: r.id,
    groupId: r.group_id,
    groupName: r.group_name,
    name: r.name,
    plannedFor: r.planned_for,
    createdAt: r.created_at,
    stopCount: r.stop_count,
    completedCount: r.completed_count,
  }));

  const active: TripSummary[] = [];
  const archived: TripSummary[] = [];
  for (const s of summaries) {
    if (isArchived(s, today)) archived.push(s);
    else active.push(s);
  }
  // Active stays alpha-by-deadline (already from SQL); archived flipped
  // so most-recent past trips show first.
  archived.reverse();
  return { active, archived };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isArchived(s: TripSummary, today: Date): boolean {
  // All stops done → archived regardless of date.
  if (s.stopCount > 0 && s.completedCount === s.stopCount) return true;
  // Planned date in the past (and trip wasn't fully completed already
  // handled above) → archived. Open-ended trips (planned_for IS NULL)
  // never auto-archive — they sit in active until manually finished.
  if (s.plannedFor && s.plannedFor < today) return true;
  return false;
}

// Detail view ----------------------------------------------------------

export type TripStopView = {
  id: string;
  placeId: string;
  placeName: string;
  placeCategoryName: string;
  placeCategorySlug: string;
  placeAddress: string | null;
  placePhotoUrl: string | null;
  placeLat: number;
  placeLng: number;
  sortOrder: number;
  plannedAtTime: string | null;
  note: string | null;
  completedAt: Date | null;
  completedByDisplayName: string | null;
};

export type TripDetail = {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  description: string | null;
  plannedFor: Date | null;
  createdBy: string;
  createdAt: Date;
  stops: TripStopView[];
};

/**
 * Full trip payload for the detail page. Pulls every stop's place
 * info (name, category, photo cover, coords) so the list and map
 * views render without extra round-trips.
 */
export async function getTripForUser(
  tripId: string,
  userId: string,
): Promise<TripDetail | null> {
  const [tripRow] = await db
    .select({
      id: trips.id,
      groupId: trips.groupId,
      groupName: groups.name,
      name: trips.name,
      description: trips.description,
      plannedFor: trips.plannedFor,
      createdBy: trips.createdBy,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .innerJoin(groups, eq(groups.id, trips.groupId))
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, trips.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!tripRow) return null;

  const stopRows = await db.execute<{
    id: string;
    place_id: string;
    place_name: string;
    place_category_name: string;
    place_category_slug: string;
    place_address: string | null;
    place_lat: number;
    place_lng: number;
    sort_order: number;
    planned_at_time: string | null;
    note: string | null;
    completed_at: Date | null;
    completed_by_name: string | null;
    cover_storage_path: string | null;
  }>(sql`
    SELECT ts.id,
           ts.place_id,
           p.name AS place_name,
           c.name AS place_category_name,
           c.slug AS place_category_slug,
           p.address AS place_address,
           ST_Y(p.location::geometry)::float8 AS place_lat,
           ST_X(p.location::geometry)::float8 AS place_lng,
           ts.sort_order,
           ts.planned_at_time,
           ts.note,
           ts.completed_at,
           prof.display_name AS completed_by_name,
           ph.storage_path AS cover_storage_path
      FROM ${tripStops} ts
      JOIN ${places} p ON p.id = ts.place_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN ${profiles} prof ON prof.id = ts.completed_by
      LEFT JOIN LATERAL (
        SELECT ph2.storage_path
          FROM ${photos} ph2
         WHERE ph2.place_id = p.id
         ORDER BY ph2.is_cover DESC, ph2.created_at DESC
         LIMIT 1
      ) ph ON true
     WHERE ts.trip_id = ${tripId}
     ORDER BY ts.sort_order ASC
  `);

  const storage = await getStorage();
  const stops: TripStopView[] = stopRows.map((r) => ({
    id: r.id,
    placeId: r.place_id,
    placeName: r.place_name,
    placeCategoryName: r.place_category_name,
    placeCategorySlug: r.place_category_slug,
    placeAddress: r.place_address,
    placePhotoUrl: r.cover_storage_path
      ? storage.publicUrl(PHOTO_BUCKET, r.cover_storage_path)
      : null,
    placeLat: Number(r.place_lat),
    placeLng: Number(r.place_lng),
    sortOrder: r.sort_order,
    plannedAtTime: r.planned_at_time,
    note: r.note,
    completedAt: r.completed_at,
    completedByDisplayName: r.completed_by_name,
  }));

  return { ...tripRow, stops };
}

/**
 * Plans this place is already part of, scoped to the user's groups.
 * Powers AddToPlanButton — the dropdown can mark plans the place
 * already lives in (and disable re-adding).
 */
export async function tripsContainingPlace(
  placeId: string,
  userId: string,
): Promise<Array<{ tripId: string; tripName: string; plannedFor: Date | null }>> {
  const rows = await db
    .select({
      tripId: trips.id,
      tripName: trips.name,
      plannedFor: trips.plannedFor,
    })
    .from(tripStops)
    .innerJoin(trips, eq(trips.id, tripStops.tripId))
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, trips.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(tripStops.placeId, placeId));
  return rows;
}

/**
 * Plans the user can add this place to — every trip in the same
 * group as the place where the user is a member, minus trips the
 * place is already part of. Empty when the user has no eligible
 * trip OR every existing trip already contains it.
 */
export async function addablePlansForPlace(
  placeId: string,
  userId: string,
): Promise<{
  groupId: string;
  groupName: string;
  candidates: Array<{ id: string; name: string; plannedFor: Date | null }>;
  alreadyIn: Array<{ id: string; name: string }>;
}> {
  // Place lives in exactly one group; we can only add to trips in that
  // same group (cross-group share happens via sharePlaceToGroup first).
  const [placeRow] = await db
    .select({ groupId: places.groupId, groupName: groups.name })
    .from(places)
    .innerJoin(groups, eq(groups.id, places.groupId))
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, places.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(places.id, placeId))
    .limit(1);
  if (!placeRow) {
    return {
      groupId: "",
      groupName: "",
      candidates: [],
      alreadyIn: [],
    };
  }

  const allInGroup = await db
    .select({
      id: trips.id,
      name: trips.name,
      plannedFor: trips.plannedFor,
    })
    .from(trips)
    .where(eq(trips.groupId, placeRow.groupId))
    .orderBy(asc(trips.plannedFor), desc(trips.createdAt));

  const occupied = await db
    .select({ tripId: tripStops.tripId })
    .from(tripStops)
    .where(eq(tripStops.placeId, placeId));
  const occupiedSet = new Set(occupied.map((r) => r.tripId));

  const candidates: Array<{
    id: string;
    name: string;
    plannedFor: Date | null;
  }> = [];
  const alreadyIn: Array<{ id: string; name: string }> = [];
  for (const t of allInGroup) {
    if (occupiedSet.has(t.id)) {
      alreadyIn.push({ id: t.id, name: t.name });
    } else {
      candidates.push(t);
    }
  }
  return {
    groupId: placeRow.groupId,
    groupName: placeRow.groupName,
    candidates,
    alreadyIn,
  };
}

// Auth helpers --------------------------------------------------------

async function userMemberOfTripGroup(
  tripId: string,
  userId: string,
): Promise<{ tripGroupId: string } | null> {
  const [row] = await db
    .select({ groupId: trips.groupId })
    .from(trips)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, trips.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(trips.id, tripId))
    .limit(1);
  return row ? { tripGroupId: row.groupId } : null;
}

// Mutations -----------------------------------------------------------

export type CreateTripInput = {
  groupId: string;
  name: string;
  plannedFor: Date | null;
  description?: string | null;
  /** Optional first stop — convenient for "Nowy plan z tego miejsca". */
  firstPlaceId?: string;
};

export async function createTrip(
  input: CreateTripInput,
  userId: string,
): Promise<Result<{ id: string }>> {
  const name = input.name.trim();
  if (name.length === 0) return err("Nazwa planu jest wymagana.");
  if (name.length > 200) return err("Nazwa za długa (max 200).");

  // Membership check.
  const [member] = await db
    .select({ id: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, input.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .limit(1);
  if (!member) return err("Nie należysz do tej grupy.");

  // If a first stop is supplied, verify it's in the same group as the
  // trip — keeps the cross-group invariant intact from creation.
  if (input.firstPlaceId) {
    const [placeRow] = await db
      .select({ groupId: places.groupId })
      .from(places)
      .where(eq(places.id, input.firstPlaceId))
      .limit(1);
    if (!placeRow) return err("Brak takiego miejsca.");
    if (placeRow.groupId !== input.groupId) {
      return err("Miejsce nie należy do tej grupy.");
    }
  }

  const [created] = await db
    .insert(trips)
    .values({
      groupId: input.groupId,
      name,
      description: input.description?.trim() || null,
      plannedFor: input.plannedFor,
      createdBy: userId,
    })
    .returning({ id: trips.id });

  if (input.firstPlaceId) {
    await db.insert(tripStops).values({
      tripId: created.id,
      placeId: input.firstPlaceId,
      sortOrder: 0,
    });
  }

  return ok({ id: created.id });
}

export type UpdateTripInput = {
  tripId: string;
  name?: string;
  description?: string | null;
  plannedFor?: Date | null;
};

export async function updateTrip(
  input: UpdateTripInput,
  userId: string,
): Promise<Result<null>> {
  const auth = await userMemberOfTripGroup(input.tripId, userId);
  if (!auth) return err("Nie należysz do tej grupy.");

  const patch: Partial<typeof trips.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length === 0) return err("Nazwa planu jest wymagana.");
    if (trimmed.length > 200) return err("Nazwa za długa (max 200).");
    patch.name = trimmed;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.plannedFor !== undefined) {
    patch.plannedFor = input.plannedFor;
  }

  await db.update(trips).set(patch).where(eq(trips.id, input.tripId));
  return ok(null);
}

/**
 * Trip deletion — only by the creator OR a group owner. Mirrors the
 * place-deletion permission model so the same mental rules apply
 * across the app.
 */
export async function deleteTrip(
  tripId: string,
  userId: string,
): Promise<Result<null>> {
  const [row] = await db
    .select({ id: trips.id })
    .from(trips)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, trips.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(
      and(
        eq(trips.id, tripId),
        or(eq(trips.createdBy, userId), eq(groupMembers.role, "owner")),
      ),
    )
    .limit(1);
  if (!row) {
    return err("Tylko autor planu lub właściciel grupy może go usunąć.");
  }

  await db.delete(trips).where(eq(trips.id, tripId));
  return ok(null);
}

export async function addStop(
  tripId: string,
  placeId: string,
  userId: string,
): Promise<Result<{ id: string }>> {
  const auth = await userMemberOfTripGroup(tripId, userId);
  if (!auth) return err("Nie należysz do tej grupy.");

  // Place must live in the same group as the trip.
  const [placeRow] = await db
    .select({ groupId: places.groupId })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  if (!placeRow) return err("Brak takiego miejsca.");
  if (placeRow.groupId !== auth.tripGroupId) {
    return err("Miejsce nie należy do tej grupy. Najpierw je udostępnij.");
  }

  // Idempotency: same place can only appear once per trip.
  const [existing] = await db
    .select({ id: tripStops.id })
    .from(tripStops)
    .where(
      and(eq(tripStops.tripId, tripId), eq(tripStops.placeId, placeId)),
    )
    .limit(1);
  if (existing) return ok({ id: existing.id });

  // Append at end. Sparse ints — we just take max+1 (or 0 for first).
  const [{ next }] = await db.execute<{ next: number }>(sql`
    SELECT COALESCE(MAX(sort_order) + 1, 0)::int AS next
      FROM ${tripStops}
     WHERE trip_id = ${tripId}
  `);

  const [inserted] = await db
    .insert(tripStops)
    .values({ tripId, placeId, sortOrder: Number(next) })
    .returning({ id: tripStops.id });

  await db
    .update(trips)
    .set({ updatedAt: new Date() })
    .where(eq(trips.id, tripId));

  return ok({ id: inserted.id });
}

export async function removeStop(
  stopId: string,
  userId: string,
): Promise<Result<null>> {
  // Auth via the parent trip in one query.
  const [row] = await db
    .select({ tripId: tripStops.tripId })
    .from(tripStops)
    .innerJoin(trips, eq(trips.id, tripStops.tripId))
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, trips.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(tripStops.id, stopId))
    .limit(1);
  if (!row) return err("Brak uprawnień.");

  await db.delete(tripStops).where(eq(tripStops.id, stopId));
  await db
    .update(trips)
    .set({ updatedAt: new Date() })
    .where(eq(trips.id, row.tripId));
  return ok(null);
}

/**
 * Bulk reorder. We accept the new order as an array of stop ids; any
 * stop in the trip that's missing from the array stays at the tail
 * (defensive — should never happen in practice, but better than
 * silently dropping rows).
 */
export async function reorderStops(
  tripId: string,
  orderedStopIds: string[],
  userId: string,
): Promise<Result<null>> {
  const auth = await userMemberOfTripGroup(tripId, userId);
  if (!auth) return err("Nie należysz do tej grupy.");
  if (orderedStopIds.length === 0) return ok(null);

  // Use a single CASE to update all rows in one statement — N rows but
  // one round-trip. Drizzle doesn't have a clean helper for that; raw
  // SQL is the cleanest path.
  const valuesSql = orderedStopIds.map(
    (id, idx) => sql`WHEN ${id}::uuid THEN ${idx}`,
  );

  await db.execute(sql`
    UPDATE ${tripStops}
       SET sort_order = CASE id ${sql.join(valuesSql, sql` `)} END
     WHERE trip_id = ${tripId}
       AND id IN (${sql.join(
         orderedStopIds.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
  `);
  await db
    .update(trips)
    .set({ updatedAt: new Date() })
    .where(eq(trips.id, tripId));
  return ok(null);
}

/**
 * Toggle whether the *group* has done this stop. Sets `completed_at`
 * + `completed_by` to (now, user) if pending; clears both if already
 * completed.
 */
export async function toggleStopCompleted(
  stopId: string,
  userId: string,
): Promise<Result<{ completed: boolean }>> {
  const [row] = await db
    .select({
      tripId: tripStops.tripId,
      completedAt: tripStops.completedAt,
    })
    .from(tripStops)
    .innerJoin(trips, eq(trips.id, tripStops.tripId))
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, trips.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(tripStops.id, stopId))
    .limit(1);
  if (!row) return err("Brak uprawnień.");

  const wasCompleted = row.completedAt !== null;
  await db
    .update(tripStops)
    .set({
      completedAt: wasCompleted ? null : new Date(),
      completedBy: wasCompleted ? null : userId,
    })
    .where(eq(tripStops.id, stopId));

  await db
    .update(trips)
    .set({ updatedAt: new Date() })
    .where(eq(trips.id, row.tripId));
  return ok({ completed: !wasCompleted });
}

export type UpdateStopInput = {
  stopId: string;
  plannedAtTime?: string | null;
  note?: string | null;
};

export async function updateStop(
  input: UpdateStopInput,
  userId: string,
): Promise<Result<null>> {
  const [row] = await db
    .select({ tripId: tripStops.tripId })
    .from(tripStops)
    .innerJoin(trips, eq(trips.id, tripStops.tripId))
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, trips.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(tripStops.id, input.stopId))
    .limit(1);
  if (!row) return err("Brak uprawnień.");

  const patch: Partial<typeof tripStops.$inferInsert> = {};
  if (input.plannedAtTime !== undefined) {
    patch.plannedAtTime = input.plannedAtTime?.trim() || null;
  }
  if (input.note !== undefined) {
    patch.note = input.note?.trim() || null;
  }
  if (Object.keys(patch).length === 0) return ok(null);

  await db
    .update(tripStops)
    .set(patch)
    .where(eq(tripStops.id, input.stopId));
  await db
    .update(trips)
    .set({ updatedAt: new Date() })
    .where(eq(trips.id, row.tripId));
  return ok(null);
}

