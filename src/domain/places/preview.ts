import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  categories,
  groupMembers,
  photos,
  places,
} from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";

export type GroupBreakdownEntry = {
  placeId: string;
  groupName: string;
  avg: number | null;
  count: number;
};

export type PlacePreview = {
  id: string;
  name: string;
  categoryName: string;
  /** Overall average across every group the user can see for this canonical. */
  overall: number | null;
  ratingCount: number;
  photoUrl: string | null;
  /**
   * When this place shares a canonical with another place in another of
   * the user's groups, we list each contributing place's aggregate so
   * the preview sheet can render "W Moja: 4.5 · W Rodzina: 4.0". Null
   * when the user only has this canonical in one group.
   */
  groupBreakdown: GroupBreakdownEntry[] | null;
};

export async function getPlacePreview(
  placeId: string,
  userId: string,
): Promise<PlacePreview | null> {
  const [row] = await db
    .select({
      id: places.id,
      name: places.name,
      categoryName: categories.name,
      canonicalPlaceId: places.canonicalPlaceId,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(places.id, placeId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!row) return null;

  // Fetch per-group aggregates across every place sharing this
  // canonical that the user has access to. One query regardless of
  // whether there's one group or ten.
  const breakdownRows = await db.execute<{
    place_id: string;
    group_name: string;
    avg: number | null;
    cnt: number;
  }>(sql`
    SELECT p.id  AS place_id,
           g.name AS group_name,
           AVG(r.overall)::float8 AS avg,
           COUNT(r.*)::int AS cnt
      FROM places p
      JOIN groups g         ON g.id = p.group_id
      JOIN group_members gm ON gm.group_id = p.group_id AND gm.user_id = ${userId}
      LEFT JOIN ratings r   ON r.place_id = p.id
     WHERE ${row.canonicalPlaceId
       ? sql`p.canonical_place_id = ${row.canonicalPlaceId}`
       : sql`p.id = ${placeId}`}
     GROUP BY p.id, g.name
     ORDER BY g.name
  `);

  const breakdown: GroupBreakdownEntry[] = breakdownRows.map((b) => ({
    placeId: b.place_id,
    groupName: b.group_name,
    avg: b.avg !== null ? Math.round(Number(b.avg) * 100) / 100 : null,
    count: Number(b.cnt),
  }));

  const totalCount = breakdown.reduce((s, b) => s + b.count, 0);
  // Weighted average = sum(avg_i * count_i) / sum(count_i). Skips zero-count
  // entries so a brand-new group with no ratings doesn't pull the overall
  // down to NaN.
  const weightedSum = breakdown.reduce(
    (s, b) => (b.avg !== null ? s + b.avg * b.count : s),
    0,
  );
  const overall = totalCount > 0 ? weightedSum / totalCount : null;

  const [firstPhoto] = await db
    .select({ storagePath: photos.storagePath })
    .from(photos)
    .where(eq(photos.placeId, placeId))
    .orderBy(desc(photos.isCover), desc(photos.createdAt))
    .limit(1);

  const photoUrl = firstPhoto
    ? (await getStorage()).publicUrl(PHOTO_BUCKET, firstPhoto.storagePath)
    : null;

  return {
    id: row.id,
    name: row.name,
    categoryName: row.categoryName,
    overall: overall !== null ? Math.round(overall * 100) / 100 : null,
    ratingCount: totalCount,
    photoUrl,
    // Only expose breakdown when there's more than one group contributing —
    // single-group preview stays identical to the legacy behaviour.
    groupBreakdown: breakdown.length > 1 ? breakdown : null,
  };
}
