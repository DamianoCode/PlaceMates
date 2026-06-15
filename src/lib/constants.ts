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

// Group insights ----------------------------------------------------------

/**
 * Cache TTL for the per-group insight counters. Like the ranking
 * aggregate, the numbers change at human pace — a stale minute is
 * harmless. Place/rating mutations invalidate the tag eagerly; photo
 * and visit counts self-heal within this window.
 */
export const INSIGHTS_CACHE_TTL_SECONDS = 60;

/** Tag used by `unstable_cache` for group insight counters. */
export const INSIGHTS_CACHE_TAG = "insights";

// Map markers -------------------------------------------------------------

/** Stagger between marker pop-ins (ms per marker, low index first). */
export const MARKER_STAGGER_MS = 8;

/** Hard cap on stagger so a dense viewport never feels slow. */
export const MARKER_STAGGER_CAP_MS = 240;

// Map clustering ----------------------------------------------------------

/**
 * Pixel radius used by supercluster when grouping pins. Larger = more
 * aggressive clustering (more pins collapse together at any given zoom).
 * 60 px lines up with our marker size (h-9 = 36 px) plus generous
 * breathing room.
 */
export const MAP_CLUSTER_RADIUS_PX = 60;

/**
 * Minimum pins-in-radius to form a cluster. Below this, individual
 * markers render even if they overlap. 7 is the empirical sweet spot
 * for our group-sized datasets — a single small group's lunch spots
 * stay visible as pins; busy city areas collapse.
 */
export const MAP_CLUSTER_MIN_POINTS = 7;

/**
 * Past this zoom level supercluster stops clustering — every pin
 * stands alone. 17 ≈ neighbourhood detail; below it we still show
 * individual markers when there are few; above it we always show
 * them regardless of density.
 */
export const MAP_CLUSTER_MAX_ZOOM = 17;

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
