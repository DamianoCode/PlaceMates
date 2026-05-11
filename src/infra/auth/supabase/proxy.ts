import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

/**
 * Session refresh + auth gate for Next.js Proxy (formerly Middleware).
 * Refreshes Supabase tokens on every request and blocks unauthenticated
 * access to protected paths.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anon } = supabaseEnv();

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do NOT run logic between createServerClient and getUser — token refresh
  // happens as a side effect of getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/auth") ||
    path.startsWith("/share") ||
    path.startsWith("/join") ||
    // Password recovery flow — both pages must be reachable without
    // a session. `/forgot-password` jest entry point (zapomniałeś
    // hasła, NIE jesteś zalogowany), a `/reset-password` ląduje
    // tam user z maila (sesja niby ustawiona przez /auth/callback,
    // ale gdy link wygasł albo user wszedł ręcznie — strona sama
    // obsługuje brak sesji friendly toastem).
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path === "/";

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  return response;
}
