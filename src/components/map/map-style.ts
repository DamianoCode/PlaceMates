import type { Map as MLMap } from "maplibre-gl";

/**
 * Basemap for every map in the app — OpenFreeMap "liberty" (vector,
 * free, no key, no rate limit; community-hosted, no SLA).
 *
 * Deliberately a single provider: Carto started watermarking keyless
 * raster tiles ("API KEY REQUIRED") in Aug 2026 and MapTiler is paid,
 * so one free provider keeps the look identical everywhere.
 *
 * Dark mode inverts the canvas via CSS (see globals.css), so one style
 * serves both themes.
 */
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Hide the basemap's own POI / transit pictograms. With our category
 * markers on top they'd otherwise create visual clutter — two cafés
 * stacked, a tiny grey OSM cup beside our big orange one. Liberty names
 * them `poi_r1`, `poi_r7`, `poi_r20`, `poi_transit`. Call from `onLoad`.
 */
export function hideBasemapPois(map: MLMap): void {
  for (const layer of map.getStyle().layers) {
    if (layer.id.startsWith("poi") || layer.id.startsWith("transit-stop")) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
}
