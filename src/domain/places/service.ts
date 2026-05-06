import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { isNull } from "drizzle-orm";
import {
  categories,
  groupMembers,
  groups,
  itemPhotos,
  photos,
  placeItems,
  places,
  ratings,
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
  /** Pre-baked from the categories join so the preview sheet can
   *  render its subtitle synchronously, with no follow-up fetch. */
  categoryName: string;
  /**
   * Owning group — every place lives in exactly one group. Pre-baked
   * (alongside `groupName`) so the preview sheet can render
   * "W grupie X" without a follow-up fetch and the multi-group user
   * can tell at a glance which list they're looking at.
   */
  groupId: string;
  groupName: string;
  lat: number;
  lng: number;
  canonicalPlaceId: string | null;
  /** Pre-baked rating aggregate so the preview sheet shows score +
   *  count instantly on pin tap. Null when the place has no ratings. */
  overall: number | null;
  ratingCount: number;
  /** Cover photo URL (preferred) or newest photo. Null when none. */
  photoUrl: string | null;
};

/**
 * Detail-page payload. Intentionally NOT extending `PlaceMarker` —
 * the preview fields (categoryName, overall, ratingCount, photoUrl)
 * are baked into markers for the map sheet but the detail page
 * fetches richer per-section data of its own.
 */
