import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/**
 * Supabase client for Server Components / Route Handlers / Server Actions.
 * Each call reads the current request's cookies via next/headers.
 */
export async function createSupabaseServer() {
  const { url, anon } = supabaseEnv();
  const store = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Component context — cookies are read-only here.
          // Token refresh happens in proxy.ts instead; safe to ignore.
        }
      },
    },
  });
}
