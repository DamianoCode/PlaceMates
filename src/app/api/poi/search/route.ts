import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/infra/auth";
import { getPoiSearch } from "@/infra/geocoder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Minimal in-memory cache so bursts from a picker don't hit upstreams.
// Key includes the bias bucket so two users in different cities don't
// share each other's biased results. 60s TTL, fine for fair-use.
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 60_000;

function parseCoord(raw: string | null, range: number): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > range) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const user = await (await getAuth()).getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const lat = parseCoord(sp.get("lat"), 90);
  const lng = parseCoord(sp.get("lng"), 180);
  const bias = lat !== null && lng !== null ? { lat, lng } : undefined;
  // Round bias to ~1km buckets (3 decimal places) so the cache key
  // doesn't fragment per-meter as the user pans the map.
  const biasKey = bias
    ? `${bias.lat.toFixed(3)},${bias.lng.toFixed(3)}`
    : "noprox";
  const cacheKey = `${q}|${biasKey}`;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  const results = await getPoiSearch().search(q, { limit: 10, bias });
  const body = { results };
  cache.set(cacheKey, { at: Date.now(), data: body });
  return NextResponse.json(body);
}
