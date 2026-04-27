import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/infra/auth";
import { overpassNearbyByCategory } from "@/infra/geocoder/overpass";
import {
  PIN_DROP_NEARBY_LIMIT,
  PIN_DROP_NEARBY_RADIUS_M,
} from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * "Did you mean…?" candidates after a pin-drop. The form fires this
 * once the user has both a point and a category, then offers to link
 * the new place to an existing OSM POI — avoids spawning a fresh local
 * canonical when the spot already exists in OSM.
 */
export async function GET(req: NextRequest) {
  const user = await (await getAuth()).getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const category = sp.get("category") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !category) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "invalid coords" }, { status: 400 });
  }

  const results = await overpassNearbyByCategory(
    category,
    lat,
    lng,
    PIN_DROP_NEARBY_RADIUS_M,
    { limit: PIN_DROP_NEARBY_LIMIT },
  );
  return NextResponse.json({ results });
}
