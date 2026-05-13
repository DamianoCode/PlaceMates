import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/infra/auth";
import { getOrComputeRoute } from "@/domain/trips/routing";
import { isRoutingProfile } from "@/infra/routing/ors";

/**
 * GET /api/trips/[id]/route?profile=driving-car
 *
 * Returns a routed LineString geometry + distance/duration for the
 * trip's ordered stops, hitting cache when fresh and ORS otherwise.
 * Returns `{ ok: false, reason }` when the trip has <2 stops, ORS
 * is unreachable, or the user can't access the trip — client falls
 * back to a straight-line polyline in those cases.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await (await getAuth()).getUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  // UUID v4/v7 length+format sanity check — without it a stale
  // client (HMR mid-edit, prop chain glitch) can request
  // /api/trips/undefined/route and trigger a Postgres "invalid
  // input syntax for type uuid" 500 instead of a clean 400.
  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, reason: "invalid_trip_id" },
      { status: 400 },
    );
  }

  const raw = req.nextUrl.searchParams.get("profile") ?? "driving-car";
  if (!isRoutingProfile(raw)) {
    return NextResponse.json(
      { ok: false, reason: "invalid_profile" },
      { status: 400 },
    );
  }
  const profile = raw;

  const route = await getOrComputeRoute(id, profile, user.id);
  if (!route) {
    return NextResponse.json({ ok: false, reason: "no_route" });
  }

  return NextResponse.json({
    ok: true,
    geometry: route.geometry,
    distanceM: route.distanceM,
    durationS: route.durationS,
    segments: route.segments,
  });
}

/** Loose UUID format check — accepts any 8-4-4-4-12 hex layout
 *  regardless of version digit. Cheap, no regex pre-compile cost
 *  worth abstracting. */
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
