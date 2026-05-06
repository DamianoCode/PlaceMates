import { and, eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  groupMembers,
  groupWishlist,
  groups,
  places,
  profiles,
} from "@/infra/db/schema";
import { err, ok, type Result } from "../result";

/**
 * Group-wishlist service. Mirrors the personal `wishlist` service
 * but the unit of ownership is the group, not the user — every
 * member sees the same list and any member can add/remove entries.
 *
 * The personal wishlist stays untouched; the two coexist so a
 * user can keep a private "do odwiedzenia" alongside what the
 * group is planning together.
 */

/** Verify caller is a member of the place's group AND the target
 *  group is the same one. The "target group" arrives explicitly so
 *  we never silently file a pin under the wrong group when a user
 *  is in several. */
async function userMemberOfPlaceGroup(
  placeId: string,
  userId: string,
  groupId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: places.id })
    .from(places)
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(
      and(
        eq(places.id, placeId),
        eq(places.groupId, groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .limit(1);
  return !!row;
}

export async function isOnGroupWishlist(
  placeId: string,
  groupId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ p: groupWishlist.placeId })
    .from(groupWishlist)
    .where(
      and(
        eq(groupWishlist.placeId, placeId),
        eq(groupWishlist.groupId, groupId),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Toggle a place on/off the group wishlist. The caller must be a
 * member of the place's group; the `groupId` we record matches the
 * place's group (a place lives in exactly one group, so there's no
 * ambiguity). `userId` becomes `added_by` for attribution.
 */
export async function toggleGroupWishlist(
  placeId: string,
  userId: string,
): Promise<Result<{ onGroupWishlist: boolean }>> {
  // Look up the place's group so we don't have to trust a client-
  // supplied groupId and so we can verify membership in one query.
  const [placeRow] = await db
    .select({ groupId: places.groupId })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  if (!placeRow) return err("Brak takiego miejsca.");

  const groupId = placeRow.groupId;
  if (!(await userMemberOfPlaceGroup(placeId, userId, groupId))) {
    return err("Nie należysz do tej grupy.");
  }

  const already = await isOnGroupWishlist(placeId, groupId);
  if (already) {
    await db
      .delete(groupWishlist)
      .where(
        and(
          eq(groupWishlist.placeId, placeId),
          eq(groupWishlist.groupId, groupId),
        ),
      );
    return ok({ onGroupWishlist: false });
  }
  await db
    .insert(groupWishlist)
    .values({ placeId, groupId, addedBy: userId })
    .onConflictDoNothing();
  return ok({ onGroupWishlist: true });
}

export type GroupWishlistEntry = {
  placeId: string;
  groupId: string;
  addedBy: string;
  addedByDisplayName: string;
  addedAt: Date;
};

/**
 * Resolve the "is this place on the group wishlist?" question with
 * attribution — the preview sheet uses the addedBy display name to
 * render "Asia dodała do listy".
 */
export async function getGroupWishlistEntry(
  placeId: string,
): Promise<GroupWishlistEntry | null> {
  const [row] = await db
    .select({
      placeId: groupWishlist.placeId,
      groupId: groupWishlist.groupId,
      addedBy: groupWishlist.addedBy,
      addedByDisplayName: profiles.displayName,
      addedAt: groupWishlist.addedAt,
    })
    .from(groupWishlist)
    .innerJoin(profiles, eq(profiles.id, groupWishlist.addedBy))
    .where(eq(groupWishlist.placeId, placeId))
    .limit(1);
  return row ?? null;
}

/** Set of place ids the user can see on group wishlists across all
 *  their groups. Powers the "Do odwiedzenia (grupowo)" filter on
 *  /places. */
export async function groupWishlistPlaceIdsForUser(
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ placeId: groupWishlist.placeId })
    .from(groupWishlist)
    .innerJoin(
      groupMembers,
      eq(groupMembers.groupId, groupWishlist.groupId),
    )
    .where(eq(groupMembers.userId, userId));
  return new Set(rows.map((r) => r.placeId));
}

/**
 * Per-group breakdown of group-wishlist place ids for the user.
 * Returns one entry per group the user is in that has anything on its
 * shared wishlist; groups with empty wishlists are dropped (the UI uses
 * `.length >= 2` to decide whether the per-group narrow row is even
 * worth showing). Powers the map's per-group pill row.
 */
export async function groupWishlistByGroupForUser(
  userId: string,
): Promise<Array<{ id: string; name: string; placeIds: string[] }>> {
  const rows = await db
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
    .where(eq(groupMembers.userId, userId));

  const byGroup = new Map<
    string,
    { name: string; placeIds: Set<string> }
  >();
  for (const r of rows) {
    const existing = byGroup.get(r.groupId);
    if (existing) existing.placeIds.add(r.placeId);
    else
      byGroup.set(r.groupId, {
        name: r.groupName,
        placeIds: new Set([r.placeId]),
      });
  }
  return Array.from(byGroup.entries())
    .map(([id, v]) => ({
      id,
      name: v.name,
      placeIds: Array.from(v.placeIds),
    }))
    // Stable alpha order — matches how groups appear on /places.
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}
