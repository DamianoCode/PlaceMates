import { desc, eq, inArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/infra/db/client";
import { canonicalPlaces, photos, places } from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";
import {
  RANKING_CACHE_TAG,
  RANKING_CACHE_TTL_SECONDS,
  RANKING_LIMIT_DEFAULT,
  RANKING_MIN_RATINGS_DEFAULT,
} from "@/lib/constants";

export type RankedPlace = {
  canonicalId: string;
  name: string;
  lat: number;
  lng: number;
  categoryHint: string | null;
  avg: number;
  count: number;
  /** True when canonical has provider+external_id, i.e. POI-backed. */
  hasExternalId: boolean;
  /**
   * Cover photo for the canonical, picked across all its group-scoped
   * `places` siblings (cover-first, then newest). Null when no sibling
   * has a photo — the card falls back to the category-icon tile, same
   * as the places list. Keeps ranking rows visually consistent with
   * `/places` instead of always showing the generic tile.
   */
  photoUrl: string | null;
};

/**
 * Internal shape returned by the cached layer: identical to RankedPlace
 * but carrying the raw storage path instead of a public URL. Building
 * the URL needs `getStorage()` → `cookies()`, which is forbidden inside
 * `unstable_cache`; paths are cacheable, the path→URL mapping isn't.
 */
type RankedPlaceRow = Omit<RankedPlace, "photoUrl"> & {
  photoPath: string | null;
};

export type RankingOptions = {
  /** Our slug (e.g. "ice-cream"). Null / undefined = wszystkie kategorie. */
  categorySlug?: string | null;
  /** default 50 */
  limit?: number;
  /** default 1 — matches the user's 2-person group scenario. */
  minRatings?: number;
  /**
   * Restrict the aggregate to a single group. Null / undefined = global
   * anonymous ranking (every group's ratings contribute). Caller must
   * verify the user is a member before passing a real id — the SQL
   * doesn't enforce this on its own.
   */
  groupId?: string | null;
};

/**
 * Global ranking, aggregated across every canonical place.
 *
 * No per-user or per-group filter: every rating that exists in the DB
 * contributes anonymously to the avg + count. Names and groups are
 * deliberately not exposed at this surface.
 *
 * Category filter operates on `canonical_places.category_hint`, which
 * is stored as our own slug (already normalised from OSM values at
 * ingest time by findOrCreateExternalCanonical / createLocalCanonical).
 */
async function listRankedPlacesUncached(
  opts: RankingOptions = {},
): Promise<RankedPlaceRow[]> {
  const limit = opts.limit ?? RANKING_LIMIT_DEFAULT;
  const minRatings = opts.minRatings ?? RANKING_MIN_RATINGS_DEFAULT;
  const category = opts.categorySlug ?? null;
  const groupId = opts.groupId ?? null;

  // Two optional filters, possibly both — compose into a single WHERE.
  const filters = [
    category ? sql`cp.category_hint = ${category}` : null,
    groupId ? sql`p.group_id = ${groupId}` : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);
  const whereClause =
    filters.length === 0
      ? sql``
      : sql`WHERE ${sql.join(filters, sql` AND `)}`;

  const rows = await db.execute<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    category_hint: string | null;
    has_external: boolean;
    avg: number;
    cnt: number;
  }>(sql`
    SELECT cp.id,
           cp.name,
           ST_Y(cp.location::geometry)::float8 AS lat,
           ST_X(cp.location::geometry)::float8 AS lng,
           cp.category_hint,
           (cp.provider IS NOT NULL AND cp.external_id IS NOT NULL) AS has_external,
           AVG(r.overall)::float8 AS avg,
           COUNT(r.*)::int AS cnt
      FROM ${canonicalPlaces} cp
      JOIN places p  ON p.canonical_place_id = cp.id
      JOIN ratings r ON r.place_id = p.id
     ${whereClause}
     GROUP BY cp.id
    HAVING COUNT(r.*) >= ${minRatings}
     ORDER BY AVG(r.overall) DESC, COUNT(r.*) DESC
     LIMIT ${limit}
  `);

  // Cover photo per canonical. Photos hang off group-scoped `places`,
  // so we hop places → photos for every ranked canonical in one batched
  // query (cover-first, newest-next) and keep the first hit per
  // canonical — mirrors the dedupe in list-with-stats so a place looks
  // the same here as in /places.
  const ids = rows.map((r) => r.id);
  const photoBy = new Map<string, string>();
  if (ids.length > 0) {
    const photoRows = await db
      .select({
        canonicalId: places.canonicalPlaceId,
        storagePath: photos.storagePath,
      })
      .from(photos)
      .innerJoin(places, eq(places.id, photos.placeId))
      .where(inArray(places.canonicalPlaceId, ids))
      .orderBy(desc(photos.isCover), desc(photos.createdAt));
    for (const p of photoRows) {
      if (p.canonicalId && !photoBy.has(p.canonicalId)) {
        photoBy.set(p.canonicalId, p.storagePath);
      }
    }
  }

  return rows.map((r) => ({
    canonicalId: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    categoryHint: r.category_hint,
    hasExternalId: r.has_external,
    avg: Math.round(Number(r.avg) * 100) / 100,
    count: Number(r.cnt),
    photoPath: photoBy.get(r.id) ?? null,
  }));
}

