import "server-only";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  activities,
  places,
  profiles,
  tripStops,
  trips,
  type ActivityMetadata,
  type ActivityType,
} from "@/infra/db/schema";

/**
 * Activity feed — write + read side.
 *
 * WRITE: `record*` helpers are best-effort. They swallow their own errors
 * (a failed feed write must never break the mutation that triggered it)
 * and are meant to be invoked via `after(() => …)` from the action layer,
 * alongside the existing push helpers — so they add zero latency to the
 * user-perceived response. Names/values are snapshotted into `metadata`
 * at write time so the read side needs no extra joins and survives the
 * referenced row being deleted.
 *
 * READ: `listActivityForGroup` is keyset-paginated (cursor = created_at +
 * id) so deep scroll stays O(page), not O(offset). Caller MUST verify the
 * user is a member of the group first — the query trusts the id.
 */

async function insertActivity(row: {
  type: ActivityType;
  groupId: string;
  actorId: string;
  placeId?: string | null;
  tripId?: string | null;
  metadata?: ActivityMetadata;
}): Promise<void> {
  try {
    await db.insert(activities).values({
      type: row.type,
      groupId: row.groupId,
      actorId: row.actorId,
      placeId: row.placeId ?? null,
      tripId: row.tripId ?? null,
      metadata: row.metadata ?? {},
    });
  } catch (e) {
    console.error("[activity] insert failed:", row.type, e);
  }
}

/** Someone added a place. Group id + name are known at the call site. */
export async function recordPlaceAdded(
  actorId: string,
  placeId: string,
  groupId: string,
  placeName: string,
): Promise<void> {
  await insertActivity({
    type: "place_added",
    groupId,
    actorId,
    placeId,
    metadata: { placeName },
  });
}

/**
 * Someone rated a place. UPSERTS on (actor, place) so editing your score
 * refreshes the single existing feed row (new value, bumped to the top)
 * instead of stacking a fresh "ocenił(a)" line on every save. Resolves the
 * place's group + name from its id.
 */
export async function recordRatingAdded(
  actorId: string,
  placeId: string,
  overall: number,
): Promise<void> {
  try {
    const [place] = await db
      .select({ groupId: places.groupId, name: places.name })
      .from(places)
      .where(eq(places.id, placeId))
      .limit(1);
    if (!place) return;
    const metadata: ActivityMetadata = { placeName: place.name, overall };
    await db
      .insert(activities)
      .values({
        type: "rating_added",
        groupId: place.groupId,
        actorId,
        placeId,
        metadata,
      })
      .onConflictDoUpdate({
        target: [activities.actorId, activities.placeId],
        targetWhere: sql`${activities.type} = 'rating_added'`,
        set: { metadata, createdAt: new Date() },
      });
  } catch (e) {
    console.error("[activity] rating_added failed:", e);
  }
}

/** Someone uploaded a photo. Resolves the place's group + name from its id. */
export async function recordPhotoAdded(
  actorId: string,
  placeId: string,
): Promise<void> {
  try {
    const [place] = await db
      .select({ groupId: places.groupId, name: places.name })
      .from(places)
      .where(eq(places.id, placeId))
      .limit(1);
    if (!place) return;
    await insertActivity({
      type: "photo_added",
      groupId: place.groupId,
      actorId,
      placeId,
      metadata: { placeName: place.name },
    });
  } catch (e) {
    console.error("[activity] photo_added failed:", e);
  }
}

/** Someone created a trip. Group id + name are known at the call site. */
export async function recordTripCreated(
  actorId: string,
  tripId: string,
  groupId: string,
  tripName: string,
): Promise<void> {
  await insertActivity({
    type: "trip_created",
    groupId,
    actorId,
    tripId,
    metadata: { tripName },
  });
}

/**
 * Someone checked off a trip stop. Only records on completion (unmark is
 * noise). Resolves trip/group/place context from the stop id.
 */
export async function recordStopCompleted(
  actorId: string,
  stopId: string,
  completed: boolean,
): Promise<void> {
  if (!completed) return;
  try {
    const [row] = await db
      .select({
        tripId: tripStops.tripId,
        tripName: trips.name,
        groupId: trips.groupId,
        placeId: tripStops.placeId,
        placeName: places.name,
      })
      .from(tripStops)
      .innerJoin(trips, eq(trips.id, tripStops.tripId))
      .innerJoin(places, eq(places.id, tripStops.placeId))
      .where(eq(tripStops.id, stopId))
      .limit(1);
    if (!row) return;
    await insertActivity({
      type: "trip_completed",
      groupId: row.groupId,
      actorId,
      tripId: row.tripId,
      placeId: row.placeId,
      metadata: { tripName: row.tripName, placeName: row.placeName },
    });
  } catch (e) {
    console.error("[activity] trip_completed failed:", e);
  }
}

/** Someone joined the group (accepted a single-use invite). */
export async function recordMemberJoined(
  actorId: string,
  groupId: string,
): Promise<void> {
  await insertActivity({ type: "member_joined", groupId, actorId });
}

// Read side --------------------------------------------------------------

/** Page size for one feed fetch. Tuned for mobile — small, fast pages. */
export const FEED_PAGE_SIZE = 20;

export type ActivityView = {
  id: string;
  type: ActivityType;
  createdAt: Date;
  actorName: string;
  actorAvatarUrl: string | null;
  placeId: string | null;
  tripId: string | null;
  metadata: ActivityMetadata;
};

/**
 * Opaque-ish keyset cursor. `createdAt` is an ISO string so it survives
 * the server-action serialization boundary; the read side rebuilds a Date.
 */
export type ActivityCursor = { createdAt: string; id: string };

export type ActivityPage = {
  items: ActivityView[];
  /** Pass back to fetch the next page; null when the feed is exhausted. */
  nextCursor: ActivityCursor | null;
};

export async function listActivityForGroup(
  groupId: string,
  opts: { cursor?: ActivityCursor | null; limit?: number } = {},
): Promise<ActivityPage> {
  const limit = opts.limit ?? FEED_PAGE_SIZE;
  const cursor = opts.cursor ?? null;
  const cursorDate = cursor ? new Date(cursor.createdAt) : null;

  // Keyset: rows strictly "older" than the cursor in (created_at, id)
  // descending order. The (group_id, created_at, id) index serves both
  // the equality filter and the ordered range via a backward scan.
  const rows = await db
    .select({
      id: activities.id,
      type: activities.type,
      createdAt: activities.createdAt,
      placeId: activities.placeId,
      tripId: activities.tripId,
      metadata: activities.metadata,
      actorName: profiles.displayName,
      actorAvatarUrl: profiles.avatarUrl,
    })
    .from(activities)
    .innerJoin(profiles, eq(profiles.id, activities.actorId))
    .where(
      and(
        eq(activities.groupId, groupId),
        cursor && cursorDate
          ? or(
              lt(activities.createdAt, cursorDate),
              and(
                eq(activities.createdAt, cursorDate),
                lt(activities.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(activities.createdAt), desc(activities.id))
    // Over-fetch by one to learn whether another page exists.
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items: ActivityView[] = page.map((r) => ({
    id: r.id,
    type: r.type,
    createdAt: r.createdAt,
    actorName: r.actorName,
    actorAvatarUrl: r.actorAvatarUrl,
    placeId: r.placeId,
    tripId: r.tripId,
    metadata: r.metadata,
  }));
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? { createdAt: last.createdAt.toISOString(), id: last.id }
      : null;
  return { items, nextCursor };
}
