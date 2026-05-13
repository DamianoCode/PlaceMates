import "server-only";

import { callORSOptimization } from "@/infra/routing/ors-optimization";
import type { RoutingProfile } from "@/infra/routing/ors";
import { err, ok, type Result } from "../result";
import { getOrComputeRoute } from "./routing";
import { getTripForUser, type TripStopView } from "./service";

/**
 * Optymalizacja kolejności stopów w planie. Strategia:
 *
 *   1. Pobierz trip (auth + lista stopów posortowana po sort_order).
 *   2. Rozdziel stopy na completed (już odhaczone) i pending.
 *      Optymalizujemy tylko pending — completed to przeszłość, nie
 *      przeplanowujemy historii.
 *   3. Wybierz anchor — punkt z którego startujemy:
 *        - jeśli są completed: ostatni completed (= "jesteś tu teraz"),
 *        - jeśli nie ma completed: pierwszy pending (klasyczny start),
 *      a pozostałe pending lecą jako VROOM jobs.
 *   4. Sprawdź czy jest co optymalizować: ≥2 joby. 1 job = trywialne,
 *      0 jobów = nic do roboty.
 *   5. Zawołaj VROOM. Po zmapowaniu wynikowych integer-ID-ów na
 *      stop UUID-y, złóż pełną proponowaną kolejność:
 *      [completed…, anchor (jeśli był z pending), …optimizedJobs].
 *   6. Porównaj z aktualną kolejnością — flagujemy `unchanged` żeby
 *      UI mógł pokazać "trasa jest już optymalna" zamiast pustego
 *      diffa.
 *   7. Stats: VROOM zwraca distanceM/durationS dla proposed.
 *      Current bierzemy z `getOrComputeRoute` (cache-friendly,
 *      bez kolejnego ORS calla jeśli user otwierał Mapę).
 *
 * Cooldown: VROOM dostaje własną failure-map (osobny endpoint, osobny
 * limit) — nie chcemy współdzielić z directions, żeby padający
 * `/optimization` nie blokował wyświetlania trasy w Mapa.
 */

const FAIL_COOLDOWN_MS = 60_000;

const optimizationFailures = new Map<string, number>();

function failureKey(tripId: string, profile: RoutingProfile): string {
  return `${tripId}:${profile}`;
}

function isInOptimizationCooldown(
  tripId: string,
  profile: RoutingProfile,
): boolean {
  const key = failureKey(tripId, profile);
  const at = optimizationFailures.get(key);
  if (at === undefined) return false;
  if (Date.now() - at > FAIL_COOLDOWN_MS) {
    optimizationFailures.delete(key);
    return false;
  }
  return true;
}

function markOptimizationFailure(
  tripId: string,
  profile: RoutingProfile,
): void {
  optimizationFailures.set(failureKey(tripId, profile), Date.now());
}

export type ProposedStop = {
  stopId: string;
  placeName: string;
  placeCategorySlug: string;
  /** True dla anchor (pierwszego completed lub pierwszego pending)
   *  — UI oznacza go jako "punkt startowy, bez zmiany pozycji". */
  isAnchor: boolean;
  /** Already-completed stopy lecą na początku zachowując kolejność. */
  isCompleted: boolean;
};

export type OptimizationPreview = {
  /** Pełna proponowana kolejność stopów (UUID-y w nowej sekwencji).
   *  Caller wysyła ją do reorderStops. */
  fullOrderedStopIds: string[];
  /** Wzbogacona reprezentacja do UI — z nazwami i flagami. */
  proposedOrder: ProposedStop[];
  proposedDistanceM: number;
  proposedDurationS: number;
  /** Z cache (lub świeży directions call jeśli cache cold). null
   *  jeśli current route niedostępny — wtedy nie pokażemy delty. */
  currentDistanceM: number | null;
  currentDurationS: number | null;
  /** True gdy proponowana kolejność jest identyczna z aktualną.
   *  UI mówi wtedy "trasa jest już optymalna" zamiast pokazywać
   *  niezmieniony diff. */
  unchanged: boolean;
};

