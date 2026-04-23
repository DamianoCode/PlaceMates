import { and, eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, groups } from "@/infra/db/schema";

export type UserGroup = {
  id: string;
  name: string;
  role: "owner" | "member";
};

/** All groups the user belongs to. First entry is a safe default group. */
export async function listUserGroups(userId: string): Promise<UserGroup[]> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId));
  return rows as UserGroup[];
}

export async function isMember(groupId: string, userId: string): Promise<boolean> {
  const r = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return r.length > 0;
}
