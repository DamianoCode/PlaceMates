import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/infra/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Keep-warm / health endpoint. Hit this from a free external cron pinger
 * (cron-job.org, UptimeRobot) every ~5 min so the Vercel function and the
 * Supabase connection stay warm — the next real navigation skips the cold
 * start. A trivial `SELECT 1` opens/keeps the pooled DB connection, which
 * is the slow part of a cold request.
 *
 * Public by default (it exposes nothing). Set CRON_SECRET in the env to
 * lock it down — then the pinger must send `?key=<secret>` (or an
 * `x-cron-key` header). Unauthenticated hits get 401 without touching the
 * DB, so a stray bot can't run up usage.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.nextUrl.searchParams.get("key") ?? req.headers.get("x-cron-key");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    // Swallow: a warm ping shouldn't 500 on a transient DB hiccup. We
    // report db:false so the monitor can still surface a real outage.
  }

  return NextResponse.json(
    { ok: true, db: dbOk },
    { headers: { "cache-control": "no-store" } },
  );
}
