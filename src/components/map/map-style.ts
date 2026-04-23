import type { StyleSpecification } from "maplibre-gl";

/**
 * MapLibre style. Uses MapTiler when NEXT_PUBLIC_MAPTILER_KEY is set
 * (nicer tiles, free tier), else falls back to OpenStreetMap raster.
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
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
        maxzoom: 19,
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}
