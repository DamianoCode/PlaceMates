import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, places, wishlist } from "@/infra/db/schema";
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

export async function isOnWishlist(placeId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ p: wishlist.placeId })
    .from(wishlist)
    .where(and(eq(wishlist.placeId, placeId), eq(wishlist.userId, userId)))
    .limit(1);
  return !!row;
}

export async function toggleWishlist(
  placeId: string,
  userId: string,
): Promise<Result<{ onWishlist: boolean }>> {
  if (!(await userCanAccessPlace(placeId, userId))) {
    return err("Brak dostępu do tego miejsca.");
  }
  const already = await isOnWishlist(placeId, userId);
  if (already) {
    await db
      .delete(wishlist)
      .where(and(eq(wishlist.placeId, placeId), eq(wishlist.userId, userId)));
    return ok({ onWishlist: false });
  }
  await db.insert(wishlist).values({ placeId, userId }).onConflictDoNothing();
  return ok({ onWishlist: true });
}

export type WishlistItem = {
  placeId: string;
  name: string;
  categoryId: string;
  lat: number;
  lng: number;
  addedAt: Date;
};

export async function listWishlistForUser(userId: string): Promise<WishlistItem[]> {
  // Coordinates come straight out of the same query — PostGIS
  // ST_Y/ST_X on the geography point, matching how places/service.ts
  // projects lat/lng. (An earlier version returned 0,0 placeholders,
  // which dropped every wishlist pin onto Null Island off Africa.)
  const rows = await db
    .select({
      placeId: places.id,
      name: places.name,
      categoryId: places.categoryId,
      lat: sql<number>`ST_Y(${places.location}::geometry)::float8`,
      lng: sql<number>`ST_X(${places.location}::geometry)::float8`,
      addedAt: wishlist.addedAt,
    })
    .from(wishlist)
    .innerJoin(places, eq(places.id, wishlist.placeId))
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(wishlist.userId, userId), eq(groupMembers.userId, userId)))
    .orderBy(desc(wishlist.addedAt));

  return rows;
}

/** Place ids the user has wishlisted — cheap lookup for filters/UI. */
export async function wishlistedIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: wishlist.placeId })
    .from(wishlist)
    .where(eq(wishlist.userId, userId));
  return new Set(rows.map((r) => r.id));
}
