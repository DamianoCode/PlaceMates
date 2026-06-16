import { and, desc, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/infra/db/client";
import { groupMembers, places, profiles, ratings } from "@/infra/db/schema";
import { computeOverall, type RatingSchema } from "@/lib/validation/rating";
import { INSIGHTS_CACHE_TAG, RANKING_CACHE_TAG } from "@/lib/constants";
import { err, ok, type Result } from "../result";

export type RatingView = {
  id: string;
  placeId: string;
  userId: string;
  userDisplayName: string;
  dimensions: Record<string, number>;
  overall: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function userCanAccessPlace(placeId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: places.id })
    .from(places)
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(places.id, placeId), eq(groupMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function listRatingsForPlace(
  placeId: string,
  userId: string,
): Promise<RatingView[]> {
  if (!(await userCanAccessPlace(placeId, userId))) return [];
  const rows = await db
    .select({
      id: ratings.id,
      placeId: ratings.placeId,
      userId: ratings.userId,
      userDisplayName: profiles.displayName,
      dimensions: ratings.dimensions,
      overall: ratings.overall,
      note: ratings.note,
      createdAt: ratings.createdAt,
      updatedAt: ratings.updatedAt,
    })
    .from(ratings)
    .innerJoin(profiles, eq(profiles.id, ratings.userId))
    .where(eq(ratings.placeId, placeId))
    .orderBy(desc(ratings.updatedAt));

  return rows.map((r) => ({
    ...r,
    overall: Number(r.overall),
  }));
}

export async function getUserRating(
  placeId: string,
  userId: string,
): Promise<RatingView | null> {
  const list = await listRatingsForPlace(placeId, userId);
  return list.find((r) => r.userId === userId) ?? null;
}

export async function upsertRating(
  placeId: string,
  userId: string,
  dimensions: Record<string, number>,
  note: string | null,
  schema: RatingSchema,
): Promise<Result<{ id: string; overall: number }>> {
  if (!(await userCanAccessPlace(placeId, userId))) {
    return err("Brak dostępu do tego miejsca.");
  }

  // Validate each provided value lives inside its dimension's min/max.
  for (const d of schema) {
    const v = dimensions[d.key];
    if (typeof v !== "number") continue;
    if (v < d.min || v > d.max) return err(`Wartość "${d.label}" poza zakresem.`);
  }

  const overall = computeOverall(dimensions, schema);

  const [row] = await db
    .insert(ratings)
    .values({
      placeId,
      userId,
      dimensions,
      overall: overall.toFixed(2),
      note,
    })
    .onConflictDoUpdate({
      target: [ratings.placeId, ratings.userId],
      set: {
        dimensions,
        overall: overall.toFixed(2),
        note,
        updatedAt: new Date(),
      },
    })
    .returning({ id: ratings.id });

  // Any rating change invalidates every cached ranking variant and the
  // group insight counters (rated/ratings tallies move).
  revalidateTag(RANKING_CACHE_TAG, "max");
  revalidateTag(INSIGHTS_CACHE_TAG, "max");
  return ok({ id: row.id, overall });
}

/**
 * Remove the caller's rating for a place. Also cascades the public
 * share (if any) so we don't leave a share pointing at a deleted
 * rating — ON DELETE CASCADE on public_shares.rating_id handles that
 * at the DB level.
 */
export async function deleteRating(
  placeId: string,
  userId: string,
): Promise<Result<null>> {
  const rows = await db
    .delete(ratings)
    .where(and(eq(ratings.placeId, placeId), eq(ratings.userId, userId)))
    .returning({ id: ratings.id });
  if (rows.length === 0) return err("Nie masz oceny do cofnięcia.");
  revalidateTag(RANKING_CACHE_TAG, "max");
  revalidateTag(INSIGHTS_CACHE_TAG, "max");
  return ok(null);
}


export type RatingByGroup = {
  groupId: string;
  groupName: string;
  ratings: RatingView[];
};

/**
 * Fetch ratings for every place that shares this place's canonical and
 * that the user has access to (group-member). Grouped by group so the
 * UI can section-out "W Moja (2)" / "W Rodzina (5)" when multiple
 * groups rate the same canonical.
 *
 * Returns an empty array when the user doesn't have access. Falls back
 * to single-place ratings when the place has no canonical (local
 * pin-drop with NULL canonical never matches another group).
 */
export async function listRatingsForPlaceAcrossGroups(
  placeId: string,
  userId: string,
): Promise<RatingByGroup[]> {
  if (!(await userCanAccessPlace(placeId, userId))) return [];

  const rows = await db.execute<{
    group_id: string;
    group_name: string;
    rating_id: string;
    rating_place_id: string;
    rating_user_id: string;
    user_display_name: string;
    dimensions: Record<string, number>;
    overall: string;
    note: string | null;
    created_at: Date;
    updated_at: Date;
  }>(sql`
    WITH origin AS (
      SELECT canonical_place_id FROM ${places} WHERE id = ${placeId}
    )
    SELECT g.id AS group_id, g.name AS group_name,
           r.id AS rating_id, r.place_id AS rating_place_id,
           r.user_id AS rating_user_id,
           prof.display_name AS user_display_name,
           r.dimensions, r.overall, r.note,
           r.created_at, r.updated_at
      FROM ${places} p
      JOIN groups g          ON g.id = p.group_id
      JOIN group_members gm  ON gm.group_id = p.group_id AND gm.user_id = ${userId}
      JOIN ${ratings} r      ON r.place_id = p.id
      JOIN ${profiles} prof  ON prof.id = r.user_id
     WHERE (SELECT canonical_place_id FROM origin) IS NOT NULL
       AND p.canonical_place_id = (SELECT canonical_place_id FROM origin)
     UNION ALL
    SELECT g.id AS group_id, g.name AS group_name,
           r.id AS rating_id, r.place_id AS rating_place_id,
           r.user_id AS rating_user_id,
           prof.display_name AS user_display_name,
           r.dimensions, r.overall, r.note,
           r.created_at, r.updated_at
      FROM ${places} p
      JOIN groups g          ON g.id = p.group_id
      JOIN group_members gm  ON gm.group_id = p.group_id AND gm.user_id = ${userId}
      JOIN ${ratings} r      ON r.place_id = p.id
      JOIN ${profiles} prof  ON prof.id = r.user_id
     WHERE (SELECT canonical_place_id FROM origin) IS NULL
       AND p.id = ${placeId}
     ORDER BY group_name, updated_at DESC
  `);

  // Bucket by group
  const byGroup = new Map<string, RatingByGroup>();
  for (const r of rows) {
    let bucket = byGroup.get(r.group_id);
    if (!bucket) {
      bucket = { groupId: r.group_id, groupName: r.group_name, ratings: [] };
      byGroup.set(r.group_id, bucket);
    }
    bucket.ratings.push({
      id: r.rating_id,
      placeId: r.rating_place_id,
      userId: r.rating_user_id,
      userDisplayName: r.user_display_name,
      dimensions: r.dimensions,
      overall: Number(r.overall),
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  }
  return Array.from(byGroup.values());
}
