import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/infra/auth";
import { overpassSearchByCategories } from "@/infra/geocoder/overpass";
import { geoapifyPlacesByCategories } from "@/infra/geocoder/geoapify-places";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cap bbox size so overly large requests (whole countries) don't hammer
// the public Overpass mirrors. 1° lat ≈ 111 km, so 0.6° keeps us within
// a reasonable city-region.
const MAX_BBOX_SPAN = 0.6;

// How many POIs to pull per nearby search. Geoapify returns results in
// no particular importance order, so a low cap silently truncates sparse
// landmarks (a single famous church) behind dense ones (cafés). 300
// covers a dense city-centre viewport's worth of sights without
// truncation while keeping the payload bounded.
const NEARBY_RESULT_LIMIT = 300;

/**
 * "Nearby places" lookup. Accepts one or more category slugs (legacy
 * `category=` single, plus new `categories=` comma-list). When
 * GEOAPIFY_API_KEY is present we hit Geoapify Places first — it has
 * a richer POI feed in EU small cities than raw OSM. If Geoapify
 * returns nothing or isn't configured, we fall back to Overpass.
 */
export async function GET(req: NextRequest) {
  const user = await (await getAuth()).getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;

  // Accept both shapes:
  //   ?category=cafe          (legacy, single)
  //   ?categories=cafe,bakery (multi)
  const single = sp.get("category");
  const multi = sp.get("categories");
  const categories = (multi ?? single ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (categories.length === 0) {
    return NextResponse.json({ error: "missing category" }, { status: 400 });
  }

  const bboxRaw = sp.get("bbox"); // "west,south,east,north"
  if (!bboxRaw) return NextResponse.json({ error: "missing bbox" }, { status: 400 });
  const [west, south, east, north] = bboxRaw.split(",").map(Number);
  if ([west, south, east, north].some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: "invalid bbox" }, { status: 400 });
  }
  if (east - west > MAX_BBOX_SPAN || north - south > MAX_BBOX_SPAN) {
    return NextResponse.json({ error: "bbox too large" }, { status: 400 });
  }
  const bbox = { west, south, east, north };

  // Geoapify first when configured. Empty array (no hits, no key, or
  // upstream error) drops us into the Overpass fallback so the user
  // never sees a blank panel just because one provider had a bad day.
  const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  if (geoapifyKey) {
    const hits = await geoapifyPlacesByCategories(
      geoapifyKey,
      categories,
      bbox,
      NEARBY_RESULT_LIMIT,
    );
    if (hits.length > 0) {
      return NextResponse.json({
        results: hits.map((h) => ({
          provider: h.provider,
          externalId: h.externalId,
          osmId: h.osmId, // empty for geoapify, kept for type parity
          name: h.name,
          address: h.address,
          lat: h.lat,
          lng: h.lng,
          categoryHint: h.categoryHint,
        })),
      });
    }
  }

  // Overpass fallback. Normalise to the same wire-shape so the client
  // never has to branch on provider when rendering or importing.
  const overpassResults = await overpassSearchByCategories(categories, bbox, {
    limit: NEARBY_RESULT_LIMIT,
  });
  return NextResponse.json({
    results: overpassResults.map((r) => ({
      provider: "osm" as const,
      externalId: r.osmId,
      osmId: r.osmId,
      name: r.name,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      categoryHint: r.categoryHint,
    })),
  });
}
