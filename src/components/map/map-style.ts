import type { StyleSpecification } from "maplibre-gl";

/**
 * MapLibre style selector.
 *
 * Priority:
 *   1. MapTiler when NEXT_PUBLIC_MAPTILER_KEY is present (nicest rendering).
 *   2. Carto "voyager" raster tiles — free, no key, warm colourful look.
 *      Dark mode inverts the canvas via CSS (see globals.css) rather than
 *      using a second basemap; this keeps the light/dark style cohesive
 *      (same landmarks, same density) and stays readable where Carto's
 *      dark tiles are too muddy.
 *
 * NOTE: We tried OpenFreeMap "liberty" (vector tiles, no key, no rate
 * limit) but rendering came up blank under react-map-gl 8 + maplibre-gl
 * 5.x. Reverting to Carto until that's diagnosed in a separate PR.
 */
export function getMapStyle(dark = false): StyleSpecification | string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    const variant = dark ? "streets-v2-dark" : "streets-v2";
    return `https://api.maptiler.com/maps/${variant}/style.json?key=${key}`;
  }

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
