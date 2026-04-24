import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/infra/auth/supabase/server";
import { bootstrapProfileAndGroup } from "@/domain/auth/bootstrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * OAuth callback. Supabase redirects here after the provider
 * (currently: Google) has authenticated the user.
 *
 * 1. Exchange the `code` query param for a session cookie.
 * 2. Bootstrap the user's profile + personal group (idempotent, so
 *    returning Google users are a no-op).
 * 3. Redirect to `next` (honoured for /join/<token> invite links).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDesc = url.searchParams.get("error_description");
  const rawNext = url.searchParams.get("next") ?? "/map";
  // Prevent open-redirect abuse — only same-origin paths allowed.
  const next = rawNext.startsWith("/") ? rawNext : "/map";

  // Google / Supabase can redirect back with ?error=... (e.g. access_denied).
  // Surface it verbatim so the login page can render a human message.
  if (oauthError) {
    console.error("[auth/callback] provider error:", oauthError, oauthErrorDesc);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(oauthError)}`, url.origin),
    );
  }

  if (!code) {
    console.error("[auth/callback] missing code; query:", url.search);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("oauth_missing_code")}`, url.origin),
    );
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth/callback] exchange failed:", error);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error?.message ?? "oauth_failed")}`,
        url.origin,
      ),
    );
  }

  const u = data.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.display_name === "string" && meta.display_name) ||
    (u.email ?? "").split("@")[0] ||
    "user";
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  await bootstrapProfileAndGroup({
    id: u.id,
    displayName: String(displayName),
    avatarUrl: avatarUrl ? String(avatarUrl) : null,
  });

  return NextResponse.redirect(new URL(next, url.origin));
}
