"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MapLibreMap, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type ViewState,
} from "react-map-gl/maplibre";
import type { Map as MLMap, LngLatBoundsLike } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { Bike, Car, Check, Clock, Footprints, Route as RouteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { getMapStyle } from "@/components/map/map-style";
import { TripMapInfoCard } from "./TripMapInfoCard";
import type { TripStopView } from "@/domain/trips/service";

/**
 * Map mode for the trip detail page. Three layers:
 *   - numbered pins per stop (existing)
 *   - LineString geometry from OpenRouteService (cached server-side)
 *   - profile selector pills + total distance/duration in header
 *
 * Routing falls back gracefully: if ORS unreachable or key missing,
 * we draw the legacy dashed straight-line polyline. Distance/
 * duration vanish in that case — they're meaningless without an
 * actual road-following route.
 */

type RoutingProfile = "driving-car" | "cycling-regular" | "foot-walking";

type RouteResponse =
  | {
      ok: true;
      geometry: GeoJSON.LineString;
      distanceM: number;
      durationS: number;
    }
  | { ok: false; reason: string };

const PROFILE_OPTIONS: ReadonlyArray<{
  value: RoutingProfile;
  label: string;
  icon: typeof Car;
}> = [
  { value: "driving-car", label: "Auto", icon: Car },
  { value: "cycling-regular", label: "Rower", icon: Bike },
  { value: "foot-walking", label: "Pieszo", icon: Footprints },
];

const PROFILE_STORAGE_KEY = "pm.trip.routing-profile";

export function TripMapView({
  stops,
  tripId,
}: {
  stops: TripStopView[];
  tripId: string;
}) {
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

  // Selected pin drives bottom info card. Local state — outside of
  // map mode this concept doesn't exist.
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Routing profile — persisted to localStorage so the user's
  // preference (e.g., "Rower") survives between sessions.
  const [profile, setProfile] = useState<RoutingProfile>("driving-car");
  useEffect(() => {
    if (typeof window === "undefined") return;
    let abort = false;
    queueMicrotask(() => {
      if (abort) return;
      try {
        const stored = window.localStorage.getItem(
          PROFILE_STORAGE_KEY,
        ) as RoutingProfile | null;
        if (stored && PROFILE_OPTIONS.some((p) => p.value === stored)) {
          setProfile(stored);
        }
      } catch {
        /* private mode, quota — ignore */
      }
    });
    return () => {
      abort = true;
    };
  }, []);

  const setProfileAndPersist = useCallback((next: RoutingProfile) => {
    setProfile(next);
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  // Routing fetch — only when there are 2+ stops (single stop has
  // no route). 5-minute staleTime so panning the map doesn't keep
  // refetching on every focus.
  const { data: routeRes } = useQuery({
    queryKey: ["trip-route", tripId, profile, stops.length],
    enabled: stops.length >= 2,
    queryFn: () =>
      fetchJson<RouteResponse>(
        `/api/trips/${tripId}/route?profile=${profile}`,
      ),
    staleTime: 5 * 60_000,
  });

  const route = routeRes?.ok ? routeRes : null;

  const selectStop = useCallback(
    (stopId: string) => {
      setSelectedStopId(stopId);
      const target = stops.find((s) => s.id === stopId);
      if (target && mapInstance) {
        mapInstance.flyTo({
          center: [target.placeLng, target.placeLat],
          zoom: Math.max(mapInstance.getZoom(), 14),
          duration: 350,
          offset: [0, -60],
        });
      }
    },
    [stops, mapInstance],
  );

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

  // GeoJSON for the line. Real route from ORS if we have it,
  // otherwise the legacy dashed straight-line fallback.
  const lineGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (stops.length < 2) {
      return { type: "FeatureCollection", features: [] };
    }
    if (route) {
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { routed: true },
            geometry: route.geometry,
          },
        ],
      };
    }
    // Fallback straight line.
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { routed: false },
          geometry: {
            type: "LineString",
            coordinates: stops.map((s) => [s.placeLng, s.placeLat]),
          },
        },
      ],
    };
  }, [stops, route]);

  // Map height calc — matches the previous version, just adjusted
  // for the new header bar (~44 px tighter than before).
  const mapHeight =
    "min-h-[380px] h-[calc(100dvh-330px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]";

  if (stops.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground",
          mapHeight,
        )}
      >
        Brak stopów do pokazania na mapie.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header bar: profile pills + total distance/duration.
       *  Distance/duration only meaningful when ORS returned a
       *  real route — straight-line fallback hides the stats
       *  (would be misleading "as the crow flies"). */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-border/60 bg-muted/30 px-1.5 py-1.5">
        <div
          role="tablist"
          aria-label="Profil trasy"
          className="flex items-center gap-1"
        >
          {PROFILE_OPTIONS.map((opt) => (
            <ProfilePill
              key={opt.value}
              active={profile === opt.value}
              onClick={() => setProfileAndPersist(opt.value)}
              icon={<opt.icon size={12} />}
              label={opt.label}
            />
          ))}
        </div>
        {route ? (
          <div className="flex items-center gap-3 px-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <RouteIcon size={11} aria-hidden />
              <span className="font-mono tabular-nums">
                {formatDistance(route.distanceM)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={11} aria-hidden />
              <span className="font-mono tabular-nums">
                {formatDuration(route.durationS)}
              </span>
            </span>
          </div>
        ) : stops.length >= 2 ? (
          <span className="px-2 text-[11px] italic text-muted-foreground/70">
            Trasa niedostępna
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border",
          mapHeight,
        )}
      >
        <MapLibreMap
          {...view}
          onMove={(e) => setView(e.viewState)}
          onLoad={(e) => setMapInstance(e.target)}
          onClick={() => setSelectedStopId(null)}
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
                "line-color": "#b8613a",
                // Routed line is solid 4 px; straight-line
                // fallback is dashed 3 px so the visual difference
                // tells the user "this isn't an actual road route".
                "line-width": route ? 4 : 3,
                "line-opacity": route ? 0.85 : 0.65,
                ...(route
                  ? {}
                  : { "line-dasharray": [0.5, 1.5] as unknown as number[] }),
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>

          {stops.map((s, i) => {
            const completed = s.completedAt !== null;
            const active = selectedStopId === s.id;
            return (
              <Marker
                key={s.id}
                longitude={s.placeLng}
                latitude={s.placeLat}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  selectStop(s.id);
                }}
              >
                <span
                  aria-label={`${i + 1}. ${s.placeName}${completed ? " (ukończone)" : ""}`}
                  className={cn(
                    "flex cursor-pointer items-center justify-center rounded-full border-2 border-white font-semibold shadow-md transition-[width,height,box-shadow] duration-200 ease-out",
                    active ? "h-11 w-11 text-base" : "h-9 w-9 text-sm",
                    completed
                      ? "bg-emerald-500 text-white"
                      : "bg-primary text-primary-foreground",
                    active &&
                      (completed
                        ? "ring-4 ring-emerald-500/30"
                        : "ring-4 ring-primary/30"),
                  )}
                >
                  {completed ? <Check size={active ? 20 : 16} /> : i + 1}
                </span>
              </Marker>
            );
          })}
        </MapLibreMap>

        <TripMapInfoCard
          stops={stops}
          selectedStopId={selectedStopId}
          onSelect={selectStop}
          onClose={() => setSelectedStopId(null)}
        />
      </div>
    </div>
  );
}

function ProfilePill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function initialView(stops: TripStopView[]): Partial<ViewState> {
  if (stops.length === 0) {
    return { longitude: 21.0122, latitude: 52.2297, zoom: 6 };
  }
  if (stops.length === 1) {
    return {
      longitude: stops[0].placeLng,
      latitude: stops[0].placeLat,
      zoom: 13,
    };
  }
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
