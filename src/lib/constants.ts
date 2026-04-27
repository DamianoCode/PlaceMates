/**
 * Single source of truth for tunable numbers shared across domain and
 * UI. Keep this file boring — values, no logic. If a number lives only
 * in one module, leave it inline; if two callers would otherwise drift,
 * pull it here.
 */

// Ranking surface ---------------------------------------------------------

/** Default page size for the global ranking. */
export const RANKING_LIMIT_DEFAULT = 50;

/**
 * Minimum number of ratings a canonical needs to appear in the ranking.
 * 1 = visible to small (2-person) groups so they see their own places.
 * Bump when the dataset grows.
 */
export const RANKING_MIN_RATINGS_DEFAULT = 1;

/**
 * Cache TTL for the ranking aggregate. Anonymous, slowly changing —
 * even a stale minute is fine, ratings flow at human pace.
 */
export const RANKING_CACHE_TTL_SECONDS = 60;

/** Tag used by `unstable_cache` for ranking responses. */
export const RANKING_CACHE_TAG = "ranking";

// Map markers -------------------------------------------------------------

/** Stagger between marker pop-ins (ms per marker, low index first). */
export const MARKER_STAGGER_MS = 8;

/** Hard cap on stagger so a dense viewport never feels slow. */
export const MARKER_STAGGER_CAP_MS = 240;

// Pin-drop POI suggestion -------------------------------------------------

/**
 * Radius (m) used when proposing nearby OSM POIs after a pin-drop. 50 m
 * is roughly the granularity of GPS plus a building footprint — wider
 * and we suggest places on the next street; tighter and we miss the
 * shop the user actually meant.
 */
export const PIN_DROP_NEARBY_RADIUS_M = 60;

/** Cap how many suggestions we surface to keep the UI quiet. */
export const PIN_DROP_NEARBY_LIMIT = 5;
