/**
 * Formatery dystansu i czasu dla widoku trasy planu.
 *
 * - `formatDistance`: <1 km → metry; <10 km → 1 miejsce po przecinku;
 *   ≥10 km → zaokrąglone km. Granica 10 km wzięta z UX: poniżej tej
 *   wartości użytkownik chce wiedzieć czy to 2.3 czy 2.7 km. Powyżej
 *   precyzja jednego km wystarcza i mniej zaśmieca.
 * - `formatDuration`: <60 s → sekundy (rzadko widziane, ORS zwykle
 *   zwraca minuty); <60 min → minuty; w pozostałych → "Xh Ymin".
 *
 * Trzymane razem żeby zachowanie pozostawało spójne między info card
 * w TripMapView, kartą per-leg w TripMapInfoCard i diff'em w
 * OptimizeStopsButton — wcześniej każdy plik miał własną kopię,
 * łatwo było rozjechać.
 */

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
