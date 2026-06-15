import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/infra/db/client";
import type { RankedPlace } from "@/domain/ranking/service";
import { categoryLabel } from "@/lib/category-labels";
import {
  INSIGHTS_CACHE_TAG,
  INSIGHTS_CACHE_TTL_SECONDS,
} from "@/lib/constants";

/**
 * Headline counters for one group's Insights dashboard. All scoped to a
 * single group via `places.group_id`; the ratings/visits/photos tallies
 * hop through that group's places. Caller MUST verify membership before
 * passing a group id — the SQL trusts it (same contract as ranking's
 * `groupId` option).
 */
export type GroupInsightCounts = {
  /** Places saved in the group. */
  places: number;
  /** Distinct places that carry at least one rating. */
  rated: number;
  /** Total ratings left across the group's places. */
  ratings: number;
  /** Logged visits across the group's places. */
  visits: number;
  /** Photos attached to the group's places. */
  photos: number;
  /** Distinct categories the group's places span. */
  categories: number;
};

/**
 * Single aggregate roundtrip — six correlated subqueries against the
 * group's places. Cheaper and simpler than six joins; Postgres plans
 * each subquery off the `places_group_idx` / per-table place_id indexes.
 */
async function getGroupInsightCountsUncached(
  groupId: string,
): Promise<GroupInsightCounts> {
  const rows = await db.execute<{
    places: number;
    rated: number;
    ratings: number;
    visits: number;
    photos: number;
    categories: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int
         FROM places WHERE group_id = ${groupId}) AS places,
      (SELECT COUNT(DISTINCT r.place_id)::int
         FROM ratings r JOIN places p ON p.id = r.place_id
        WHERE p.group_id = ${groupId}) AS rated,
      (SELECT COUNT(*)::int
         FROM ratings r JOIN places p ON p.id = r.place_id
        WHERE p.group_id = ${groupId}) AS ratings,
      (SELECT COUNT(*)::int
         FROM visits v JOIN places p ON p.id = v.place_id
        WHERE p.group_id = ${groupId}) AS visits,
      (SELECT COUNT(*)::int
         FROM photos ph JOIN places p ON p.id = ph.place_id
        WHERE p.group_id = ${groupId}) AS photos,
      (SELECT COUNT(DISTINCT category_id)::int
         FROM places WHERE group_id = ${groupId}) AS categories
  `);
  const r = rows[0];
  return {
    places: Number(r?.places ?? 0),
    rated: Number(r?.rated ?? 0),
    ratings: Number(r?.ratings ?? 0),
    visits: Number(r?.visits ?? 0),
    photos: Number(r?.photos ?? 0),
    categories: Number(r?.categories ?? 0),
  };
}

/**
 * Cached entry-point. Keyed per group (the argument is part of the cache
 * key) and invalidated by `INSIGHTS_CACHE_TAG` on rating/place mutations;
 * otherwise refreshes within INSIGHTS_CACHE_TTL_SECONDS.
 */
export const getGroupInsightCounts = unstable_cache(
  getGroupInsightCountsUncached,
  ["group-insight-counts"],
  {
    tags: [INSIGHTS_CACHE_TAG],
    revalidate: INSIGHTS_CACHE_TTL_SECONDS,
  },
);

export type CategoryBreakdownRow = {
  slug: string | null;
  label: string;
  /** Number of rated places in this category. */
  count: number;
  /** Rating-count-weighted average across the category's places. */
  avg: number;
};

/**
 * Derive a per-category breakdown from an already-fetched ranked list —
 * no extra query. Each `RankedPlace` is one canonical with its own avg +
 * rating count; we bucket by `categoryHint`, sum the place counts, and
 * weight the average by each place's rating count so a 1-rating place
 * doesn't swing the category as hard as a 20-rating one. Sorted by place
 * count desc, then avg desc.
 */
export function buildCategoryBreakdown(
  ranked: RankedPlace[],
): CategoryBreakdownRow[] {
  const byCat = new Map<
    string,
    { slug: string | null; count: number; weightedSum: number; weight: number }
  >();
  for (const p of ranked) {
    // NULL hint and "" both bucket as "other" so they merge under one
    // "Inne" row instead of fragmenting.
    const key = p.categoryHint || "other";
    let bucket = byCat.get(key);
    if (!bucket) {
      bucket = { slug: p.categoryHint, count: 0, weightedSum: 0, weight: 0 };
      byCat.set(key, bucket);
    }
    bucket.count += 1;
    bucket.weightedSum += p.avg * p.count;
    bucket.weight += p.count;
  }

  return Array.from(byCat.values())
    .map((b) => ({
      slug: b.slug,
      label: categoryLabel(b.slug),
      count: b.count,
      avg: b.weight > 0 ? Math.round((b.weightedSum / b.weight) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg);
}
