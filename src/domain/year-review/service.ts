import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { photos, places } from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";
import type { RankedPlace } from "@/domain/ranking/service";
import {
  buildCategoryBreakdown,
  type CategoryBreakdownRow,
  type GroupInsightCounts,
} from "@/domain/insights/service";

/**
 * "Rok w pigułce" — a per-year, group-scoped recap. All metrics are
 * confined to a single calendar year via each source row's timestamp
 * (places/ratings/photos by created_at, visits by visited_at). Caller
 * MUST verify group membership first — the queries trust the group id.
 *
 * Not cached: it's an occasional-visit showcase page, the queries are
 * year-bounded (small), and the cover-photo URLs need request-scoped
 * `getStorage()` anyway.
 */

export type YearTopMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** Places added + ratings made + photos uploaded that year. */
  total: number;
};

export type YearPhoto = {
  url: string;
  /** Intrinsic dimensions so the gallery can reserve each tile's box. */
  width: number;
  height: number;
};

export type YearMonth = {
  /** 1–12. */
  month: number;
  /** Total contributions (places + ratings + photos + visits) that month. */
  count: number;
};

export type YearReview = {
  /** The resolved year (requested, clamped to [minYear, maxYear]). */
  year: number;
  /** Earliest year with any data — lower bound for the switcher. */
  minYear: number;
  /** Current year — upper bound for the switcher. */
  maxYear: number;
  counts: GroupInsightCounts;
  /** Up to 3 highest-rated places (by ratings left that year). */
  topPlaces: RankedPlace[];
  /** Category split of the year's rated places (reuses the Insights bars). */
  categories: CategoryBreakdownRow[];
  /** Member with the most contributions that year (null if none). */
  topMember: YearTopMember | null;
  /** 12-element timeline, index 0 = January. */
  monthly: YearMonth[];
  /** The year's photos (with dimensions) for the masonry gallery. */
  gallery: YearPhoto[];
  /** Sum of `monthly` — drives the empty state + "X wydarzeń". */
  totalEvents: number;
};

type RankedRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category_hint: string | null;
  has_external: boolean;
  avg: number;
  cnt: number;
};

