import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/infra/auth";
import { overpassSearchByCategory } from "@/infra/geocoder/overpass";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cap bbox size so overly large requests (whole countries) don't hammer
// the public Overpass mirrors. 1° lat ≈ 111 km, so 0.6° keeps us within
// a reasonable city-region.
const MAX_BBOX_SPAN = 0.6;

export async function GET(req: NextRequest) {
  const user = await (await getAuth()).getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const categorySlug = sp.get("category") ?? "";
  const bboxRaw = sp.get("bbox"); // "west,south,east,north"
  if (!bboxRaw) return NextResponse.json({ error: "missing bbox" }, { status: 400 });
  const [west, south, east, north] = bboxRaw.split(",").map(Number);
  if ([west, south, east, north].some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: "invalid bbox" }, { status: 400 });
  }
  if (east - west > MAX_BBOX_SPAN || north - south > MAX_BBOX_SPAN) {
    return NextResponse.json({ error: "bbox too large" }, { status: 400 });
  }

  const results = await overpassSearchByCategory(
    categorySlug,
    { west, south, east, north },
    { limit: 80 },
  );
  return NextResponse.json({ results });
}
