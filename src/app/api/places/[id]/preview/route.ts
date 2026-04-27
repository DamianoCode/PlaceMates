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
  const preview = await getPlacePreview(id, user.id);
  if (!preview) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(preview);
}
