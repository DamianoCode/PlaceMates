import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  groupMembers,
  itemPhotos,
  photos,
  placeItems,
  places,
} from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";
import type { BBox, CreatePlaceInput, UpdatePlaceInput } from "@/lib/validation/place";
import { err, ok, type Result } from "../result";
import {
  categorySlugForId,
  createLocalCanonical,
  findOrCreateExternalCanonical,
} from "./canonical";

export type PlaceMarker = {
  id: string;
  name: string;
  categoryId: string;
  lat: number;
  lng: number;
  canonicalPlaceId: string | null;
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
    canonical_place_id: string | null;
    lat: number;
    lng: number;
  }>(sql`
    SELECT id, name, category_id, canonical_place_id,
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
    canonicalPlaceId: r.canonical_place_id,
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
    canonical_place_id: string | null;
  }>(sql`
    SELECT id, group_id, name, category_id, address, created_at,
           canonical_place_id,
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
    canonicalPlaceId: r.canonical_place_id,
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

  // Link to a canonical place — external (OSM-backed) when we have an
  // osm_id, otherwise a fresh local canonical carrying the place's
  // category slug so the ranking can still filter on it.
  let canonicalId: string;
  if (input.osmId) {
    canonicalId = await findOrCreateExternalCanonical({
      provider: "osm",
      externalId: input.osmId,
      name: input.name,
      lat: input.location.lat,
      lng: input.location.lng,
      // We don't receive the raw OSM tag on the create form; the
      // canonical will carry null categoryHint and fall back to our
      // own slug via the place's category_id when the ranking filters.
    });
  } else {
    const slug = await categorySlugForId(input.categoryId);
    canonicalId = await createLocalCanonical({
      name: input.name,
      lat: input.location.lat,
      lng: input.location.lng,
      categoryHint: slug ?? undefined,
    });
  }

  const [row] = await db
    .insert(places)
    .values({
      groupId: input.groupId,
      name: input.name,
      categoryId: input.categoryId,
      location: { lat: input.location.lat, lng: input.location.lng },
      address: input.address ?? null,
      osmId: input.osmId ?? null,
      canonicalPlaceId: canonicalId,
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

  // Bulk imports always carry osm_id (Overpass). Link each row to its
  // external canonical — done in parallel so a 50-item import still
  // resolves in roughly the time of a single upsert.
  const groupCategorySlug = await categorySlugForId(categoryId);
  const canonicals = await Promise.all(
    fresh.map((i) =>
      i.osmId
        ? findOrCreateExternalCanonical({
            provider: "osm",
            externalId: i.osmId,
            name: i.name,
            lat: i.lat,
            lng: i.lng,
            // Bulk imports don't always carry the OSM category tag;
            // fall back to the group-picked slug so the canonical has
            // something meaningful in category_hint.
            categoryHint: groupCategorySlug ?? undefined,
          })
        : createLocalCanonical({
            name: i.name,
            lat: i.lat,
            lng: i.lng,
            categoryHint: groupCategorySlug ?? undefined,
          }),
    ),
  );

  const values = fresh.map((i, idx) => ({
    groupId,
    name: i.name,
    categoryId,
    location: { lat: i.lat, lng: i.lng },
    address: i.address,
    osmId: i.osmId,
    canonicalPlaceId: canonicals[idx],
    createdBy: userId,
  }));

  const inserted = await db.insert(places).values(values).returning({ id: places.id });
  return ok({ inserted: inserted.length, skipped: items.length - inserted.length });
}

/**
 * Permission check: a place can be edited by its creator, or by any
 * owner of the group it belongs to. Member-level users see other
 * people's pins as read-only.
 *
 * Both branches are enforced server-side; the same predicate is used
 * by the UI to conditionally render the Edit affordance (purely for
 * UX — the server is the source of truth).
 */
export async function canUserEditPlace(
  placeId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: places.id })
    .from(places)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, places.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(
      and(
        eq(places.id, placeId),
        or(eq(places.createdBy, userId), eq(groupMembers.role, "owner")),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Edit an existing place. Only the creator or a group owner may do this.
 * Group membership is not moved — places don't hop between groups through
 * this path. If the location moves, we drop osm_id because the OSM-entity
 * association no longer holds.
 */
export async function updatePlace(
  input: UpdatePlaceInput,
  userId: string,
): Promise<Result<null>> {
  // Verify existence + permission in a single authoritative query.
  const [row] = await db
    .select({
      id: places.id,
      groupId: places.groupId,
      lat: sql<number>`ST_Y(${places.location}::geometry)`,
      lng: sql<number>`ST_X(${places.location}::geometry)`,
    })
    .from(places)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, places.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(
      and(
        eq(places.id, input.placeId),
        or(eq(places.createdBy, userId), eq(groupMembers.role, "owner")),
      ),
    )
    .limit(1);
  if (!row) {
    return err("Tylko autor miejsca lub właściciel grupy może edytować.");
  }

  const locationMoved =
    Number(row.lat).toFixed(6) !== input.location.lat.toFixed(6) ||
    Number(row.lng).toFixed(6) !== input.location.lng.toFixed(6);

  // When the pin moves, the old canonical (whichever type) no longer
  // represents this spot. Mint a fresh local canonical with the new
  // position + current category. Ratings stay tied to places.id so
  // nothing is lost.
  let newCanonicalId: string | undefined;
  if (locationMoved) {
    const slug = await categorySlugForId(input.categoryId);
    newCanonicalId = await createLocalCanonical({
      name: input.name,
      lat: input.location.lat,
      lng: input.location.lng,
      categoryHint: slug ?? undefined,
    });
  }

  await db
    .update(places)
    .set({
      name: input.name,
      categoryId: input.categoryId,
      location: { lat: input.location.lat, lng: input.location.lng },
      address: input.address ?? null,
      osmId: locationMoved ? null : undefined,
      canonicalPlaceId: newCanonicalId ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(places.id, input.placeId));

  return ok(null);
}

/**
 * Remove a place entirely. Permission mirrors edit (creator or group
 * owner). Cascade on the FKs takes care of ratings, visits, wishlist,
 * favorites, place_items, item_ratings, item_photos, photos, and
 * public_shares — they're all ON DELETE CASCADE against place or its
 * children.
 *
 * Storage objects (bucket files) don't cascade with the DB, so we
 * gather every place/item photo path up-front and clean them
 * explicitly. Best-effort — if storage removal fails mid-way the DB
 * delete still runs so the user doesn't see an orphaned row.
 */
export async function deletePlace(
  placeId: string,
  userId: string,
): Promise<Result<null>> {
  // Single JOIN to confirm existence + permission (creator OR group owner).
  const [row] = await db
    .select({ id: places.id })
    .from(places)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, places.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(
      and(
        eq(places.id, placeId),
        or(eq(places.createdBy, userId), eq(groupMembers.role, "owner")),
      ),
    )
    .limit(1);
  if (!row) {
    return err("Tylko autor miejsca lub właściciel grupy może usuwać.");
  }

  // Collect storage paths before the cascade wipes the rows.
  const [placePhotos, itemIds] = await Promise.all([
    db
      .select({ path: photos.storagePath })
      .from(photos)
      .where(eq(photos.placeId, placeId)),
    db
      .select({ id: placeItems.id })
      .from(placeItems)
      .where(eq(placeItems.placeId, placeId)),
  ]);
  const itemPhotosForPlace =
    itemIds.length > 0
      ? await db
          .select({ path: itemPhotos.storagePath })
          .from(itemPhotos)
          .where(
            inArray(
              itemPhotos.itemId,
              itemIds.map((i) => i.id),
            ),
          )
      : [];

  const storage = await getStorage();
  // Storage SDK accepts batch removes; we collect all paths and fire
  // one request per bucket. Failures are swallowed — DB integrity
  // takes priority over orphaned files we can clean up later.
  const allPaths = [
    ...placePhotos.map((p) => p.path),
    ...itemPhotosForPlace.map((p) => p.path),
  ];
  await Promise.all(
    allPaths.map((path) =>
      storage.remove(PHOTO_BUCKET, path).catch(() => undefined),
    ),
  );

  await db.delete(places).where(eq(places.id, placeId));
  return ok(null);
}
