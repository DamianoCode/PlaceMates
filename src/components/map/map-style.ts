import type { StyleSpecification } from "maplibre-gl";

/**
 * MapLibre style selector — env-driven so we can swap providers
 * without a code change.
 *
 *   NEXT_PUBLIC_MAPTILER_KEY    → MapTiler streets-v2 (best quality, paid)
 *   NEXT_PUBLIC_MAP_PROVIDER=openfreemap → OpenFreeMap "liberty"
 *                                  (vector, free, no key, no rate limit;
 *                                   community-hosted, no SLA)
 *   (anything else / unset)     → Carto Voyager raster (default, warm look,
 *                                  free fair-use, matches the app palette)
 *
 * Carto is the default because its warm cream/sand palette plays best
 * with the app's primary orange + cream identity. OpenFreeMap "liberty"
 * leans cooler/grey-green and the dark-mode invert (globals.css) makes
 * it look misty rather than warm. Switch via env when that's desired.
 *
 * Dark mode inverts the canvas via CSS (see globals.css) regardless of
 * provider so the visual identity stays cohesive across themes.
 */
export function getMapStyle(dark = false): StyleSpecification | string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    // MapTiler "voyager" is their direct counterpart to Carto Voyager:
    // same warm cream/sand palette, same vibe — keeps the brand
    // identity intact when the user upgrades from raster Carto to
    // vector MapTiler. `voyager-dark` exists too but the CSS-invert
    // dark-mode pipeline (globals.css) plays better with the light
    // variant, so we serve `voyager` for both themes.
    void dark;
    return `https://api.maptiler.com/maps/voyager/style.json?key=${key}`;
  }

  const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER;
  if (provider === "openfreemap") {
    return "https://tiles.openfreemap.org/styles/liberty";
  }

  // Carto Voyager — raster, no key, warm palette. Default for cohesive
  // brand feel with the app's orange/cream colour story.
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        maxzoom: 19,
      },
    },
    layers: [{ id: "carto", type: "raster", source: "carto" }],
  };
}
