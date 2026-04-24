"use server";

import { revalidatePath } from "next/cache";
import { getAuth } from "@/infra/auth";
import { clearAvatar, updateAvatar } from "@/domain/profile/service";

export type AvatarState = { error: string } | { ok: true } | null;

export async function uploadAvatarAction(
  _: AvatarState,
  formData: FormData,
): Promise<AvatarState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  const file = formData.get("avatar") as File | null;
  if (!file) return { error: "Wybierz plik." };

  const result = await updateAvatar(user.id, file);
  if (!result.ok) return { error: result.error };

  revalidatePath("/me");
  return { ok: true };
}

export async function removeAvatarAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: AvatarState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<AvatarState> {
  const user = await (await getAuth()).getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  await clearAvatar(user.id);
  revalidatePath("/me");
  return { ok: true };
}
