import { and, desc, eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { favorites, groupMembers, places } from "@/infra/db/schema";
import { err, ok, type Result } from "../result";

async function userCanAccessPlace(placeId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: places.id })
    .from(places)
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(places.id, placeId), eq(groupMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function isFavorite(placeId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ p: favorites.placeId })
    .from(favorites)
    .where(and(eq(favorites.placeId, placeId), eq(favorites.userId, userId)))
    .limit(1);
  return !!row;
}

export async function toggleFavorite(
  placeId: string,
  userId: string,
): Promise<Result<{ isFavorite: boolean }>> {
  if (!(await userCanAccessPlace(placeId, userId))) {
    return err("Brak dostępu do tego miejsca.");
  }
  const already = await isFavorite(placeId, userId);
  if (already) {
    await db
      .delete(favorites)
      .where(and(eq(favorites.placeId, placeId), eq(favorites.userId, userId)));
    return ok({ isFavorite: false });
  }
  await db.insert(favorites).values({ placeId, userId }).onConflictDoNothing();
  return ok({ isFavorite: true });
}

export async function favoriteIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: favorites.placeId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  return new Set(rows.map((r) => r.id));
}

export type FavoriteItem = {
  placeId: string;
  name: string;
  categoryId: string;
  addedAt: Date;
};

export async function listFavoritesForUser(userId: string): Promise<FavoriteItem[]> {
  const rows = await db
    .select({
      placeId: places.id,
      name: places.name,
      categoryId: places.categoryId,
      addedAt: favorites.addedAt,
    })
    .from(favorites)
    .innerJoin(places, eq(places.id, favorites.placeId))
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(favorites.userId, userId), eq(groupMembers.userId, userId)))
    .orderBy(desc(favorites.addedAt));
  return rows;
}
