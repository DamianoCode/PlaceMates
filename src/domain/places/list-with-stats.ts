import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  categories,
  favorites,
  groupMembers,
  groupWishlist,
  groups,
  photos,
  places,
  ratings,
  wishlist,
} from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";

export type PlaceCard = {
  /**
   * Primary place id this card represents. After dedup-by-canonical
   * (see `listPlacesWithStats`), this is the oldest sibling — the one
   * the card links to. The `availableInGroups` array exposes every
   * sibling's place id for callers that need them.
   */
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
  isGroupWishlisted: boolean;
  /**
   * Groups (that the user belongs to) which have this place on their
   * shared wishlist. Multi-element when the same canonical place sits in
   * more than one of the user's groups; empty when `isGroupWishlisted`
   * is false.
   */
  groupWishlistedIn: Array<{ id: string; name: string }>;
  /**
   * Every sibling place this canonical resolves to in the user's
   * groups. Length 1 = the place lives in only one of the user's
   * groups (the common case). Length ≥ 2 = canonical is shared across
   * several of the user's groups; the card's `id` points at the
   * primary (oldest) sibling but the UI may surface the others.
   */
  availableInGroups: Array<{
    id: string;
    name: string;
    placeId: string;
  }>;
  createdAt: Date;
};

export type PlacesSortBy = "recent" | "name" | "rating";
export type PlacesSortDir = "asc" | "desc";

/**
 * "Set" filter — restrict the list to a saved subset.
 *   - "wishlist"      → personal "do odwiedzenia"
 *   - "favorites"     → personal "ulubione"
 *   - "group-wishlist" → shared with the group ("planujemy razem")
 *
 * Applied AFTER stats are fetched, reuses isWishlisted / isFavorite /
 * isGroupWishlisted flags the cards already carry. Combines with the
 * category filter (intersection: grupowo do odwiedzenia + restauracje).
 */
export type PlacesSetFilter = "wishlist" | "favorites" | "group-wishlist";

