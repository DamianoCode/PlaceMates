/**
 * fetch() with a hard timeout, for external geocoder / POI providers.
 *
 * Why this exists: the public OSM endpoints (Nominatim, Photon, Overpass)
 * and Geoapify can hang indefinitely on a congested mirror or a flaky
 * mobile connection. A bare fetch() then blocks forever — and because
 * `createStack` only falls through to the next provider on a *throw*
 * (not on a hang), a single stuck Photon request wedges the entire
 * geocoder stack and the user stares at a spinner that never resolves.
 *
 * AbortController turns a hang into an AbortError after `ms`, so the
 * stack moves on to the next provider (or the Overpass mirror loop
 * tries the next endpoint) and the user gets a result instead of a
 * dead UI.
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  ms = 6000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
