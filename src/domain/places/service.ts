import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, places } from "@/infra/db/schema";
import type { BBox, CreatePlaceInput } from "@/lib/validation/place";
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
