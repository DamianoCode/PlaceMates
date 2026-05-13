import "server-only";

/**
 * OpenRouteService Directions API client.
 *
 * Why ORS over alternatives:
 *   - 2000 req/day free tier — comfortable for our scale even
 *     without cache hits (typical group will do <100/day after
 *     cache warm-up)
 *   - 4 walking + biking profile variants → matches the trip use
 *     cases (city weekend, mountain hike, etc.)
 *   - No basemap restrictions (Mapbox/Google force their tiles)
 *   - University-hosted (HeiGIT Heidelberg) — won't disappear
 *     overnight like a SaaS startup
 *
 * Sign up: https://openrouteservice.org → key into ORS_API_KEY
 * env var (server-only — no NEXT_PUBLIC_ prefix, never exposed
 * to client).
 *
 * Soft-fails when key missing — routing pages fall back to
 * straight-line polyline (visible but not road-following). Same
 * posture as Sentry / Web Push.
 */

export type RoutingProfile =
  | "driving-car"
  | "cycling-regular"
  | "foot-walking"
  | "foot-hiking";

export type RouteSegment = {
  distanceM: number;
  durationS: number;
};

export type RouteResult = {
  geometry: GeoJSON.LineString;
  distanceM: number;
  durationS: number;
  /** Per-stop-pair legs. segments[i] = route from stop i to i+1.
   *  Length always equals stops.length - 1 when present. */
  segments: RouteSegment[];
};

const ORS_BASE = "https://api.openrouteservice.org/v2/directions";

/** Hard cap na czas oczekiwania na odpowiedź ORS. Bez tego Node
 *  domyślnie czeka ~100 s — pojedynczy zawieszony request blokuje
 *  rendering trasy długo po tym jak user już przerzucił widok. 8 s
 *  to kompromis: ORS odpowiada normalnie w <2 s, więc to tylko
 *  guard na patologiczne przypadki (network blip, ORS degradacja).
 *  Po timeoucie wracamy null → fallback do prostej linii. */
const ORS_TIMEOUT_MS = 8_000;

export async function callORS(
  profile: RoutingProfile,
  coords: Array<[number, number]>,
): Promise<RouteResult | null> {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    // No key → no route. Caller falls back to straight-line.
    if (process.env.NODE_ENV !== "test") {
      console.warn("[routing] ORS_API_KEY not set");
    }
    return null;
  }
  if (coords.length < 2) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ORS_TIMEOUT_MS);

  try {
    const res = await fetch(`${ORS_BASE}/${profile}/geojson`, {
      method: "POST",
      headers: {
        Authorization: key,
        // `application/geo+json` jest content-typem zwracanym przez
        // /geojson endpoint. Wcześniej wysyłaliśmy tylko
        // `application/json` co ORS odrzucał z 406
        // "OUTPUT_FORMAT_NOT_SUPPORTED" (code 2007) — endpoint
        // serwuje geo+json ale my deklarujemy że nie akceptujemy.
        Accept: "application/geo+json, application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ coordinates: coords }),
      // Always fresh — cache lives at our DB layer, not in fetch
      // cache where we couldn't invalidate it from server actions.
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[routing] ORS ${profile} ${res.status}:`, text.slice(0, 200));
      return null;
    }

    const data = (await res.json()) as {
      features?: Array<{
        geometry: GeoJSON.LineString;
        properties: {
          summary: { distance: number; duration: number };
          segments?: Array<{
            distance: number;
            duration: number;
          }>;
        };
      }>;
    };

    const feature = data.features?.[0];
    if (!feature?.geometry || !feature.properties?.summary) return null;

    // ORS returns one segment per stop-pair (legs[i] = stop i → i+1).
    // Map to our shape with rounded ints — millisecond precision
    // doesn't matter for "8 min" display.
    const segments: RouteSegment[] = (
      feature.properties.segments ?? []
    ).map((s) => ({
      distanceM: Math.round(s.distance),
      durationS: Math.round(s.duration),
    }));

    return {
      geometry: feature.geometry,
      distanceM: Math.round(feature.properties.summary.distance),
      durationS: Math.round(feature.properties.summary.duration),
      segments,
    };
  } catch (err) {
    // Network down, DNS, abort (timeout) — log and fall back. Abort
    // ma własną nazwę żebyśmy łatwo poznali timeout vs prawdziwy
    // network error w logach.
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[routing] ORS ${profile} timeout (${ORS_TIMEOUT_MS}ms)`);
    } else {
      console.error("[routing] ORS request failed", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
