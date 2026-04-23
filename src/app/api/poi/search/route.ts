import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/infra/auth";
import { getPoiSearch } from "@/infra/geocoder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Minimal in-memory cache so bursts from a picker don't hit Nominatim.
// Keyed by query; 60s TTL, fine for fair-use.
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 60_000;

export async function GET(req: NextRequest) {
  const user = await (await getAuth()).getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  const results = await getPoiSearch().search(q, 10);
  const body = { results };
  cache.set(q, { at: Date.now(), data: body });
  return NextResponse.json(body);
}
