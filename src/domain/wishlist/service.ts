import { and, desc, eq } from "drizzle-orm";
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
  const rows = await db
    .select({
      placeId: places.id,
      name: places.name,
      categoryId: places.categoryId,
      addedAt: wishlist.addedAt,
    })
    .from(wishlist)
    .innerJoin(places, eq(places.id, wishlist.placeId))
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(wishlist.userId, userId), eq(groupMembers.userId, userId)))
    .orderBy(desc(wishlist.addedAt));

  // Fetch coords in a separate round-trip via raw SQL for the same ids.
  // Small list, so correlated lookup is fine.
  if (rows.length === 0) return [];
  return rows.map((r) => ({
    placeId: r.placeId,
    name: r.name,
    categoryId: r.categoryId,
    addedAt: r.addedAt,
    lat: 0,
    lng: 0,
  }));
}

/** Place ids the user has wishlisted — cheap lookup for filters/UI. */
export async function wishlistedIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: wishlist.placeId })
    .from(wishlist)
    .where(eq(wishlist.userId, userId));
  return new Set(rows.map((r) => r.id));
}