/**
 * Cached entry-point for `/ranking` and any other consumer. The data
 * is anonymous and slowly changing — a new rating reaches the surface
 * within RANKING_CACHE_TTL_SECONDS or when `revalidateTag` is called
 * after a rating mutation. Keys include all option fields so different
 * filters cache independently.
 */
const listRankedPlacesCached = unstable_cache(
  listRankedPlacesUncached,
  ["ranking-list"],
  {
    tags: [RANKING_CACHE_TAG],
    revalidate: RANKING_CACHE_TTL_SECONDS,
  },
);

/**
 * Public entry-point. Reads the cached rows (storage paths) and resolves
 * cover photos to public URLs here — `getStorage()` touches `cookies()`,
 * so it must live outside the cache scope. The mapping is cheap string
 * work; we only spin up the storage client when a row actually has a
 * photo.
 */
export async function listRankedPlaces(
  opts: RankingOptions = {},
): Promise<RankedPlace[]> {
  const rows = await listRankedPlacesCached(opts);
  const storage = rows.some((r) => r.photoPath) ? await getStorage() : null;
  return rows.map((r) => {
    const { photoPath, ...rest } = r;
    return {
      ...rest,
      photoUrl:
        photoPath && storage ? storage.publicUrl(PHOTO_BUCKET, photoPath) : null,
    };
  });
}

export type CanonicalView = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  categoryHint: string | null;
  hasExternalId: boolean;
  avg: number | null;
  count: number;
};

/**
 * Canonical detail for the ranking subpage. Aggregation identical to
 * listRankedPlaces but scoped to a single canonical and without the
 * minRatings gate — user lands here from ranking list so a non-gated
 * view is fine.
 */
async function getCanonicalByIdUncached(
  canonicalId: string,
): Promise<CanonicalView | null> {
  const rows = await db.execute<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    category_hint: string | null;
    has_external: boolean;
    avg: number | null;
    cnt: number;
  }>(sql`
    SELECT cp.id,
           cp.name,
           ST_Y(cp.location::geometry)::float8 AS lat,
           ST_X(cp.location::geometry)::float8 AS lng,
           cp.category_hint,
           (cp.provider IS NOT NULL AND cp.external_id IS NOT NULL) AS has_external,
           AVG(r.overall)::float8 AS avg,
           COUNT(r.*)::int AS cnt
      FROM ${canonicalPlaces} cp
      LEFT JOIN places p  ON p.canonical_place_id = cp.id
      LEFT JOIN ratings r ON r.place_id = p.id
     WHERE cp.id = ${canonicalId}
     GROUP BY cp.id
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    categoryHint: r.category_hint,
    hasExternalId: r.has_external,
    avg: r.avg !== null ? Math.round(Number(r.avg) * 100) / 100 : null,
    count: Number(r.cnt),
  };
}

export const getCanonicalById = unstable_cache(
  getCanonicalByIdUncached,
  ["ranking-canonical"],
  {
    tags: [RANKING_CACHE_TAG],
    revalidate: RANKING_CACHE_TTL_SECONDS,
  },
);

/**
 * Find the user's own place linked to a canonical (any group they're in).
 * Used on /ranking/[canonicalId] to show "Otwórz w swojej grupie".
 */
export async function findUserPlaceForCanonical(
  canonicalId: string,
  userId: string,
): Promise<{ placeId: string; groupName: string } | null> {
  const rows = await db.execute<{ place_id: string; group_name: string }>(sql`
    SELECT p.id AS place_id, g.name AS group_name
      FROM places p
      JOIN groups g         ON g.id = p.group_id
      JOIN group_members gm ON gm.group_id = p.group_id AND gm.user_id = ${userId}
     WHERE p.canonical_place_id = ${canonicalId}
     ORDER BY p.created_at ASC
     LIMIT 1
  `);
  const r = rows[0];
  return r ? { placeId: r.place_id, groupName: r.group_name } : null;
}
