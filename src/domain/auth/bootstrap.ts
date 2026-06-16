import { eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, groups, profiles } from "@/infra/db/schema";

export type BootstrapUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * Idempotent first-login setup: ensures a profile row + a personal
 * group ("Moja") exist for this user. Safe to call from both the
 * password-signup server action and the OAuth callback — duplicates
 * are prevented by the profile PK and a lookup on groups.owner_id.
 */
export async function bootstrapProfileAndGroup(user: BootstrapUser): Promise<{
  isNewProfile: boolean;
}> {
  // Profile: insert-or-skip (PK handles the duplicate).
  const [existingProfile] = await db
    .select({ id: profiles.id, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const isNewProfile = !existingProfile;

  if (isNewProfile) {
    await db
      .insert(profiles)
      .values({
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      })
      .onConflictDoNothing();
  } else if (!existingProfile.avatarUrl && user.avatarUrl) {
    // Backfill the OAuth avatar for profiles minted before it was
    // captured (the trigger / older bootstrap only set it on first
    // insert). Only when empty — never clobber a custom uploaded avatar.
    // Makes the Google picture available everywhere profiles.avatar_url
    // is read (activity feed, group member lists), not just on /me where
    // a `?? user.avatarUrl` fallback masked the gap.
    await db
      .update(profiles)
      .set({ avatarUrl: user.avatarUrl })
      .where(eq(profiles.id, user.id));
  }

  // Personal group: only mint one if the user doesn't already own a group.
  // (Accepting an invite later adds membership rows but never an
  //  owner relationship, so this stays stable.)
  const existingGroup = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.ownerId, user.id))
    .limit(1);

  if (existingGroup.length === 0) {
    const [g] = await db
      .insert(groups)
      .values({ name: "Moja", ownerId: user.id })
      .returning({ id: groups.id });
    await db.insert(groupMembers).values({
      groupId: g.id,
      userId: user.id,
      role: "owner",
    });
  }

  return { isNewProfile };
}
