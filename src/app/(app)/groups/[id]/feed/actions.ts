"use server";

import { getAuth } from "@/infra/auth";
import { getGroupForUser } from "@/domain/groups/service";
import {
  listActivityForGroup,
  type ActivityCursor,
  type ActivityPage,
} from "@/domain/activity/service";

/**
 * Fetch the next page of a group's activity feed. Authenticated +
 * membership-gated like any read on the group surface — an empty page is
 * returned (rather than throwing) when the caller isn't allowed, so the
 * client just stops paginating.
 */
export async function loadMoreActivityAction(
  groupId: string,
  cursor: ActivityCursor,
): Promise<ActivityPage> {
  const user = await (await getAuth()).getUser();
  if (!user) return { items: [], nextCursor: null };

  const group = await getGroupForUser(groupId, user.id);
  if (!group) return { items: [], nextCursor: null };

  return listActivityForGroup(groupId, { cursor });
}