export type ListPlacesOptions = {
  query?: string;
  /** Filter by category id. When undefined, no category filter is applied. */
  categoryId?: string;
  /** Restrict to wishlist or favourites. When undefined, all places. */
  setFilter?: PlacesSetFilter;
  /**
   * Only meaningful when setFilter === "group-wishlist". Restricts the
   * list to entries on this group's shared wishlist. Ignored otherwise.
   */
  groupWishlistGroupId?: string;
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
    setFilter,
    groupWishlistGroupId,
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
      groupId: places.groupId,
      groupName: groups.name,
      // Dedup key: shared canonical means same real-world place across
      // groups. NULL canonical (legacy) falls back to the place id so
      // such rows never silently merge with anything.
      canonicalPlaceId: places.canonicalPlaceId,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(groups, eq(groups.id, places.groupId))
    .where(
      and(
        inArray(places.groupId, groupIds),
        q.length > 0 ? ilike(places.name, `%${q}%`) : undefined,
        categoryId ? eq(places.categoryId, categoryId) : undefined,
      ),
    );

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [statRows, photoRows, wishRows, favRows, groupWishRows] = await Promise.all([
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

    // Group wishlist entries the user can see (i.e. where they're a
    // member). The join hop through group_members keeps us honest if
    // a place ever ends up in a group the user is no longer in. We also
    // pull the group name so the UI can render attribution ("W grupie
    // Rodzina") without a second roundtrip.
    db
      .select({
        placeId: groupWishlist.placeId,
        groupId: groupWishlist.groupId,
        groupName: groups.name,
      })
      .from(groupWishlist)
      .innerJoin(
        groupMembers,
        eq(groupMembers.groupId, groupWishlist.groupId),
      )
      .innerJoin(groups, eq(groups.id, groupWishlist.groupId))
      .where(
        and(
          eq(groupMembers.userId, userId),
          inArray(groupWishlist.placeId, ids),
        ),
      ),
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
  const groupWishBy = new Map<string, Array<{ id: string; name: string }>>();
  for (const r of groupWishRows) {
    const arr = groupWishBy.get(r.placeId);
    if (arr) arr.push({ id: r.groupId, name: r.groupName });
    else groupWishBy.set(r.placeId, [{ id: r.groupId, name: r.groupName }]);
  }

  const storage = await getStorage();

  // Per-place rows first — same shape as PlaceCard plus dedup metadata.
  // We collapse siblings sharing a canonical_place_id into one card
  // below so the user sees a clean list instead of N copies of the
  // same real-world place.
  type RawCard = PlaceCard & {
    groupId: string;
    groupName: string;
    canonicalKey: string;
  };
  const rawCards: RawCard[] = rows.map((r) => {
    const s = statsBy.get(r.id);
    const p = photoBy.get(r.id);
    const groupWishlistedIn = groupWishBy.get(r.id) ?? [];
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
      isGroupWishlisted: groupWishlistedIn.length > 0,
      groupWishlistedIn,
      // Set per-row but only meaningful before dedup; the deduped card
      // gets its `availableInGroups` aggregated from siblings below.
      availableInGroups: [
        { id: r.groupId, name: r.groupName, placeId: r.id },
      ],
      createdAt: r.createdAt,
      groupId: r.groupId,
      groupName: r.groupName,
      // Local pin-drops without a canonical (legacy data) get a
      // unique-per-row key so they never silently merge.
      canonicalKey: r.canonicalPlaceId ?? `local:${r.id}`,
    };
  });

  // Group siblings sharing a canonical, then collapse each group into
  // one card. Primary (the linkable place id) = oldest sibling. Stats
  // get aggregated across siblings: count is summed; overall is the
  // count-weighted average so a 5-rating place merged with a
  // 50-rating place doesn't show a misleading "5.0" up top.
  const byCanonical = new Map<string, RawCard[]>();
  for (const r of rawCards) {
    const arr = byCanonical.get(r.canonicalKey);
    if (arr) arr.push(r);
    else byCanonical.set(r.canonicalKey, [r]);
  }

  const cards: PlaceCard[] = Array.from(byCanonical.values()).map(
    (siblings) => {
      const sorted = [...siblings].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const primary = sorted[0];

      const totalCount = siblings.reduce((s, c) => s + c.ratingCount, 0);
      const overall =
        totalCount > 0
          ? siblings.reduce(
              (s, c) => s + (c.overall ?? 0) * c.ratingCount,
              0,
            ) / totalCount
          : null;

      // Photo fallback: prefer primary's, then any sibling that has
      // one — so a sibling-only photo doesn't get hidden by an
      // older but photo-less primary.
      const photoUrl =
        primary.photoUrl ??
        siblings.find((c) => c.photoUrl)?.photoUrl ??
        null;

      // Union of group-wishlist groups across siblings, deduped by id.
      const gwMap = new Map<string, { id: string; name: string }>();
      for (const c of siblings) {
        for (const g of c.groupWishlistedIn) gwMap.set(g.id, g);
      }
      const groupWishlistedIn = Array.from(gwMap.values());

      // availableInGroups: one entry per sibling. Stable alpha order
      // so the chip on the card reads predictably ("Ekipa, Rodzina").
      const availableInGroups = siblings
        .map((c) => ({ id: c.groupId, name: c.groupName, placeId: c.id }))
        .sort((a, b) => a.name.localeCompare(b.name, "pl"));

      return {
        id: primary.id,
        name: primary.name,
        categoryName: primary.categoryName,
        categorySlug: primary.categorySlug,
        address: primary.address,
        photoUrl,
        overall: overall !== null ? Math.round(overall * 100) / 100 : null,
        ratingCount: totalCount,
        isWishlisted: siblings.some((c) => c.isWishlisted),
        isFavorite: siblings.some((c) => c.isFavorite),
        isGroupWishlisted: groupWishlistedIn.length > 0,
        groupWishlistedIn,
        availableInGroups,
        createdAt: primary.createdAt,
      };
    },
  );

  // Apply the set filter after stats are merged — cheaper than
  // adding another join and lets a single SQL pass back all three
  // flags for downstream callers (PlaceCard icons + filter pills).
  const filtered = setFilter
    ? cards.filter((c) => {
        if (setFilter === "wishlist") return c.isWishlisted;
        if (setFilter === "favorites") return c.isFavorite;
        // group-wishlist: optional further narrowing to a specific group.
        if (!c.isGroupWishlisted) return false;
        if (groupWishlistGroupId) {
          return c.groupWishlistedIn.some(
            (g) => g.id === groupWishlistGroupId,
          );
        }
        return true;
      })
    : cards;

  return sortCards(filtered, sortBy, sortDir);
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
