import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/infra/auth";
import { listPlacesWithStats } from "@/domain/places/list-with-stats";
import {
  filterStateToOptions,
  parsePlacesSearch,
} from "@/lib/places/list-params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Client-side data source for the places list. The page server-renders
 * the initial view; subsequent filter/sort/search changes refetch
 * through here so TanStack Query can cache results — re-applying a
 * filter or going back/forward is then instant instead of a full RSC
 * round-trip. Filtering stays server-side (single source of truth in
 * `listPlacesWithStats`), the client just caches what it gets.
 */
export async function GET(req: NextRequest) {
  const user = await (await getAuth()).getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const state = parsePlacesSearch({
    q: sp.get("q") ?? undefined,
    set: sp.get("set") ?? undefined,
    category: sp.get("category") ?? undefined,
    group: sp.get("group") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    dir: sp.get("dir") ?? undefined,
  });

  const places = await listPlacesWithStats(
    user.id,
    filterStateToOptions(state),
  );
  return NextResponse.json({ places });
}
