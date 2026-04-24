"use server";

import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { bootstrapProfileAndGroup } from "@/domain/auth/bootstrap";
import { LoginInput, RegisterInput } from "@/lib/validation/auth";

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