export type PlaceDetail = {
  id: string;
  name: string;
  categoryId: string;
  lat: number;
  lng: number;
  canonicalPlaceId: string | null;
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

/**
 * Places in user's groups, filtered by bbox (optional). Each marker
 * carries enough preview data (name, category, overall, count, photo)
 * to render the preview sheet synchronously when the pin is tapped —
 * the previous flow round-tripped /api/places/[id]/preview on every
 * tap, which felt laggy on 4G mobile (200-500 ms spinner).
 *
 * The expensive `groupBreakdown` (per-group aggregates across a
 * shared canonical) is intentionally NOT included here; it only
 * matters for ~10% of pins and stays as the lazy follow-up fetch in
 * the preview sheet.
 */
export async function listPlacesForUser(
  userId: string,
  bbox?: BBox,
): Promise<PlaceMarker[]> {
  const groupIds = await userGroupIds(userId);
  if (groupIds.length === 0) return [];

  const bboxExpr = bbox
    ? sql`AND ST_Intersects(
          p.location,
          ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)::geography
        )`
    : sql``;

  const rows = await db.execute<{
    id: string;
    name: string;
    category_id: string;
    category_name: string;
    group_id: string;
    group_name: string;
    canonical_place_id: string | null;
    lat: number;
    lng: number;
    avg: string | null;
    cnt: number;
    storage_path: string | null;
  }>(sql`
    SELECT p.id,
           p.name,
           p.category_id,
           c.name AS category_name,
           p.group_id,
           gr.name AS group_name,
           p.canonical_place_id,
           ST_Y(p.location::geometry)::float8 AS lat,
           ST_X(p.location::geometry)::float8 AS lng,
           rs.avg AS avg,
           COALESCE(rs.cnt, 0)::int AS cnt,
           ph.storage_path AS storage_path
      FROM ${places} p
      JOIN ${categories} c ON c.id = p.category_id
      JOIN ${groups} gr    ON gr.id = p.group_id
      -- Rating aggregate per place. LEFT JOIN so unrated places still
      -- appear in the result.
      LEFT JOIN LATERAL (
        SELECT AVG(r.overall) AS avg, COUNT(*)::int AS cnt
          FROM ${ratings} r
         WHERE r.place_id = p.id
      ) rs ON true
      -- One photo per place: cover-first, newest as tiebreak. LEFT
      -- JOIN keeps photo-less places visible.
      LEFT JOIN LATERAL (
        SELECT ph2.storage_path
          FROM ${photos} ph2
         WHERE ph2.place_id = p.id
         ORDER BY ph2.is_cover DESC, ph2.created_at DESC
         LIMIT 1
      ) ph ON true
     -- Hand-rolled IN list against the alias p. Drizzle inArray
     -- would emit fully-qualified "places"."group_id" which Postgres
     -- rejects because the FROM clause only exposes the alias.
     WHERE p.group_id IN (${sql.join(groupIds.map((g) => sql`${g}`), sql`, `)})
           ${bboxExpr}
     LIMIT 5000
  `);

  const storage = await getStorage();

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryId: r.category_id,
    categoryName: r.category_name,
    groupId: r.group_id,
    groupName: r.group_name,
    canonicalPlaceId: r.canonical_place_id,
    lat: r.lat,
    lng: r.lng,
    overall: r.avg !== null ? Math.round(Number(r.avg) * 100) / 100 : null,
    ratingCount: r.cnt,
    photoUrl: r.storage_path
      ? storage.publicUrl(PHOTO_BUCKET, r.storage_path)
      : null,
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

  // Resolve the external identity: explicit (provider, externalId)
  // wins; legacy `osmId` falls back to provider='osm'; otherwise it's
  // a pin-drop that needs a fresh local canonical.
  const provider = input.provider ?? (input.osmId ? "osm" : null);
  const externalId = input.externalId ?? input.osmId ?? null;

  let canonicalId: string;
  if (provider && externalId) {
    canonicalId = await findOrCreateExternalCanonical({
      provider,
      externalId,
      name: input.name,
      lat: input.location.lat,
      lng: input.location.lng,
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

  // We still keep places.osm_id populated when the source was OSM —
  // bulkCreatePlaces dedupes within a group on it. Non-OSM providers
  // (Geoapify) leave it null and rely on canonical_place_id alone.
  const legacyOsmId = provider === "osm" ? externalId : null;

  const [row] = await db
    .insert(places)
    .values({
      groupId: input.groupId,
      name: input.name,
      categoryId: input.categoryId,
      location: { lat: input.location.lat, lng: input.location.lng },
      address: input.address ?? null,
      osmId: legacyOsmId,
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
  /**
   * External provider tag. Geoapify hits get `provider="geoapify"`,
   * Overpass hits `provider="osm"`. Pin-drops in bulk are not
   * supported (always nullish).
   */
  provider?: "osm" | "geoapify" | null;
  externalId?: string | null;
  /**
   * @deprecated Legacy alias. When `provider`/`externalId` aren't set
   * but `osmId` is, we treat it as `provider="osm"`.
   */
  osmId?: string | null;
};

/**
 * Insert many places at once into a group for a single category. Skips
 * rows already present (same OSM id in the same group), so repeated
 * imports are idempotent. Geoapify hits dedupe through the canonical
 * layer's (provider, external_id) unique index; the per-group `osm_id`
 * dedupe doesn't apply to them but cross-group canonical sharing does.
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

  // Resolve provider+externalId for every item, including the legacy
  // `osmId` shape that older callers still send.
  type Resolved = BulkPlaceItem & {
    provider: "osm" | "geoapify" | null;
    externalId: string | null;
  };
  const resolved: Resolved[] = items.map((i) => ({
    ...i,
    provider: i.provider ?? (i.osmId ? "osm" : null),
    externalId: i.externalId ?? i.osmId ?? null,
  }));

  // Skip duplicates within this group. We dedupe on `osm_id` (legacy
  // column) for OSM hits — that's the only signal we have stored per
  // place. Geoapify hits aren't tracked via places.osm_id so they
  // can re-import here and rely on canonical-layer dedupe instead;
  // the small downside is the same Geoapify spot can be saved twice
  // in the same group, which is rare and fixable in a follow-up if
  // it bites.
  const osmIdsToCheck = resolved
    .filter((i) => i.provider === "osm" && i.externalId)
    .map((i) => i.externalId as string);
  let existing = new Set<string>();
  if (osmIdsToCheck.length > 0) {
    const rows = await db
      .select({ osmId: places.osmId })
      .from(places)
      .where(and(eq(places.groupId, groupId)));
    existing = new Set(
      rows.map((r) => r.osmId).filter((x): x is string => !!x),
    );
  }

  const fresh = resolved.filter(
    (i) =>
      !(i.provider === "osm" && i.externalId && existing.has(i.externalId)),
  );
  if (fresh.length === 0) {
    return ok({ inserted: 0, skipped: items.length });
  }

  // Link each row to its external canonical (or a fresh local one if
  // somehow there's no provider). Done in parallel.
  const groupCategorySlug = await categorySlugForId(categoryId);
  const canonicals = await Promise.all(
    fresh.map((i) =>
      i.provider && i.externalId
        ? findOrCreateExternalCanonical({
            provider: i.provider,
            externalId: i.externalId,
            name: i.name,
            lat: i.lat,
            lng: i.lng,
            // Bulk imports don't always carry the raw category tag;
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
    // Only OSM hits populate places.osm_id (used by per-group dedupe).
    osmId: i.provider === "osm" ? i.externalId : null,
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
export type SharePlaceAvailability = {
  /** Group the source place belongs to. */
  currentGroupId: string;
  /** All groups (user-accessible) that already share this canonical. */
  groupIdsWithCanonical: string[];
  /**
   * User's groups that don't yet have this canonical and are therefore
   * valid targets for "share to another group". Empty when the user is
   * in only one group OR every group already has it.
   */
  availableTargets: Array<{ id: string; name: string }>;
};

/**
 * Resolve which of the user's groups can receive this place via the
 * "share to another group" action. Reads:
 *   - source place's group + canonical (auth: user must be member)
 *   - all groups already sharing that canonical
 *   - user's other groups → minus the ones that already have it
 *
 * Pin-drops without a canonical (shouldn't happen post-migration, but
 * we're defensive) get an empty target list — no canonical, no dedupe
 * key, no safe way to share.
 */
export async function getSharePlaceAvailability(
  placeId: string,
  userId: string,
): Promise<SharePlaceAvailability | null> {
  const [src] = await db
    .select({
      groupId: places.groupId,
      canonicalPlaceId: places.canonicalPlaceId,
    })
    .from(places)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, places.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(places.id, placeId))
    .limit(1);
  if (!src) return null;

  // Without a canonical we can't dedupe across groups — bail out.
  if (!src.canonicalPlaceId) {
    return {
      currentGroupId: src.groupId,
      groupIdsWithCanonical: [src.groupId],
      availableTargets: [],
    };
  }

  const [withCanonical, userGroups] = await Promise.all([
    db
      .select({ groupId: places.groupId })
      .from(places)
      .where(eq(places.canonicalPlaceId, src.canonicalPlaceId)),
    db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .where(eq(groupMembers.userId, userId)),
  ]);

  const occupied = new Set(withCanonical.map((r) => r.groupId));
  const availableTargets = userGroups
    .filter((g) => !occupied.has(g.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));

  return {
    currentGroupId: src.groupId,
    groupIdsWithCanonical: Array.from(occupied),
    availableTargets,
  };
}

/**
 * Copy a place into another of the user's groups, preserving the
 * canonical link. Ratings, photos, items, visits, wishlist entries
 * stay tied to the original places.id — sharing creates a sibling
 * row, not a clone.
 *
 * Category mapping: the target group may not have the source row's
 * exact category id (categories are per-group, with optional globals).
 * We fall back through:
 *   1. same category id (works when source is a global category)
 *   2. target-group category with same slug
 *   3. global category with same slug
 *   4. error — caller must add the category in target group first
 */
export async function sharePlaceToGroup(
  placeId: string,
  targetGroupId: string,
  userId: string,
): Promise<Result<{ id: string }>> {
  // Auth: source membership.
  const [src] = await db
    .select({
      groupId: places.groupId,
      name: places.name,
      categoryId: places.categoryId,
      address: places.address,
      osmId: places.osmId,
      canonicalPlaceId: places.canonicalPlaceId,
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
    .where(eq(places.id, placeId))
    .limit(1);
  if (!src) return err("Brak takiego miejsca albo nie należysz do jego grupy.");

  if (src.groupId === targetGroupId) {
    return err("To miejsce już jest w tej grupie.");
  }
  if (!src.canonicalPlaceId) {
    return err("Tego pin-dropu nie da się udostępnić — brak wspólnego identyfikatora.");
  }

  // Auth: target membership.
  const [target] = await db
    .select({ id: groupMembers.groupId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, targetGroupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .limit(1);
  if (!target) return err("Nie należysz do grupy docelowej.");

  // Idempotency: target group already has this canonical → nothing to do.
  const [existing] = await db
    .select({ id: places.id })
    .from(places)
    .where(
      and(
        eq(places.groupId, targetGroupId),
        eq(places.canonicalPlaceId, src.canonicalPlaceId),
      ),
    )
    .limit(1);
  if (existing) {
    return ok({ id: existing.id });
  }

  // Map category to target group. Source row carries categoryId, but
  // that id may belong to a different group's scoped category — pull
  // its slug and resolve in the target.
  const [srcCat] = await db
    .select({ slug: categories.slug, groupId: categories.groupId })
    .from(categories)
    .where(eq(categories.id, src.categoryId))
    .limit(1);
  if (!srcCat) return err("Kategoria źródłowa nie istnieje.");

  let mappedCategoryId: string = src.categoryId;
  if (srcCat.groupId !== null) {
    // Source is group-scoped — find a same-slug equivalent in target,
    // or fall back to a global with the same slug.
    const candidates = await db
      .select({ id: categories.id, groupId: categories.groupId })
      .from(categories)
      .where(
        and(
          eq(categories.slug, srcCat.slug),
          or(
            eq(categories.groupId, targetGroupId),
            isNull(categories.groupId),
          ),
        ),
      );
    // Prefer target-scoped if both exist; globals cover most cases.
    const targetScoped = candidates.find((c) => c.groupId === targetGroupId);
    const global = candidates.find((c) => c.groupId === null);
    const picked = targetScoped ?? global;
    if (!picked) {
      return err(
        "W grupie docelowej nie ma odpowiadającej kategorii. Dodaj ją tam najpierw.",
      );
    }
    mappedCategoryId = picked.id;
  }

  const [inserted] = await db
    .insert(places)
    .values({
      groupId: targetGroupId,
      name: src.name,
      categoryId: mappedCategoryId,
      location: { lat: Number(src.lat), lng: Number(src.lng) },
      address: src.address,
      osmId: src.osmId,
      canonicalPlaceId: src.canonicalPlaceId,
      createdBy: userId,
    })
    .returning({ id: places.id });

  return ok({ id: inserted.id });
}

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
