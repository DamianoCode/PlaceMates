import type { StyleSpecification } from "maplibre-gl";

/**
 * MapLibre style selector.
 *
 * Priority:
 *   1. MapTiler when NEXT_PUBLIC_MAPTILER_KEY is present (best quality,
 *      paid tier — 100k req/mo free).
 *   2. OpenFreeMap "liberty" — fully free, no key, no rate limit,
 *      community-hosted vector tiles. MIT-licensed style. Default.
 *
 * Dark mode inverts the canvas via CSS (see globals.css) rather than
 * fetching a separate dark style — keeps the visual identity cohesive
 * (same landmarks, same density) and works regardless of provider.
 */
export function getMapStyle(dark = false): StyleSpecification | string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    const variant = dark ? "streets-v2-dark" : "streets-v2";
    return `https://api.maptiler.com/maps/${variant}/style.json?key=${key}`;
  }

  // OpenFreeMap delivers vector tiles — sharp at every zoom, smaller
  // payload than raster, and (unlike Carto Voyager) no fair-use
  // throttling. No SLA though; if the host ever goes down, fall back
  // to MapTiler by setting NEXT_PUBLIC_MAPTILER_KEY in env.
  return "https://tiles.openfreemap.org/styles/liberty";
}
