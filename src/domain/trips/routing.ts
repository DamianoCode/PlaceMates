import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { tripRoutes } from "@/infra/db/schema";
import {
  callORS,
  type RouteResult,
  type RoutingProfile,
} from "@/infra/routing/ors";
import { getTripForUser } from "./service";

/**
 * Cached routing for a trip. Three concerns layered:
 *
 *   1. Cache hit — return the stored geometry immediately. No
 *      auth check needed here because cache rows are FK-cascaded
 *      from trips (which we don't delete on access). Auth happens
 *      at write-path via getTripForUser.
 *   2. Cache miss / stale — call ORS, upsert the result.
 *   3. ORS unreachable — return null; caller renders the legacy
 *      straight-line polyline.
 *
 * The 7-day TTL is a safety net for invalidation gaps (e.g.,
 * editing a place's location via /places/[id]/edit doesn't yet
 * notify any trips containing that place). For the active
 * mutation paths (reorder / add / remove), we delete cache rows
 * explicitly via `invalidateTripRoutes`.
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getOrComputeRoute(
  tripId: string,
  profile: RoutingProfile,
  userId: string,
): Promise<RouteResult | null> {
  // Cache lookup first.
  const [cached] = await db
    .select()
    .from(tripRoutes)
    .where(and(eq(tripRoutes.tripId, tripId), eq(tripRoutes.profile, profile)))
    .limit(1);

  if (cached) {
    const ageMs = Date.now() - cached.computedAt.getTime();
    if (ageMs < CACHE_TTL_MS) {
      return {
        geometry: cached.geometry,
        distanceM: cached.distanceM,
        durationS: cached.durationS,
        segments: cached.segments,
      };
    }
    // Stale → fall through to recompute. We don't delete here;
    // the upsert below replaces it. If ORS fails we keep serving
    // the stale row from the next call (better than nothing).
  }

  // Cache miss → fetch trip + verify access.
  const trip = await getTripForUser(tripId, userId);
  if (!trip) return null;
  if (trip.stops.length < 2) return null;

  // Stops come pre-sorted by sortOrder from getTripForUser,
  // but defensive re-sort doesn't hurt and protects against
  // future query changes.
  const sorted = [...trip.stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const coords: Array<[number, number]> = sorted.map((s) => [
    s.placeLng,
    s.placeLat,
  ]);

  const result = await callORS(profile, coords);
  if (!result) {
    // ORS unreachable — if we have a stale cached row, surface
    // it; otherwise null and let the client fall back.
    if (cached) {
      return {
        geometry: cached.geometry,
        distanceM: cached.distanceM,
        durationS: cached.durationS,
        segments: cached.segments,
      };
    }
    return null;
  }

  // Upsert into cache.
  await db
    .insert(tripRoutes)
    .values({
      tripId,
      profile,
      geometry: result.geometry,
      distanceM: result.distanceM,
      durationS: result.durationS,
      segments: result.segments,
    })
    .onConflictDoUpdate({
      target: [tripRoutes.tripId, tripRoutes.profile],
      set: {
        geometry: result.geometry,
        distanceM: result.distanceM,
        durationS: result.durationS,
        segments: result.segments,
        computedAt: new Date(),
      },
    });

  return result;
}

/** Drop all cached routes for a trip. Called from mutation paths
 *  (reorder, add stop, remove stop) so the next render fetches
 *  a fresh route from ORS. */
export async function invalidateTripRoutes(tripId: string): Promise<void> {
  await db.delete(tripRoutes).where(eq(tripRoutes.tripId, tripId));
}
