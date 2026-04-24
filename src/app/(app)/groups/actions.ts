"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import {
  createGroup,
  leaveGroup,
  removeMember,
  renameGroup,
} from "@/domain/groups/service";

type State<T extends object = object> =
  | { error: string }
  | ({ ok: true } & T)
  | null;

export type CreateGroupState = State<{ id: string }>;

export async function createGroupAction(
  _: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };
  const name = (formData.get("name") as string | null) ?? "";

  const result = await createGroup(name, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath("/me");
  revalidatePath("/map");
  redirect(`/groups/${result.data.id}`);
}

export type RenameGroupState = State;

export async function renameGroupAction(
  _: RenameGroupState,
  formData: FormData,
): Promise<RenameGroupState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };
  const groupId = formData.get("groupId") as string | null;
  const name = (formData.get("name") as string | null) ?? "";
  if (!groupId) return { error: "Brak grupy." };

  const result = await renameGroup(groupId, name, user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/me");
  return { ok: true };
}

export type LeaveGroupState = State;

export async function leaveGroupAction(
  _: LeaveGroupState,
  formData: FormData,
): Promise<LeaveGroupState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };
  const groupId = formData.get("groupId") as string | null;
  if (!groupId) return { error: "Brak grupy." };

  const result = await leaveGroup(groupId, user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath("/me");
  redirect("/me");
}

export type RemoveMemberState = State;

export async function removeMemberAction(
  _: RemoveMemberState,
  formData: FormData,
): Promise<RemoveMemberState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };
  const groupId = formData.get("groupId") as string | null;
  const targetUserId = formData.get("targetUserId") as string | null;
  if (!groupId || !targetUserId) return { error: "Brak danych." };

  const result = await removeMember(groupId, targetUserId, user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}
