/**
 * MapLibre style selector.
 *
 * Priority:
 *   1. MapTiler if NEXT_PUBLIC_MAPTILER_KEY is set (nicest labels + vector).
 *   2. OpenFreeMap vector tiles — free, no key, proper balanced dark.
 *
 * MapLibre accepts a style URL string directly, which is simpler than
 * inlining a StyleSpecification.
 */
export function getMapStyle(dark = false): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    const variant = dark ? "streets-v2-dark" : "streets-v2";
    return `https://api.maptiler.com/maps/${variant}/style.json?key=${key}`;
  }
  // OpenFreeMap (https://openfreemap.org) — vector tiles mirroring OSM.
  // "positron" (light) and "dark" give a clean, legible basemap without
  // drowning the UI. Attribution is baked into the style.
  return dark
    ? "https://tiles.openfreemap.org/styles/dark"
    : "https://tiles.openfreemap.org/styles/positron";
}
