import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupInvites, groupMembers } from "@/infra/db/schema";
import { err, ok, type Result } from "../result";

const INVITE_TTL_DAYS = 14;

function generateToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function createInvite(
  groupId: string,
  userId: string,
): Promise<Result<{ token: string; expiresAt: Date }>> {
  const [member] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!member) return err("Nie należysz do tej grupy.");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(groupInvites).values({
    token,
    groupId,
    createdBy: userId,
    expiresAt,
  });
  return ok({ token, expiresAt });
}

export async function acceptInvite(
  token: string,
  userId: string,
): Promise<Result<{ groupId: string }>> {
  const [invite] = await db
    .select()
    .from(groupInvites)
    .where(eq(groupInvites.token, token))
    .limit(1);
  if (!invite) return err("Zaproszenie nie istnieje.");
  if (invite.usedAt) return err("Zaproszenie już wykorzystane.");
  if (invite.expiresAt.getTime() < Date.now()) return err("Zaproszenie wygasło.");

  // Add as member (idempotent).
  await db
    .insert(groupMembers)
    .values({ groupId: invite.groupId, userId, role: "member" })
    .onConflictDoNothing();

  await db
    .update(groupInvites)
    .set({ usedAt: new Date() })
    .where(eq(groupInvites.token, token));

  return ok({ groupId: invite.groupId });
}
