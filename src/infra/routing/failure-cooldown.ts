import "server-only";

/**
 * In-memory failure cooldown — generyczna fabryka pamięci „endpoint
 * X niedawno padł, nie wołaj go przez T ms".
 *
 * Używana przez routing (ORS /directions) i optimization (ORS
 * /optimization). Każdy moduł trzyma własną instancję bo limity
 * rate i tryby błędów są niezależne — padający /optimization nie
 * powinien blokować wyświetlania trasy w Mapie i odwrotnie.
 *
 * Lifetime: instancja Mapy żyje tyle co serverless lambda. Po
 * redeploju cooldown się resetuje — to OK, nie potrzebujemy
 * globalnego state'u (każda instancja sama nauczy się że endpoint
 * pada). Rozmiar mapy w praktyce trywialny: każdy unikalny klucz
 * (typowo `tripId:profile`) zostaje max `ttlMs`, więc dla aplikacji
 * o naszej skali górną granicą jest „liczba aktywnych userów × liczba
 * profili", a klucze same się usuwają przy odczycie.
 *
 * Nie używamy setTimeout do cleanu — sprawdzamy timestamp przy każdym
 * `isInCooldown` i czyścimy lazy. Mniej kodu, brak ryzyka wycieku
 * timerów.
 */

const DEFAULT_TTL_MS = 60_000;

export type FailureCooldown = {
  /** True gdy `key` było zaznaczone jako failed w ostatnich `ttlMs`.
   *  Side-effect: czyści przeterminowane wpisy. */
  isInCooldown(key: string): boolean;
  /** Zaznacz `key` jako failed teraz. Następne ≤ttlMs wywołań
   *  `isInCooldown(key)` zwrócą true. */
  mark(key: string): void;
  /** Wyczyść konkretny `key` (np. po sukcesie). No-op gdy brak. */
  clear(key: string): void;
  /** Wyczyść wszystkie klucze spełniające predykat (np. wszystkie
   *  z prefixem `tripId:` po invalidacji tripa). */
  clearWhere(predicate: (key: string) => boolean): void;
  /** Liczba aktualnie zaznaczonych failures (dla testów/monitoringu). */
  readonly size: number;
};

export function createFailureCooldown(
  ttlMs: number = DEFAULT_TTL_MS,
): FailureCooldown {
  const failures = new Map<string, number>();

  return {
    isInCooldown(key: string): boolean {
      const at = failures.get(key);
      if (at === undefined) return false;
      if (Date.now() - at > ttlMs) {
        failures.delete(key);
        return false;
      }
      return true;
    },
    mark(key: string): void {
      failures.set(key, Date.now());
    },
    clear(key: string): void {
      failures.delete(key);
    },
    clearWhere(predicate: (key: string) => boolean): void {
      if (failures.size === 0) return;
      for (const key of failures.keys()) {
        if (predicate(key)) failures.delete(key);
      }
    },
    get size(): number {
      return failures.size;
    },
  };
}
