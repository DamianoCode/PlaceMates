import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  categories,
  places,
  profiles,
  publicShares,
  ratings,
} from "@/infra/db/schema";
import { err, ok, type Result } from "../result";

export type PublicRatingView = {
  slug: string;
  placeName: string;
  categoryName: string;
  address: string | null;
  lat: number;
  lng: number;
  authorName: string;
  overall: number;
  dimensions: Record<string, number>;
  note: string | null;
  ratedAt: Date;
  dimensionLabels: Record<string, string>;
};

function generateSlug(): string {
  return randomBytes(8).toString("base64url");
}

export async function createShare(
  ratingId: string,
  userId: string,
): Promise<Result<{ slug: string }>> {
  // Only the rating's author can share it.
  const [r] = await db
    .select({ userId: ratings.userId })
    .from(ratings)
    .where(eq(ratings.id, ratingId))
    .limit(1);
  if (!r || r.userId !== userId) return err("Nie możesz udostępnić cudzej oceny.");

  // Reuse an active share if one already exists for this rating.
  const [existing] = await db
    .select({ slug: publicShares.slug })
    .from(publicShares)
    .where(and(eq(publicShares.ratingId, ratingId), isNull(publicShares.revokedAt)))
    .limit(1);
  if (existing) return ok({ slug: existing.slug });

  const slug = generateSlug();
  await db.insert(publicShares).values({
    slug,
    ratingId,
    createdBy: userId,
  });
  return ok({ slug });
}

export async function revokeShare(
  slug: string,
  userId: string,
): Promise<Result<null>> {
  const rows = await db
    .update(publicShares)
    .set({ revokedAt: new Date() })
    .where(and(eq(publicShares.slug, slug), eq(publicShares.createdBy, userId)))
    .returning({ slug: publicShares.slug });
  if (rows.length === 0) return err("Nie znaleziono udostępnienia.");
  return ok(null);
}

export async function getExistingShareSlug(
  ratingId: string,
): Promise<string | null> {
  const [existing] = await db
    .select({ slug: publicShares.slug })
    .from(publicShares)
    .where(and(eq(publicShares.ratingId, ratingId), isNull(publicShares.revokedAt)))
    .limit(1);
  return existing?.slug ?? null;
}

/** Fetches everything needed to render a public share page. No auth. */
export async function getPublicRatingBySlug(
  slug: string,
): Promise<PublicRatingView | null> {
  const rows = await db.execute<{
    slug: string;
    place_name: string;
    category_name: string;
    address: string | null;
    lat: number;
    lng: number;
    author_name: string;
    overall: string;
    dimensions: Record<string, number>;
    note: string | null;
    rated_at: Date;
    rating_schema: { key: string; label: string; min: number; max: number }[];
  }>(sql`
    SELECT
      ${publicShares.slug}           AS slug,
      ${places.name}                 AS place_name,
      ${categories.name}             AS category_name,
      ${places.address}              AS address,
      ST_Y(${places.location}::geometry)::float8 AS lat,
      ST_X(${places.location}::geometry)::float8 AS lng,
      ${profiles.displayName}        AS author_name,
      ${ratings.overall}             AS overall,
      ${ratings.dimensions}          AS dimensions,
      ${ratings.note}                AS note,
      ${ratings.updatedAt}           AS rated_at,
      ${categories.ratingSchema}     AS rating_schema
    FROM ${publicShares}
    JOIN ${ratings}    ON ${ratings.id} = ${publicShares.ratingId}
    JOIN ${places}     ON ${places.id} = ${ratings.placeId}
    JOIN ${categories} ON ${categories.id} = ${places.categoryId}
    JOIN ${profiles}   ON ${profiles.id} = ${ratings.userId}
    WHERE ${publicShares.slug} = ${slug}
      AND ${publicShares.revokedAt} IS NULL
    LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  const dimensionLabels: Record<string, string> = {};
  for (const d of r.rating_schema) dimensionLabels[d.key] = d.label;
  return {
    slug: r.slug,
    placeName: r.place_name,
    categoryName: r.category_name,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    authorName: r.author_name,
    overall: Number(r.overall),
    dimensions: r.dimensions,
    note: r.note,
    ratedAt: r.rated_at,
    dimensionLabels,
  };
}

export type PublicFeedItem = {
  slug: string;
  placeName: string;
  categoryName: string;
  authorName: string;
  overall: number;
  note: string | null;
  ratedAt: Date;
};

export async function listPublicShares(limit = 50): Promise<PublicFeedItem[]> {
  const rows = await db
    .select({
      slug: publicShares.slug,
      placeName: places.name,
      categoryName: categories.name,
      authorName: profiles.displayName,
      overall: ratings.overall,
      note: ratings.note,
      ratedAt: ratings.updatedAt,
    })
    .from(publicShares)
    .innerJoin(ratings, eq(ratings.id, publicShares.ratingId))
    .innerJoin(places, eq(places.id, ratings.placeId))
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(profiles, eq(profiles.id, ratings.userId))
    .where(isNull(publicShares.revokedAt))
    .orderBy(desc(ratings.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    slug: r.slug,
    placeName: r.placeName,
    categoryName: r.categoryName,
    authorName: r.authorName,
    overall: Number(r.overall),
    note: r.note,
    ratedAt: r.ratedAt,
  }));
}
