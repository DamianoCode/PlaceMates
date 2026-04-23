import { createSupabaseServer } from "./supabase/server";
import { createSupabaseAuthProvider } from "./supabase/provider";
import type { AuthProvider } from "./provider";

export type { AuthProvider, AuthUser, SignInResult } from "./provider";

/** Server-side auth provider bound to the current request's cookies. */
export async function getAuth(): Promise<AuthProvider> {
  const client = await createSupabaseServer();
  return createSupabaseAuthProvider(client);
}
