import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, places } from "@/infra/db/schema";
import type { BBox, CreatePlaceInput, UpdatePlaceInput } from "@/lib/validation/place";
import { err, ok, type Result } from "../result";

export type PlaceMarker = {
  id: string;
  name: string;
  categoryId: string;
  lat: number;
  lng: number;
};

export type PlaceDetail = PlaceMarker & {
  address: string | null;
  createdAt: Date;
  groupId: string;
};

async function userGroupIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));
  return rows.map((r) => r.id);
}

/** Places in user's groups, filtered by bbox (optional). */
export async function listPlacesForUser(
  userId: string,
  bbox?: BBox,
): Promise<PlaceMarker[]> {
  const groupIds = await userGroupIds(userId);
  if (groupIds.length === 0) return [];

  const bboxExpr = bbox
    ? sql`AND ST_Intersects(
          ${places.location},
          ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)::geography
        )`
    : sql``;

  const rows = await db.execute<{
    id: string;
    name: string;
    category_id: string;
    lat: number;
    lng: number;
  }>(sql`
    SELECT id, name, category_id,
           ST_Y(${places.location}::geometry)::float8 AS lat,
           ST_X(${places.location}::geometry)::float8 AS lng
      FROM ${places}
     WHERE ${inArray(places.groupId, groupIds)}
           ${bboxExpr}
     LIMIT 5000
  `);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryId: r.category_id,
    lat: r.lat,
    lng: r.lng,
  }));
}

export async function getPlaceForUser(
  placeId: string,
  userId: string,
): Promise<PlaceDetail | null> {
  const groupIds = await userGroupIds(userId);
  if (groupIds.length === 0) return null;

  const rows = await db.execute<{
    id: string;
    group_id: string;
    name: string;
    category_id: string;
    address: string | null;
    created_at: Date;
    lat: number;
    lng: number;
  }>(sql`
    SELECT id, group_id, name, category_id, address, created_at,
           ST_Y(${places.location}::geometry)::float8 AS lat,
           ST_X(${places.location}::geometry)::float8 AS lng
      FROM ${places}
     WHERE id = ${placeId}
       AND ${inArray(places.groupId, groupIds)}
     LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    groupId: r.group_id,
    name: r.name,
    categoryId: r.category_id,
    address: r.address,
    createdAt: r.created_at,
    lat: r.lat,
    lng: r.lng,
  };
}

export async function createPlace(
  input: CreatePlaceInput,
  userId: string,
): Promise<Result<{ id: string }>> {
  // Verify caller is a member of the target group.
  const member = await db
    .select({ g: groupMembers.groupId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, input.groupId), eq(groupMembers.userId, userId)),
    )
    .limit(1);
  if (member.length === 0) return err("Nie należysz do tej grupy.");

  const [row] = await db
    .insert(places)
    .values({
      groupId: input.groupId,
      name: input.name,
      categoryId: input.categoryId,
      location: { lat: input.location.lat, lng: input.location.lng },
      address: input.address ?? null,
      osmId: input.osmId ?? null,
      createdBy: userId,
    })
    .returning({ id: places.id });

  return ok({ id: row.id });
}

export type BulkPlaceItem = {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  osmId: string | null;
};

/**
 * Insert many places at once into a group for a single category. Skips
 * rows already present (same osm_id in the same group), so repeated
 * imports are idempotent.
 */
export async function bulkCreatePlaces(
  groupId: string,
  categoryId: string,
  items: BulkPlaceItem[],
  userId: string,
): Promise<Result<{ inserted: number; skipped: number }>> {
  const member = await db
    .select({ g: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (member.length === 0) return err("Nie należysz do tej grupy.");
  if (items.length === 0) return ok({ inserted: 0, skipped: 0 });

  // Filter out items whose osm_id is already in this group.
  const osmIds = items.map((i) => i.osmId).filter((x): x is string => !!x);
  let existing = new Set<string>();
  if (osmIds.length > 0) {
    const rows = await db
      .select({ osmId: places.osmId })
      .from(places)
      .where(and(eq(places.groupId, groupId)));
    existing = new Set(
      rows.map((r) => r.osmId).filter((x): x is string => !!x),
    );
  }

  const fresh = items.filter((i) => !i.osmId || !existing.has(i.osmId));
  if (fresh.length === 0) {
    return ok({ inserted: 0, skipped: items.length });
  }

  const values = fresh.map((i) => ({
    groupId,
    name: i.name,
    categoryId,
    location: { lat: i.lat, lng: i.lng },
    address: i.address,
    osmId: i.osmId,
    createdBy: userId,
  }));

  const inserted = await db.insert(places).values(values).returning({ id: places.id });
  return ok({ inserted: inserted.length, skipped: items.length - inserted.length });
}

/**
 * Edit an existing place. The caller must belong to the place's group.
 * We keep the place's group membership untouched — places can't move
 * between groups through this path. If the location moves, we drop
 * osm_id because the OSM-entity association no longer holds.
 */
export async function updatePlace(
  input: UpdatePlaceInput,
  userId: string,
): Promise<Result<null>> {
  // Verify both that the place exists AND that the caller is a member
  // of its group in a single query.
  const [row] = await db
    .select({
      id: places.id,
      groupId: places.groupId,
      lat: sql<number>`ST_Y(${places.location}::geometry)`,
      lng: sql<number>`ST_X(${places.location}::geometry)`,
    })
    .from(places)
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(places.id, input.placeId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!row) return err("Nie znaleziono miejsca lub brak dostępu.");

  const locationMoved =
    Number(row.lat).toFixed(6) !== input.location.lat.toFixed(6) ||
    Number(row.lng).toFixed(6) !== input.location.lng.toFixed(6);

  await db
    .update(places)
    .set({
      name: input.name,
      categoryId: input.categoryId,
      location: { lat: input.location.lat, lng: input.location.lng },
      address: input.address ?? null,
      osmId: locationMoved ? null : undefined,
      updatedAt: new Date(),
    })
    .where(eq(places.id, input.placeId));

  return ok(null);
}
