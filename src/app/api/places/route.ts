import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/infra/auth";
import { listPlacesForUser } from "@/domain/places/service";
import { BBox } from "@/lib/validation/place";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await (await getAuth()).getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const bboxParam = req.nextUrl.searchParams.get("bbox");
  let bbox = undefined;
  if (bboxParam) {
    const parts = bboxParam.split(",").map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) {
      return NextResponse.json({ error: "invalid bbox" }, { status: 400 });
    }
    const [west, south, east, north] = parts;
    const parsed = BBox.safeParse({ west, south, east, north });
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid bbox" }, { status: 400 });
    }
    bbox = parsed.data;
  }

  const markers = await listPlacesForUser(user.id, bbox);
  return NextResponse.json({ places: markers });
}
