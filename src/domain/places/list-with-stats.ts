import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
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
  createdAt: Date;
};

export type PlacesSortBy = "recent" | "name" | "rating";
export type PlacesSortDir = "asc" | "desc";

export type ListPlacesOptions = {
  query?: string;
  /** Filter by category id. When undefined, no category filter is applied. */
  categoryId?: string;
  /** Default: "recent". */
  sortBy?: PlacesSortBy;
  /** Default: "desc" (newest first / highest rating first / Z→A). */
  sortDir?: PlacesSortDir;
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
 *
 * Sorting policy: places without ratings always land at the end of the
 * list when sorting by rating, regardless of direction. Other sort modes
 * are direction-symmetric.
 */
export async function listPlacesWithStats(
  userId: string,
  optsOrQuery?: string | ListPlacesOptions,
): Promise<PlaceCard[]> {
  // Backwards-compat: callers passing a bare query string still work.
  const opts: ListPlacesOptions =
    typeof optsOrQuery === "string"
      ? { query: optsOrQuery }
      : (optsOrQuery ?? {});
  const {
    query,
    categoryId,
    sortBy = "recent",
    sortDir = "desc",
  } = opts;

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
      createdAt: places.createdAt,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .where(
      and(
        inArray(places.groupId, groupIds),
        q.length > 0 ? ilike(places.name, `%${q}%`) : undefined,
        categoryId ? eq(places.categoryId, categoryId) : undefined,
      ),
    );

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

    // Fetch photos ordered cover-first, newest-next. We dedupe to "one
    // photo per place" in TS below so the winner is the cover when it
    // exists, otherwise the latest upload.
    db
      .select({
        placeId: photos.placeId,
        storagePath: photos.storagePath,
      })
      .from(photos)
      .where(inArray(photos.placeId, ids))
      .orderBy(desc(photos.isCover), desc(photos.createdAt)),

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
  const photoBy = new Map<string, string>();
  for (const p of photoRows) {
    if (!photoBy.has(p.placeId)) photoBy.set(p.placeId, p.storagePath);
  }
  const wishSet = new Set(wishRows.map((r) => r.id));
  const favSet = new Set(favRows.map((r) => r.id));

  const storage = await getStorage();

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
      createdAt: r.createdAt,
    };
  });

  return sortCards(cards, sortBy, sortDir);
}

function sortCards(
  cards: PlaceCard[],
  by: PlacesSortBy,
  dir: PlacesSortDir,
): PlaceCard[] {
  const sign = dir === "asc" ? 1 : -1;
  const out = cards.slice();

  if (by === "name") {
    out.sort(
      (a, b) =>
        sign * a.name.localeCompare(b.name, "pl", { sensitivity: "base" }),
    );
    return out;
  }

  if (by === "recent") {
    out.sort((a, b) => sign * (a.createdAt.getTime() - b.createdAt.getTime()));
    return out;
  }

  // sortBy === "rating": null overall always sinks to the end regardless
  // of direction. The ranking otherwise is direction-symmetric.
  out.sort((a, b) => {
    if (a.overall === null && b.overall === null) return 0;
    if (a.overall === null) return 1;
    if (b.overall === null) return -1;
    return sign * (a.overall - b.overall);
  });
  return out;
}