export async function getGroupYearReview(
  groupId: string,
  requestedYear?: number,
): Promise<YearReview> {
  const maxYear = new Date().getUTCFullYear();

  // Earliest year with data bounds the switcher's "previous" arrow.
  const minRows = await db.execute<{ y: number | null }>(sql`
    SELECT EXTRACT(YEAR FROM MIN(created_at))::int AS y
      FROM places WHERE group_id = ${groupId}
  `);
  const minYear = minRows[0]?.y ?? maxYear;

  const want =
    requestedYear && Number.isFinite(requestedYear) ? requestedYear : maxYear;
  const year = Math.min(Math.max(want, minYear), maxYear);

  // ISO-string bounds (not Date objects): the postgres-js driver with
  // `prepare: false` can't bind a raw Date as a parameter in db.execute —
  // pass text + cast to timestamptz in SQL. UTC boundaries are fine here.
  const start = `${year}-01-01T00:00:00Z`;
  const end = `${year + 1}-01-01T00:00:00Z`;

  const [countRows, rankedRows, monthlyRows, memberRows, galleryRows] =
    await Promise.all([
    // Headline counters (same shape as Insights so CounterGrid is reused),
    // each confined to the year window.
    db.execute<{
      places: number;
      rated: number;
      ratings: number;
      visits: number;
      photos: number;
      categories: number;
    }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM places
          WHERE group_id = ${groupId}
            AND created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz) AS places,
        (SELECT COUNT(DISTINCT r.place_id)::int
           FROM ratings r JOIN places p ON p.id = r.place_id
          WHERE p.group_id = ${groupId}
            AND r.created_at >= ${start}::timestamptz AND r.created_at < ${end}::timestamptz) AS rated,
        (SELECT COUNT(*)::int
           FROM ratings r JOIN places p ON p.id = r.place_id
          WHERE p.group_id = ${groupId}
            AND r.created_at >= ${start}::timestamptz AND r.created_at < ${end}::timestamptz) AS ratings,
        (SELECT COUNT(*)::int
           FROM visits v JOIN places p ON p.id = v.place_id
          WHERE p.group_id = ${groupId}
            AND v.visited_at >= ${start}::timestamptz AND v.visited_at < ${end}::timestamptz) AS visits,
        (SELECT COUNT(*)::int
           FROM photos ph JOIN places p ON p.id = ph.place_id
          WHERE p.group_id = ${groupId}
            AND ph.created_at >= ${start}::timestamptz AND ph.created_at < ${end}::timestamptz) AS photos,
        (SELECT COUNT(DISTINCT category_id)::int FROM places
          WHERE group_id = ${groupId}
            AND created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz) AS categories
    `),

    // Year-scoped ranking — full list (top 3 for the hero, all rows feed
    // the category breakdown). Aggregated over ratings LEFT that year.
    db.execute<RankedRow>(sql`
      SELECT cp.id,
             cp.name,
             ST_Y(cp.location::geometry)::float8 AS lat,
             ST_X(cp.location::geometry)::float8 AS lng,
             cp.category_hint,
             (cp.provider IS NOT NULL AND cp.external_id IS NOT NULL) AS has_external,
             AVG(r.overall)::float8 AS avg,
             COUNT(r.*)::int AS cnt
        FROM canonical_places cp
        JOIN places p  ON p.canonical_place_id = cp.id
        JOIN ratings r ON r.place_id = p.id
       WHERE p.group_id = ${groupId}
         AND r.created_at >= ${start}::timestamptz AND r.created_at < ${end}::timestamptz
       GROUP BY cp.id
      HAVING COUNT(r.*) >= 1
       ORDER BY AVG(r.overall) DESC, COUNT(r.*) DESC
       LIMIT 100
    `),

    // Monthly timeline — one bucket per month across every contribution.
    db.execute<{ m: number; cnt: number }>(sql`
      SELECT EXTRACT(MONTH FROM ts)::int AS m, COUNT(*)::int AS cnt
        FROM (
          SELECT created_at AS ts FROM places
            WHERE group_id = ${groupId}
              AND created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz
          UNION ALL
          SELECT r.created_at FROM ratings r JOIN places p ON p.id = r.place_id
            WHERE p.group_id = ${groupId}
              AND r.created_at >= ${start}::timestamptz AND r.created_at < ${end}::timestamptz
          UNION ALL
          SELECT ph.created_at FROM photos ph JOIN places p ON p.id = ph.place_id
            WHERE p.group_id = ${groupId}
              AND ph.created_at >= ${start}::timestamptz AND ph.created_at < ${end}::timestamptz
          UNION ALL
          SELECT v.visited_at FROM visits v JOIN places p ON p.id = v.place_id
            WHERE p.group_id = ${groupId}
              AND v.visited_at >= ${start}::timestamptz AND v.visited_at < ${end}::timestamptz
        ) e
       GROUP BY 1
    `),

    // Most active member — places added + ratings + photos, summed per user.
    db.execute<{
      id: string;
      display_name: string;
      avatar_url: string | null;
      total: number;
    }>(sql`
      SELECT prof.id, prof.display_name, prof.avatar_url, SUM(c.cnt)::int AS total
        FROM (
          SELECT created_by AS uid, COUNT(*) AS cnt FROM places
            WHERE group_id = ${groupId}
              AND created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz
           GROUP BY created_by
          UNION ALL
          SELECT r.user_id, COUNT(*) FROM ratings r JOIN places p ON p.id = r.place_id
            WHERE p.group_id = ${groupId}
              AND r.created_at >= ${start}::timestamptz AND r.created_at < ${end}::timestamptz
           GROUP BY r.user_id
          UNION ALL
          SELECT ph.user_id, COUNT(*) FROM photos ph JOIN places p ON p.id = ph.place_id
            WHERE p.group_id = ${groupId}
              AND ph.created_at >= ${start}::timestamptz AND ph.created_at < ${end}::timestamptz
           GROUP BY ph.user_id
        ) c
        JOIN profiles prof ON prof.id = c.uid
       GROUP BY prof.id, prof.display_name, prof.avatar_url
       ORDER BY total DESC
       LIMIT 1
    `),

    // The year's photos for the masonry gallery — cover shots first, then
    // newest. Width/height come along so the collage can reserve each
    // tile's aspect ratio (no layout shift as images stream in).
    db.execute<{ path: string; width: number; height: number }>(sql`
      SELECT ph.storage_path AS path, ph.width, ph.height
        FROM photos ph JOIN places p ON p.id = ph.place_id
       WHERE p.group_id = ${groupId}
         AND ph.created_at >= ${start}::timestamptz AND ph.created_at < ${end}::timestamptz
       ORDER BY ph.is_cover DESC, ph.created_at DESC
       LIMIT 18
    `),
  ]);

  // Cover photos for the top-3 canonicals (cover-first, newest-next),
  // resolved to public URLs here (getStorage touches cookies).
  const top = rankedRows.slice(0, 3);
  const photoBy = new Map<string, string>();
  if (top.length > 0) {
    const ids = top.map((r) => r.id);
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
  const storage =
    photoBy.size > 0 || galleryRows.length > 0 ? await getStorage() : null;
  const gallery: YearPhoto[] = storage
    ? galleryRows.map((r) => ({
        url: storage.publicUrl(PHOTO_BUCKET, r.path),
        width: Number(r.width),
        height: Number(r.height),
      }))
    : [];

  const toRanked = (r: RankedRow): RankedPlace => {
    const path = photoBy.get(r.id);
    return {
      canonicalId: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      categoryHint: r.category_hint,
      hasExternalId: r.has_external,
      avg: Math.round(Number(r.avg) * 100) / 100,
      count: Number(r.cnt),
      photoUrl: path && storage ? storage.publicUrl(PHOTO_BUCKET, path) : null,
    };
  };

  // Category breakdown reuses the full year-ranked list (no photos needed).
  const rankedForBreakdown: RankedPlace[] = rankedRows.map((r) => ({
    canonicalId: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    categoryHint: r.category_hint,
    hasExternalId: r.has_external,
    avg: Math.round(Number(r.avg) * 100) / 100,
    count: Number(r.cnt),
    photoUrl: null,
  }));

  const monthly: YearMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: 0,
  }));
  for (const row of monthlyRows) {
    const idx = Number(row.m) - 1;
    if (idx >= 0 && idx < 12) monthly[idx].count = Number(row.cnt);
  }
  const totalEvents = monthly.reduce((s, m) => s + m.count, 0);

  const c = countRows[0];
  const counts: GroupInsightCounts = {
    places: Number(c?.places ?? 0),
    rated: Number(c?.rated ?? 0),
    ratings: Number(c?.ratings ?? 0),
    visits: Number(c?.visits ?? 0),
    photos: Number(c?.photos ?? 0),
    categories: Number(c?.categories ?? 0),
  };

  const m = memberRows[0];
  const topMember: YearTopMember | null = m
    ? {
        id: m.id,
        displayName: m.display_name,
        avatarUrl: m.avatar_url,
        total: Number(m.total),
      }
    : null;

  return {
    year,
    minYear,
    maxYear,
    counts,
    topPlaces: top.map(toRanked),
    categories: buildCategoryBreakdown(rankedForBreakdown),
    topMember,
    monthly,
    gallery,
    totalEvents,
  };
}
