import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/infra/auth";
import { getOrComputeRoute } from "@/domain/trips/routing";
import type { RoutingProfile } from "@/infra/routing/ors";

/**
 * GET /api/trips/[id]/route?profile=driving-car
 *
 * Returns a routed LineString geometry + distance/duration for the
 * trip's ordered stops, hitting cache when fresh and ORS otherwise.
 * Returns `{ ok: false, reason }` when the trip has <2 stops, ORS
 * is unreachable, or the user can't access the trip — client falls
 * back to a straight-line polyline in those cases.
 */

const VALID_PROFILES: ReadonlyArray<RoutingProfile> = [
  "driving-car",
  "cycling-regular",
  "foot-walking",
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await (await getAuth()).getUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const raw = req.nextUrl.searchParams.get("profile") ?? "driving-car";
  if (!VALID_PROFILES.includes(raw as RoutingProfile)) {
    return NextResponse.json(
      { ok: false, reason: "invalid_profile" },
      { status: 400 },
    );
  }
  const profile = raw as RoutingProfile;

  const route = await getOrComputeRoute(id, profile, user.id);
  if (!route) {
    return NextResponse.json({ ok: false, reason: "no_route" });
  }

  return NextResponse.json({
    ok: true,
    geometry: route.geometry,
    distanceM: route.distanceM,
    durationS: route.durationS,
  });
}
