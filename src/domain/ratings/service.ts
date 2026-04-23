import { and, desc, eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, places, profiles, ratings } from "@/infra/db/schema";
import { computeOverall, type RatingSchema } from "@/lib/validation/rating";
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

  return ok({ id: row.id, overall });
}
