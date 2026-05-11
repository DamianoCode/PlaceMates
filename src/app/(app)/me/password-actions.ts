"use server";

import { getAuth } from "@/infra/auth";
import { ChangePasswordInput } from "@/lib/validation/auth";

export type ChangePasswordState =
  | { error: string }
  | { ok: true }
  | null;

/**
 * Change password for the currently-authenticated user. Two-step:
 *
 *   1. Re-verify current password by attempting signInWithPassword.
 *      Supabase's `updateUser({password})` works on an active session
 *      WITHOUT verifying current — that's a footgun (anyone who
 *      borrows a logged-in phone could change the password). We add
 *      our own verification by signing in again.
 *   2. updateUser({password: newPassword}).
 *
 * The verify-step's sign-in refreshes the session as a side effect.
 * That's fine — we want the new session anyway, and any stale
 * tokens from before the password change naturally expire.
 */
export async function changePasswordAction(
  _: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = ChangePasswordInput.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Sprawdź pola — hasła muszą mieć ≥ 8 znaków i się zgadzać.",
    };
  }

  const auth = await getAuth();
  const me = await auth.getUser();
  if (!me) return { error: "Musisz być zalogowany." };

  // Verify current password by re-authenticating.
  const verify = await auth.signInWithPassword(
    me.email,
    parsed.data.currentPassword,
  );
  if (!verify.ok) {
    return { error: "Niepoprawne aktualne hasło." };
  }

  const update = await auth.updatePassword(parsed.data.newPassword);
  if (!update.ok) return { error: update.error };

  return { ok: true };
}