export async function previewOptimizedTripOrder(
  tripId: string,
  profile: RoutingProfile,
  userId: string,
): Promise<Result<OptimizationPreview>> {
  // Auth + pełna lista stopów w jednym przejściu.
  const trip = await getTripForUser(tripId, userId);
  if (!trip) return err("Brak dostępu do tego planu.");

  if (trip.stops.length < 3) {
    return err("Optymalizacja wymaga co najmniej 3 stopów.");
  }

  // Stopy z getTripForUser są pre-sortowane po sortOrder.
  const sorted = [...trip.stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const completed = sorted.filter((s) => s.completedAt !== null);
  const pending = sorted.filter((s) => s.completedAt === null);

  if (pending.length < 2) {
    return err(
      "Za mało nieukończonych stopów do optymalizacji (potrzeba minimum 2).",
    );
  }

  // Anchor = "punkt z którego startujemy optymalizację":
  //  - są completed → ostatni completed (gdzie aktualnie jesteś)
  //  - brak completed → pierwszy pending (klasyczny start planu)
  // W obu przypadkach anchor ZOSTAJE w swojej pozycji, a optymalizowane
  // są pozostałe pending. Jobs dla VROOM to pending bez anchora.
  let anchor: TripStopView;
  let jobsStops: TripStopView[];
  if (completed.length > 0) {
    anchor = completed[completed.length - 1];
    jobsStops = pending;
  } else {
    anchor = pending[0];
    jobsStops = pending.slice(1);
  }

  if (jobsStops.length < 2) {
    return err(
      "Za mało stopów do przeplanowania (anchor + minimum 2 jobs).",
    );
  }

  // Failure cooldown — nie waliśmy w padający endpoint co request.
  if (isInOptimizationCooldown(tripId, profile)) {
    return err(
      "Optymalizator chwilowo niedostępny. Spróbuj ponownie za chwilę.",
    );
  }

  // Mapowanie UUID ↔ integer (VROOM wymaga numerycznych ID).
  const jobs = jobsStops.map((s, i) => ({
    id: i + 1,
    location: [s.placeLng, s.placeLat] as [number, number],
  }));
  const jobIdToStop = new Map(jobsStops.map((s, i) => [i + 1, s]));

  const result = await callORSOptimization(profile, jobs, [
    anchor.placeLng,
    anchor.placeLat,
  ]);

  if (!result) {
    markOptimizationFailure(tripId, profile);
    return err(
      "Nie udało się obliczyć optymalnej trasy. ORS jest chwilowo niedostępny.",
    );
  }

  // Wyczyść flag failure — endpoint żyje.
  optimizationFailures.delete(failureKey(tripId, profile));

  // Zbuduj pełną proponowaną sekwencję: [completed…, anchor (jeśli z
  // pending), …optimized jobs].
  const optimizedJobs: TripStopView[] = result.orderedJobIds
    .map((id) => jobIdToStop.get(id))
    .filter((s): s is TripStopView => Boolean(s));
  if (optimizedJobs.length !== jobsStops.length) {
    // VROOM zwrócił mismatch — caller (ORS client) już wykrył,
    // tutaj defensywne. Nie powinniśmy się tu znaleźć.
    return err("Optymalizator zwrócił niespójną kolejność stopów.");
  }

  const proposedFullStops: TripStopView[] = [];
  // Wszystkie completed lecą najpierw, w oryginalnej kolejności.
  proposedFullStops.push(...completed);
  // Anchor: gdy nie było completed, anchor był pierwszym pending —
  // wstawiamy go jako pierwszy pending w nowej sekwencji. Gdy były
  // completed, anchor był z completed i już dorzucony.
  if (completed.length === 0) {
    proposedFullStops.push(anchor);
  }
  proposedFullStops.push(...optimizedJobs);

  // Wrażliwy sanity check: liczba stopów musi się zgadzać.
  if (proposedFullStops.length !== sorted.length) {
    return err("Niespójna liczba stopów po optymalizacji.");
  }

  const fullOrderedStopIds = proposedFullStops.map((s) => s.id);
  const currentOrderedStopIds = sorted.map((s) => s.id);
  const unchanged = fullOrderedStopIds.every(
    (id, i) => id === currentOrderedStopIds[i],
  );

  const proposedOrder: ProposedStop[] = proposedFullStops.map((s) => ({
    stopId: s.id,
    placeName: s.placeName,
    placeCategorySlug: s.placeCategorySlug,
    isAnchor: s.id === anchor.id,
    isCompleted: s.completedAt !== null,
  }));

  // Current stats — tanio: cache hit zwykle (user otworzył Mapę przed
  // kliknięciem Optymalizuj). Cache miss → directions call (1 hit).
  // Jeśli ORS dla directions padnie, currentStats = null i UI nie
  // pokaże delty.
  const currentRoute = await getOrComputeRoute(tripId, profile, userId).catch(
    () => null,
  );

  return ok({
    fullOrderedStopIds,
    proposedOrder,
    proposedDistanceM: result.distanceM,
    proposedDurationS: result.durationS,
    currentDistanceM: currentRoute?.distanceM ?? null,
    currentDurationS: currentRoute?.durationS ?? null,
    unchanged,
  });
}
