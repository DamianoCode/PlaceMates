import type { NextRequest } from "next/server";
import { updateSession } from "@/infra/auth/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
