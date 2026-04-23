import type { StyleSpecification } from "maplibre-gl";

/**
 * MapLibre style. Uses MapTiler when NEXT_PUBLIC_MAPTILER_KEY is set
 * (best typography/rendering, free tier). Otherwise falls back to
 * CartoDB raster tiles — they ship a proper dark variant ("dark-matter")
 * which keeps the app cohesive with the dark theme without a key.
 */
export function getMapStyle(dark = false): StyleSpecification | string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    const variant = dark ? "streets-v2-dark" : "streets-v2";
    return `https://api.maptiler.com/maps/${variant}/style.json?key=${key}`;
  }

  // CartoDB (https://carto.com) — free under their usage policy, attribution required.
  const carto = dark ? "dark_all" : "voyager";
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: [
          `https://a.basemaps.cartocdn.com/rastertiles/${carto}/{z}/{x}/{y}.png`,
          `https://b.basemaps.cartocdn.com/rastertiles/${carto}/{z}/{x}/{y}.png`,
          `https://c.basemaps.cartocdn.com/rastertiles/${carto}/{z}/{x}/{y}.png`,
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
