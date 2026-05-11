"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { bootstrapProfileAndGroup } from "@/domain/auth/bootstrap";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/lib/validation/auth";

export type FormState = { error: string } | { ok: true } | null;

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Niepoprawny e-mail lub hasło (min. 8 znaków)." };
  }

  const auth = await getAuth();
  const result = await auth.signInWithPassword(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };

  const next = (formData.get("next") as string | null) ?? "/map";
  redirect(next);
}

export async function registerAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  // Honeypot: hidden field bots blindly fill. Humans leave it empty.
  // Returns a generic error so we don't help the bot tune its form-filler.
  if ((formData.get("company_website") as string | null)?.trim()) {
    return { error: "Niepoprawne dane rejestracji." };
  }

  const parsed = RegisterInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: "Uzupełnij pola poprawnie (hasło ≥ 8 znaków)." };
  }

  const auth = await getAuth();
  const result = await auth.signUpWithPassword(
    parsed.data.email,
    parsed.data.password,
    parsed.data.displayName,
  );
  if (!result.ok) return { error: result.error };

  await bootstrapProfileAndGroup({
    id: result.user.id,
    displayName: result.user.displayName,
    avatarUrl: result.user.avatarUrl,
  });

  // Honour `next` so users landing on the register page from a group
  // invite end up back at /join/<token> right after signup.
  const next = (formData.get("next") as string | null)?.trim();
  redirect(next && next.startsWith("/") ? next : "/map");
}

export async function signOutAction() {
  const auth = await getAuth();
  await auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = ForgotPasswordInput.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: "Niepoprawny e-mail." };
  }

  // Build redirect URL — the magic link in the email lands on
  // /auth/callback which exchanges the code and forwards to `next`.
  // `origin` from the request header so we work on prod + preview
  // deployments without hard-coding the domain.
  const reqHeaders = await headers();
  const origin =
    reqHeaders.get("origin") ??
    (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const redirectTo = `${origin}/auth/callback?next=/reset-password`;

  const auth = await getAuth();
  await auth.requestPasswordReset(parsed.data.email, redirectTo);
  // Always return ok — see provider impl for why (anti-enumeration).
  return { ok: true };
}

export async function resetPasswordAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = ResetPasswordInput.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Hasło musi mieć min. 8 znaków i powtórzenie musi się zgadzać.",
    };
  }

  const auth = await getAuth();
  // Session is set by the magic-link callback before we get here.
  // updateUser({password}) uses the active session — no need for
  // current password verification, the recent magic-link auth is
  // proof enough.
  const result = await auth.updatePassword(parsed.data.password);
  if (!result.ok) return { error: result.error };

  redirect("/map");
}
