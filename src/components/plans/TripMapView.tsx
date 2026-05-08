"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import MapLibreMap, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type ViewState,
} from "react-map-gl/maplibre";
import type { Map as MLMap, LngLatBoundsLike } from "maplibre-gl";
import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { getMapStyle } from "@/components/map/map-style";
import type { TripStopView } from "@/domain/trips/service";

/**
 * Map mode for the trip detail page. Renders:
 *   - numbered circular pins per stop (completed = emerald + check
 *     glyph; pending = primary + position number)
 *   - polyline connecting stops in order (just lat→lng→lat — no
 *     road routing for v1; that needs OSRM and isn't worth the
 *     setup yet)
 *   - auto-fit bounds on first render so the user sees the whole
 *     trip without panning
 */
export function TripMapView({ stops }: { stops: TripStopView[] }) {
  const { resolvedTheme } = useTheme();
  const style = useMemo(
    () => getMapStyle(resolvedTheme === "dark"),
    [resolvedTheme],
  );
  const [view, setView] = useState<Partial<ViewState>>(() =>
    initialView(stops),
  );
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);
  const fitDoneRef = useRef(false);

  // Auto-fit on mount when there are 2+ stops. Single stop already has
  // its lat/lng via initialView. Re-fit isn't a goal — once user pans,
  // we let them stay where they are.
  useEffect(() => {
    if (!mapInstance || fitDoneRef.current) return;
    if (stops.length < 2) {
      fitDoneRef.current = true;
      return;
    }
    const bounds = boundsForStops(stops);
    if (bounds) {
      mapInstance.fitBounds(bounds, {
        padding: 60,
        duration: 0,
        maxZoom: 15,
      });
    }
    fitDoneRef.current = true;
  }, [mapInstance, stops]);

  // GeoJSON for the polyline. Only meaningful with 2+ stops; below
  // that we render nothing for the line layer (Source still mounts to
  // keep the layer config stable).
  const lineGeoJson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features:
        stops.length >= 2
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: stops.map((s) => [s.placeLng, s.placeLat]),
                },
              },
            ]
          : [],
    }),
    [stops],
  );

  if (stops.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-180px)] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
        Brak stopów do pokazania na mapie.
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-180px)] overflow-hidden rounded-2xl border">
      <MapLibreMap
        {...view}
        onMove={(e) => setView(e.viewState)}
        onLoad={(e) => setMapInstance(e.target)}
        style={{ width: "100%", height: "100%" }}
        mapStyle={style}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" />

        <Source id="trip-line" type="geojson" data={lineGeoJson}>
          <Layer
            id="trip-line-layer"
            type="line"
            paint={{
              // Maplibre paint expressions don't resolve CSS vars, so
              // we hard-code an amber that reads close to our brand
              // primary on both light and dark themes. Dashed pattern
              // signals "planned route" vs the solid lines OSM
              // basemap reserves for actual roads.
              "line-color": "#f59e0b",
              "line-width": 3,
              "line-opacity": 0.75,
              "line-dasharray": [0.5, 1.5],
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>

        {stops.map((s, i) => {
          const completed = s.completedAt !== null;
          return (
            <Marker
              key={s.id}
              longitude={s.placeLng}
              latitude={s.placeLat}
              anchor="center"
            >
              <span
                aria-label={`${i + 1}. ${s.placeName}${completed ? " (ukończone)" : ""}`}
                className={
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-sm font-semibold shadow-md " +
                  (completed
                    ? "bg-emerald-500 text-white"
                    : "bg-primary text-primary-foreground")
                }
              >
                {completed ? <Check size={16} /> : i + 1}
              </span>
            </Marker>
          );
        })}
      </MapLibreMap>
    </div>
  );
}

function initialView(stops: TripStopView[]): Partial<ViewState> {
  if (stops.length === 0) {
    // Warsaw fallback — same default as the main map.
    return { longitude: 21.0122, latitude: 52.2297, zoom: 6 };
  }
  if (stops.length === 1) {
    return {
      longitude: stops[0].placeLng,
      latitude: stops[0].placeLat,
      zoom: 13,
    };
  }
  // Multi-stop: zoom out enough to see all; auto-fit takes over after
  // mount once the map has its container size.
  const lngs = stops.map((s) => s.placeLng);
  const lats = stops.map((s) => s.placeLat);
  return {
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    zoom: 8,
  };
}

function boundsForStops(stops: TripStopView[]): LngLatBoundsLike | null {
  if (stops.length === 0) return null;
  const lngs = stops.map((s) => s.placeLng);
  const lats = stops.map((s) => s.placeLat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
