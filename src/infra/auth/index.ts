import { cache } from "react";
import { createSupabaseServer } from "./supabase/server";
import { createSupabaseAuthProvider } from "./supabase/provider";
import type { AuthProvider, AuthUser } from "./provider";

export type { AuthProvider, AuthUser, SignInResult } from "./provider";

/** Server-side auth provider bound to the current request's cookies. */
export async function getAuth(): Promise<AuthProvider> {
  const client = await createSupabaseServer();
  return createSupabaseAuthProvider(client);
}

/**
 * Current authenticated user, memoized for the duration of a single
 * server render via React `cache()`. The layout and the page both need
 * the user, and `getUser()` is a Supabase auth round-trip each call —
 * deduping it means one validation per request instead of N. Safe to
 * cache: the user can't change mid-render. Prefer this over
 * `getAuth().getUser()` in Server Components on the render path.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  return (await getAuth()).getUser();
});
