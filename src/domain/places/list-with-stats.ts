import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  categories,
  favorites,
  groupMembers,
  photos,
  places,
  ratings,
  wishlist,
} from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";

export type PlaceCard = {
  id: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  address: string | null;
  photoUrl: string | null;
  overall: number | null;
  ratingCount: number;
  isWishlisted: boolean;
  isFavorite: boolean;
};

async function userGroupIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));
  return rows.map((r) => r.id);
}

/**
 * List all places in the user's groups with stats ready for card rendering.
 * Uses separate roundtrips rather than a heavy JOIN — readable and fine
 * for the group-sized datasets this app handles.
 */
export async function listPlacesWithStats(
  userId: string,
  query?: string,
): Promise<PlaceCard[]> {
  const groupIds = await userGroupIds(userId);
  if (groupIds.length === 0) return [];

  const q = (query ?? "").trim();
  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      categoryName: categories.name,
      categorySlug: categories.slug,
      address: places.address,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .where(
      and(
        inArray(places.groupId, groupIds),
        q.length > 0 ? ilike(places.name, `%${q}%`) : undefined,
      ),
    )
    .orderBy(places.name);

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [statRows, photoRows, wishRows, favRows] = await Promise.all([
    db
      .select({
        placeId: ratings.placeId,
        avg: sql<string>`AVG(${ratings.overall})`.as("avg"),
        cnt: sql<number>`COUNT(*)::int`.as("cnt"),
      })
      .from(ratings)
      .where(inArray(ratings.placeId, ids))
      .groupBy(ratings.placeId),

    db.execute<{ place_id: string; storage_path: string }>(sql`
      SELECT DISTINCT ON (place_id) place_id, storage_path
        FROM ${photos}
       WHERE place_id = ANY(${ids})
       ORDER BY place_id, created_at DESC
    `),

    db
      .select({ id: wishlist.placeId })
      .from(wishlist)
      .where(and(eq(wishlist.userId, userId), inArray(wishlist.placeId, ids))),

    db
      .select({ id: favorites.placeId })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), inArray(favorites.placeId, ids))),
  ]);

  const statsBy = new Map(
    statRows.map((s) => [s.placeId, { avg: Number(s.avg), cnt: Number(s.cnt) }]),
  );
  const photoBy = new Map(photoRows.map((p) => [p.place_id, p.storage_path]));
  const wishSet = new Set(wishRows.map((r) => r.id));
  const favSet = new Set(favRows.map((r) => r.id));

  const storage = await getStorage();

  // Sort: favorites first, then wishlist, then alphabetical (which rows already are).
  const cards: PlaceCard[] = rows.map((r) => {
    const s = statsBy.get(r.id);
    const p = photoBy.get(r.id);
    return {
      id: r.id,
      name: r.name,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      address: r.address,
      photoUrl: p ? storage.publicUrl(PHOTO_BUCKET, p) : null,
      overall: s ? Math.round(s.avg * 100) / 100 : null,
      ratingCount: s?.cnt ?? 0,
      isWishlisted: wishSet.has(r.id),
      isFavorite: favSet.has(r.id),
    };
  });
  return cards;
}
