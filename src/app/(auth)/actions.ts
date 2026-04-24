"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "@/infra/auth";
import { createSupabaseServer } from "@/infra/auth/supabase/server";
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

export type MagicLinkState =
  | { error: string }
  | { ok: true; email: string }
  | null;

const MagicLinkInput = z.object({
  email: z.string().email().max(200),
  next: z.string().optional(),
});

/**
 * Send a one-tap login link by email. Bypasses the WebView OAuth issue
 * entirely — the user clicks the link in their Mail app, which opens
 * it in the system browser where OAuth would also work.
 *
 * Supabase's OTP endpoint is rate-limited per-email/per-IP so we
 * don't need to add our own guard.
 */
export async function sendMagicLinkAction(
  _: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  // Same honeypot as registration — bots scrape any email form.
  if ((formData.get("company_website") as string | null)?.trim()) {
    return { error: "Niepoprawne dane." };
  }

  const parsed = MagicLinkInput.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Niepoprawny e-mail." };

  const next =
    parsed.data.next && parsed.data.next.startsWith("/")
      ? parsed.data.next
      : "/map";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = new URL("/auth/callback", baseUrl);
  redirectTo.searchParams.set("next", next);

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: redirectTo.toString(),
      // Allow OTP signup too — with invite flows this lets friends
      // bootstrap a fresh account just by clicking the email link.
      shouldCreateUser: true,
    },
  });
  if (error) return { error: error.message };

  return { ok: true, email: parsed.data.email };
}
