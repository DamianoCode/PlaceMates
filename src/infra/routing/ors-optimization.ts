import "server-only";

import type { RoutingProfile } from "./ors";

/**
 * OpenRouteService Optimization API (VROOM solver) client.
 *
 * Osobny moduł od `ors.ts` z kilku powodów:
 *   - Inny endpoint (`/optimization`), inny payload shape.
 *   - Inny dzienny limit free tiera (niższy — typowo 500/dzień vs
 *     2000/dzień dla directions, więc trzeba być oszczędniejszym).
 *   - Optymalizacja może trwać dłużej dla większych zestawów stopów
 *     (VROOM to solver TSP), dłuższy timeout uzasadniony.
 *
 * VROOM input:
 *   {
 *     jobs:     [{ id: 1, location: [lng, lat] }, …],
 *     vehicles: [{ id: 1, profile, start: [lng, lat] }]
 *   }
 *
 * VROOM output (interesujące pola):
 *   {
 *     code: 0 (ok) | 1+ (error),
 *     summary:  { distance, duration, cost },
 *     routes: [{
 *       vehicle: 1,
 *       distance, duration,
 *       steps: [
 *         { type: "start", location, … },
 *         { type: "job", id, location, … },
 *         …
 *         { type: "end" }  // tylko gdy podaliśmy vehicle.end
 *       ]
 *     }],
 *     unassigned: [{ id, location, … }]  // joby nie wciśnięte w trasę
 *   }
 *
 * Soft-fail jak w `ors.ts`: brak klucza / network down / non-2xx →
 * `null` i caller spada na wcześniejszą kolejność.
 */

export type OptimizationJob = {
  /** Integer ID, mapowany w callerze na właściwe (UUID) stop_id. */
  id: number;
  /** [lng, lat] — w tej kolejności, zgodnie z VROOM. */
  location: [number, number];
};

export type OptimizationResult = {
  /** Kolejność jobów (po `id`) w optymalnej trasie. NIE zawiera
   *  punktu startowego (`type: "start"`) — caller wie skąd zaczął. */
  orderedJobIds: number[];
  distanceM: number;
  durationS: number;
};

/** Dłuższy timeout niż dla directions: VROOM dla ~20-30 stopów może
 *  potrzebować kilku sekund. Wyższy bezpieczny pułap żeby nie
 *  wystrzelić timeoutu w typowym przypadku, a jednocześnie nie
 *  zawiesić requesta usera na długo gdy ORS lagguje. */
const OPTIMIZATION_TIMEOUT_MS = 12_000;

const ENDPOINT = "https://api.openrouteservice.org/optimization";

export async function callORSOptimization(
  profile: RoutingProfile,
  jobs: OptimizationJob[],
  vehicleStart: [number, number],
): Promise<OptimizationResult | null> {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[routing/optimize] ORS_API_KEY not set");
    }
    return null;
  }
  // VROOM wymaga co najmniej 1 joba; sensowna optymalizacja zaczyna
  // się od 2 jobów (1 job to trywialne "jedź tam"). Caller już
  // odsiewa za małe zestawy, ale defensywny check tutaj.
  if (jobs.length < 1) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    OPTIMIZATION_TIMEOUT_MS,
  );

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: key,
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        jobs,
        vehicles: [
          {
            id: 1,
            profile,
            start: vehicleStart,
          },
        ],
        // `g: true` (geometry) wymusza obliczenie pełnej trasy po
        // drogach — bez tego VROOM zwraca tylko macierz czasów
        // (`duration`), a `distance` przychodzi jako 0 i UI pokazuje
        // nonsensowne „Po optymalizacji: 0 m". Geometrii samej nie
        // używamy (po Apply leci osobny /directions call który
        // zapisuje świeży route do trip_routes cache), ale przy
        // okazji dostajemy poprawne distance.
        options: { g: true },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[routing/optimize] ORS ${profile} ${res.status}:`,
        text.slice(0, 200),
      );
      return null;
    }

    const data = (await res.json()) as {
      code?: number;
      summary?: { distance?: number; duration?: number };
      routes?: Array<{
        distance?: number;
        duration?: number;
        steps?: Array<{
          type: string;
          id?: number;
          location?: [number, number];
        }>;
      }>;
      unassigned?: Array<{ id: number }>;
    };

    // VROOM zwraca `code: 0` przy sukcesie. Wszystko inne to błąd
    // logiczny po stronie solvera (np. job poza zasięgiem profilu).
    if (data.code !== 0) {
      console.error(
        `[routing/optimize] VROOM code=${data.code} (non-zero = solver error)`,
      );
      return null;
    }

    // Jeśli VROOM nie wcisnął wszystkich jobów w trasę — nie możemy
    // zastosować częściowej optymalizacji, bo gubimy stopy. Lepiej
    // wrócić null i pokazać userowi "spróbuj inny profil".
    if (data.unassigned && data.unassigned.length > 0) {
      console.warn(
        `[routing/optimize] VROOM unassigned ${data.unassigned.length} job(s)`,
      );
      return null;
    }

    const route = data.routes?.[0];
    if (!route?.steps) return null;

    const orderedJobIds: number[] = [];
    for (const step of route.steps) {
      if (step.type === "job" && typeof step.id === "number") {
        orderedJobIds.push(step.id);
      }
    }
    if (orderedJobIds.length !== jobs.length) {
      // Defensywne: liczba jobów w wynikowej trasie musi się zgadzać
      // z inputem (już po odsianiu unassigned). Jeśli nie — VROOM
      // zwrócił coś dziwnego, nie zastosujmy tego.
      console.error(
        `[routing/optimize] VROOM steps mismatch: in=${jobs.length} out=${orderedJobIds.length}`,
      );
      return null;
    }

    // Distance/duration: preferuj per-route, fallback na summary.
    // Oba pola powinny być obecne dla single-vehicle problemu.
    const distanceM = Math.round(
      route.distance ?? data.summary?.distance ?? 0,
    );
    const durationS = Math.round(
      route.duration ?? data.summary?.duration ?? 0,
    );

    return { orderedJobIds, distanceM, durationS };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(
        `[routing/optimize] ORS ${profile} timeout (${OPTIMIZATION_TIMEOUT_MS}ms)`,
      );
    } else {
      console.error("[routing/optimize] ORS request failed", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
