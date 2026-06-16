import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, groups, profiles } from "@/infra/db/schema";
import { err, ok, type Result } from "../result";

export type UserGroup = {
  id: string;
  name: string;
  role: "owner" | "member";
  memberCount: number;
  joinedAt: Date;
};

/** All groups the user belongs to, with membership counts for the /me UI. */
export async function listUserGroups(userId: string): Promise<UserGroup[]> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      memberCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${groupMembers} gm2
        WHERE gm2.group_id = ${groups.id}
      )`.as("member_count"),
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(groupMembers.joinedAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role as "owner" | "member",
    joinedAt: r.joinedAt,
    memberCount: Number(r.memberCount),
  }));
}

export async function isMember(groupId: string, userId: string): Promise<boolean> {
  const r = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return r.length > 0;
}

export async function getRole(
  groupId: string,
  userId: string,
): Promise<"owner" | "member" | null> {
  const [r] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return (r?.role ?? null) as "owner" | "member" | null;
}

export type GroupDetail = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  role: "owner" | "member";
};

export async function getGroupForUser(
  groupId: string,
  userId: string,
): Promise<GroupDetail | null> {
  const [r] = await db
    .select({
      id: groups.id,
      name: groups.name,
      ownerId: groups.ownerId,
      createdAt: groups.createdAt,
      role: groupMembers.role,
    })
    .from(groups)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, groups.id),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    ownerId: r.ownerId,
    createdAt: r.createdAt,
    role: r.role as "owner" | "member",
  };
}

export type GroupMemberView = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: Date;
};

export async function listGroupMembers(
  groupId: string,
  userId: string,
): Promise<GroupMemberView[]> {
  const rows = await db
    .select({
      userId: groupMembers.userId,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(profiles, eq(profiles.id, groupMembers.userId))
    // Membership gate folded into the query (one round-trip instead of a
    // separate isMember check): a non-member matches zero rows via the
    // EXISTS, so callers still get [] without being able to list a group
    // they don't belong to.
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        sql`EXISTS (SELECT 1 FROM ${groupMembers} me
                     WHERE me.group_id = ${groupId} AND me.user_id = ${userId})`,
      ),
    )
    // Owners first, then alphabetical by display name.
    .orderBy(desc(groupMembers.role), asc(profiles.displayName));
  return rows.map((r) => ({
    ...r,
    role: r.role as "owner" | "member",
  }));
}

export async function createGroup(
  name: string,
  userId: string,
): Promise<Result<{ id: string }>> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return err("Nazwa nie może być pusta.");
  if (trimmed.length > 80) return err("Nazwa za długa (max 80 znaków).");

  const [g] = await db
    .insert(groups)
    .values({ name: trimmed, ownerId: userId })
    .returning({ id: groups.id });
  await db.insert(groupMembers).values({
    groupId: g.id,
    userId,
    role: "owner",
  });
  return ok({ id: g.id });
}

export async function renameGroup(
  groupId: string,
  name: string,
  userId: string,
): Promise<Result<null>> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return err("Nazwa nie może być pusta.");
  if (trimmed.length > 80) return err("Nazwa za długa (max 80 znaków).");

  const role = await getRole(groupId, userId);
  if (role !== "owner") return err("Tylko właściciel może zmienić nazwę.");

  await db.update(groups).set({ name: trimmed }).where(eq(groups.id, groupId));
  return ok(null);
}

/**
 * Remove yourself from a group. Owners can't leave while members remain;
 * they'd orphan the rest. The UI steers them to remove members or
 * transfer ownership first (not yet a feature, so block for now).
 */
export async function leaveGroup(
  groupId: string,
  userId: string,
): Promise<Result<null>> {
  const role = await getRole(groupId, userId);
  if (role === null) return err("Nie jesteś członkiem tej grupy.");
  if (role === "owner") {
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    if (Number(cnt) > 1) {
      return err("Właściciel nie może opuścić grupy, dopóki są w niej inni członkowie.");
    }
  }
  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  return ok(null);
}

/** Remove another user from a group. Only owners; they can't remove themselves. */
export async function removeMember(
  groupId: string,
  targetUserId: string,
  actorId: string,
): Promise<Result<null>> {
  if (targetUserId === actorId) {
    return err("Użyj „Opuść grupę”, żeby usunąć siebie.");
  }
  const actorRole = await getRole(groupId, actorId);
  if (actorRole !== "owner") return err("Tylko właściciel może usuwać członków.");

  const [removed] = await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId),
        // Belt-and-suspenders: never allow deleting another owner through this path.
        ne(groupMembers.role, "owner"),
      ),
    )
    .returning({ userId: groupMembers.userId });
  if (!removed) return err("Nie można usunąć tego członka.");
  return ok(null);
}
