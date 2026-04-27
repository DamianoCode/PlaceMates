import { NextResponse } from "next/server";
import { getAuth } from "@/infra/auth";
import { getPlacePreview } from "@/domain/places/preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await (await getAuth()).getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  try {
    const preview = await getPlacePreview(id, user.id);
    if (!preview) {
      console.warn("[preview] not found", { placeId: id, userId: user.id });
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(preview);
  } catch (err) {
    console.error("[preview] failed", { placeId: id, userId: user.id, err });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
