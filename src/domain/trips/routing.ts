import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, tripRoutes, tripStops, trips } from "@/infra/db/schema";
import {
  callORS,
  type RouteResult,
  type RoutingProfile,
} from "@/infra/routing/ors";
import { createFailureCooldown } from "@/infra/routing/failure-cooldown";
import { getTripForUser } from "./service";

/**
 * Cached routing for a trip. Cztery warstwy:
 *
 *   1. Auth — każde wywołanie weryfikuje członkostwo. Bez tego user
 *      usunięty z grupy zachowywałby read-through-cache access przez
 *      cały TTL (do 7 dni). Cheap query (PK + index lookup).
 *   2. Cache hit — zwracamy zapisaną geometrię.
 *   3. Cache miss / stale — wołamy ORS, upsertujemy wynik.
 *   4. ORS unreachable → fallback na stary cached row jeśli jest,
 *      inaczej null (klient pokazuje prostą linię).
 *
 * In-memory failure cooldown (`directionsCooldown`): jeśli ORS niedawno
 * (≤60 s) padło dla danego (tripId, profile), nie wołamy go ponownie
 * — od razu zwracamy stale row (albo null). Chroni przed waleniem
 * hammerem w padający serwis przy każdym requeście usera podczas
 * outage'u. Mapa żyje tylko w pamięci instancji (serverless lambda),
 * po redeploju resetuje się — to OK, cooldown nie musi być globalny.
 *
 * TTL 7 dni jest safety netem dla luk w invalidacji (np. globalne
 * zmiany w OSM których nie wykryjemy). Aktywne mutacje (reorder,
 * add, remove stop, oraz `updatePlace` z location movement) ręcznie
 * inwalidują przez `invalidateTripRoutes` / `invalidateTripRoutesForPlace`.
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const directionsCooldown = createFailureCooldown();

function failureKey(tripId: string, profile: RoutingProfile): string {
  return `${tripId}:${profile}`;
}

/** Tani check członkostwa w grupie tripa. Jeden indeksowany SELECT,
 *  bez dociągania detali. Używany na każde wywołanie `getOrComputeRoute`
 *  żeby cache nie obchodził auth. */
async function userCanAccessTrip(
  tripId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: trips.id })
    .from(trips)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, trips.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(eq(trips.id, tripId))
    .limit(1);
  return Boolean(row);
}

export async function getOrComputeRoute(
  tripId: string,
  profile: RoutingProfile,
  userId: string,
): Promise<RouteResult | null> {
  // Auth FIRST. Cache hit nie może omijać membership check'a — inaczej
  // user wyrzucony z grupy miałby dostęp do route'a aż do wygaśnięcia
  // TTL (do 7 dni). Membership check jest tani (PK + index), więc
  // płacimy go raz na request.
  if (!(await userCanAccessTrip(tripId, userId))) return null;

  // Cache lookup.
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
    // Stale → fall through to recompute. Nie usuwamy tu — upsert
    // niżej zastąpi. Jeśli ORS padnie, dalej serwujemy stale row.
  }

  // ORS recently failed dla tego klucza? Nie wołaj go znów — zwróć
  // stale row (lepiej niż nic) albo null. Cooldown 60 s — po jego
  // upływie spróbujemy ponownie. Bez tego każdy fresh request usera
  // podczas outage'u dorzucałby kolejne nieudane wywołanie do logów
  // i potencjalnie do rate-limita.
  if (directionsCooldown.isInCooldown(failureKey(tripId, profile))) {
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

  // Cache miss → pobierz trip i policz route. `getTripForUser` re-checkuje
  // członkostwo (redundancja z `userCanAccessTrip` powyżej) ale daje nam
  // pełną listę stopów posortowaną — i tak musimy ją mieć.
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
    // ORS padło — zaznacz failure żeby kolejne requesty nie biły go
    // przez następne 60 s, i wróć stale cached row jeśli mamy.
    directionsCooldown.mark(failureKey(tripId, profile));
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

  // Sukces → wyczyść ewentualny wcześniejszy failure marker (ORS
  // wrócił do życia) i upsertuj. Concurrent reorder + getOrCompute
  // może w teorii dać race: reorder inwaliduje cache, my upsertujemy
  // wynik dla starej kolejności. Blast radius bounded — kolejne
  // czytanie zobaczy "świeży" cache zgodny ze starą kolejnością aż
  // do następnej mutacji. Self-healing przy następnym reorderze.
  // Pełna ochrona wymagałaby SELECT FOR UPDATE / advisory locka,
  // overkill dla aplikacji o tej skali.
  directionsCooldown.clear(failureKey(tripId, profile));
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
 *  a fresh route from ORS. Czyści też in-memory failure markery
 *  dla tego tripa — po zmianie kolejności stopów chcemy spróbować
 *  ORS od razu, nawet jeśli wczoraj padł. */
export async function invalidateTripRoutes(tripId: string): Promise<void> {
  await db.delete(tripRoutes).where(eq(tripRoutes.tripId, tripId));
  directionsCooldown.clearWhere((key) => key.startsWith(`${tripId}:`));
}

/** Drop cached routes for every trip containing this place. Wołane
 *  z `updatePlace` gdy pin został przesunięty — geometria każdej trasy
 *  która przez to miejsce przechodzi jest teraz zła. Bez tego user
 *  widziałby trasę prowadzącą do starej współrzędnej aż do wygaśnięcia
 *  TTL (do 7 dni).
 *
 *  Inner SELECT trzymamy jako subquery (nie 2-fazowy fetch + delete)
 *  żeby było atomowe i prostsze; tabele są małe więc plan EXPLAIN i tak
 *  wybierze nested loop. */
export async function invalidateTripRoutesForPlace(placeId: string): Promise<void> {
  // Najpierw materializujemy listę affected trip IDs — używamy jej
  // dwa razy (do DELETE oraz do wyczyszczenia in-memory failure markers
  // dla tych tripów). Zwykle <10 tripów per place, więc round-trip
  // jest tani; subquery w DELETE działałoby też, ale rozdzielenie
  // pozwala nam wpiąć cleanup markerów bez drugiego SELECTa.
  const rows = await db
    .select({ tripId: tripStops.tripId })
    .from(tripStops)
    .where(eq(tripStops.placeId, placeId));
  if (rows.length === 0) return;

  const tripIds = rows.map((r) => r.tripId);
  await db.delete(tripRoutes).where(inArray(tripRoutes.tripId, tripIds));

  // Wyczyść failure markers dla affected tripów — geometria się
  // zmieniła, nie chcemy żeby cooldown ze starego ORS-failure'a
  // dla tego tripa odciął retry na świeżych współrzędnych.
  const affected = new Set(tripIds);
  directionsCooldown.clearWhere((key) => {
    const [tid] = key.split(":");
    return affected.has(tid);
  });
}
