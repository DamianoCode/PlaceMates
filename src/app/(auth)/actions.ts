"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";
import { db } from "@/infra/db/client";
import { groupMembers, groups, profiles } from "@/infra/db/schema";
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

export async function registerAction(_: FormState, formData: FormData): Promise<FormState> {
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

  // Bootstrap: ensure profile row exists, then create a default personal
  // group and add the user as owner. The auth.users -> profiles trigger
  // normally handles the profile row, but we upsert here to be safe on
  // setups without the trigger (local dev without Supabase auth schema).
  const user = result.user;
  await db
    .insert(profiles)
    .values({ id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl })
    .onConflictDoNothing();

  const existing = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.ownerId, user.id))
    .limit(1);

  if (existing.length === 0) {
    const [g] = await db
      .insert(groups)
      .values({ name: "Moja", ownerId: user.id })
      .returning({ id: groups.id });
    await db.insert(groupMembers).values({
      groupId: g.id,
      userId: user.id,
      role: "owner",
    });
  }

  redirect("/map");
}

export async function signOutAction() {
  const auth = await getAuth();
  await auth.signOut();
  redirect("/login");
}
