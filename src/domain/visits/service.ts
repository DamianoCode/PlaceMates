import { and, desc, eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, places, profiles, visits } from "@/infra/db/schema";
import { err, ok, type Result } from "../result";

export type VisitView = {
  id: string;
  placeId: string;
  userId: string;
  userDisplayName: string;
  visitedAt: Date;
  note: string | null;
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

export async function listVisitsForPlace(
  placeId: string,
  userId: string,
): Promise<VisitView[]> {
  if (!(await userCanAccessPlace(placeId, userId))) return [];
  const rows = await db
    .select({
      id: visits.id,
      placeId: visits.placeId,
      userId: visits.userId,
      userDisplayName: profiles.displayName,
      visitedAt: visits.visitedAt,
      note: visits.note,
    })
    .from(visits)
    .innerJoin(profiles, eq(profiles.id, visits.userId))
    .where(eq(visits.placeId, placeId))
    .orderBy(desc(visits.visitedAt));
  return rows;
}

export async function addVisit(
  placeId: string,
  userId: string,
  note: string | null,
  visitedAt?: Date,
): Promise<Result<{ id: string }>> {
  if (!(await userCanAccessPlace(placeId, userId))) {
    return err("Brak dostępu do tego miejsca.");
  }
  const [row] = await db
    .insert(visits)
    .values({ placeId, userId, note, visitedAt: visitedAt ?? new Date() })
    .returning({ id: visits.id });
  return ok({ id: row.id });
}

export async function deleteVisit(
  visitId: string,
  userId: string,
): Promise<Result<null>> {
  // Only the author can delete their own visit.
  const rows = await db
    .delete(visits)
    .where(and(eq(visits.id, visitId), eq(visits.userId, userId)))
    .returning({ id: visits.id });
  if (rows.length === 0) return err("Nie znaleziono wpisu.");
  return ok(null);
}
