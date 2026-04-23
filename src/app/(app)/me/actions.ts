"use server";

import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import { createInvite } from "@/domain/groups/invites";

export type InviteState =
  | { error: string }
  | { ok: true; token: string; expiresAt: string }
  | null;

export async function createInviteAction(
  _: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const groupId = formData.get("groupId") as string | null;
  if (!groupId) return { error: "Wybierz grupę." };

  const result = await createInvite(groupId, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath("/me");
  return {
    ok: true,
    token: result.data.token,
    expiresAt: result.data.expiresAt.toISOString(),
  };
}
