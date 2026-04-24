"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  GeolocateControl,
  Marker,
  NavigationControl,
  type ViewState,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import type { GeolocateControl as MLGeolocate, Map as MLMap } from "maplibre-gl";
import { useTheme } from "next-themes";
import { getMapStyle } from "./map-style";
import { loadCamera, saveCamera } from "./camera-storage";
import { iconForCategorySlug } from "./category-icons";

type PlacePin = { id: string; name: string; lat: number; lng: number; categoryId: string };

const DEFAULT_VIEW: Partial<ViewState> = {
  longitude: 21.0122, // Warsaw
  latitude: 52.2297,
  zoom: 11,
};

export function MapView({
  initial,
  onPick,
  initialPick,
  onSelectPlace,
  selectedPlaceId,
  categoryFilter,
  restrictToIds,
  onBoundsChange,
  onContextMenu,
  categoriesById,
  places: placesProp,
}: {
  initial?: Partial<ViewState>;
  /** When set, the map is in "pick a location" mode — tap sets pin. */
  onPick?: (lnglat: { lng: number; lat: number }) => void;
  /** Pre-placed pin for edit / "dodaj tutaj" flows. Only used in pick mode. */
  initialPick?: { lat: number; lng: number };
  /** Called when a place marker is tapped. When provided, selection replaces navigation. */
  onSelectPlace?: (placeId: string | null) => void;
  selectedPlaceId?: string | null;
  categoryFilter?: string | null;
  /** If present, only places with these ids render. */
  restrictToIds?: Set<string>;
  /** Fires on moveend with the current visible bounds. */
  onBoundsChange?: (bbox: { west: number; south: number; east: number; north: number }) => void;
  /** Right-click / long-press at lng,lat. Ignored in pick mode. */
  onContextMenu?: (lnglat: { lng: number; lat: number }) => void;
  /** Category lookup used to pick the per-marker icon. */
  categoriesById?: Map<string, { slug: string }>;
  /** Server-fed places. When provided, MapView skips its own fetch. */
  places?: PlacePin[];
}) {
  // When the parent supplies places (preferred — server-fetched, always
  // fresh after router.refresh()), we use those directly. Otherwise fall
  // back to a one-shot client fetch so the component stays embeddable.
  const [fetched, setFetched] = useState<PlacePin[]>([]);
  const places = placesProp ?? fetched;
  // Restore the last camera for both the main map and the pick-mode
  // form map, so /places/new opens where the user left /map. Explicit
  // `initial` (e.g. ?lat=&lng= from "Dodaj tutaj") still wins.
  const [view, setView] = useState<Partial<ViewState>>(() => ({
    ...DEFAULT_VIEW,
    ...(loadCamera() ?? {}),
    ...initial,
  }));
  const [pick, setPick] = useState<{ lng: number; lat: number } | null>(
    initialPick ? { lat: initialPick.lat, lng: initialPick.lng } : null,
  );
  const { resolvedTheme } = useTheme();
  const style = useMemo(() => getMapStyle(resolvedTheme === "dark"), [resolvedTheme]);

  // Persist on idle rather than every onMove tick to keep localStorage quiet.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersist = useCallback(
    (v: ViewState) => {
      if (onPick) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveCamera({
          longitude: v.longitude,
          latitude: v.latitude,
          zoom: v.zoom,
        });
      }, 300);
    },
    [onPick],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleMove = useCallback(
    (e: ViewStateChangeEvent) => {
      setView(e.viewState);
      schedulePersist(e.viewState);
    },
    [schedulePersist],
  );

  const geolocateRef = useRef<MLGeolocate>(null);

  // If the browser already has geolocation permission granted, show the
  // user's blue dot immediately on load. If permission is "prompt" we
  // stay quiet — auto-prompting without a user gesture is both bad UX
  // and, on stricter browsers, outright blocked.
  const handleLoad = useCallback(
    (e: { target: MLMap }) => {
      if (onBoundsChange) {
        const b = e.target.getBounds();
        onBoundsChange({
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        });
      }
      if (!("permissions" in navigator) || !("geolocation" in navigator)) return;
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (status.state === "granted") geolocateRef.current?.trigger();
        })
        .catch(() => {});
    },
    [onBoundsChange],
  );

  useEffect(() => {
    if (onPick || placesProp) return;
    let abort = false;
    fetch("/api/places")
      .then((r) => (r.ok ? r.json() : { places: [] }))
      .then((data: { places: PlacePin[] }) => {
        if (!abort) setFetched(data.places ?? []);
      })
      .catch(() => {});
    return () => {
      abort = true;
    };
  }, [onPick, placesProp]);

  const visible = useMemo(() => {
    let out = places;
    if (categoryFilter) out = out.filter((p) => p.categoryId === categoryFilter);
    if (restrictToIds) out = out.filter((p) => restrictToIds.has(p.id));
    return out;
  }, [places, categoryFilter, restrictToIds]);

  return (
    <Map
      {...view}
      onMove={handleMove}
      onMoveEnd={(e) => {
        if (!onBoundsChange) return;
        const b = e.target.getBounds();
        onBoundsChange({
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        });
      }}
      onLoad={handleLoad}
      onClick={(e) => {
        if (onPick) {
          const { lng, lat } = e.lngLat;
          setPick({ lng, lat });
          onPick({ lng, lat });
          return;
        }
        // Tap on blank map clears selection.
        onSelectPlace?.(null);
      }}
      onContextMenu={(e) => {
        if (onPick || !onContextMenu) return;
        // Prevent the native browser menu so our app action wins.
        e.originalEvent.preventDefault();
        const { lng, lat } = e.lngLat;
        onContextMenu({ lng, lat });
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={style}
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="top-right" />
      {/* Available in every mode — including /places/new pin-drop — so
       *  users can always centre on themselves and drop a pin nearby. */}
      <GeolocateControl
        ref={geolocateRef}
        position="top-right"
        trackUserLocation
        showUserLocation
        showAccuracyCircle
        positionOptions={{ enableHighAccuracy: true, timeout: 10_000 }}
        fitBoundsOptions={{ maxZoom: 15 }}
      />

      {!onPick &&
        visible.map((p) => {
          const active = selectedPlaceId === p.id;
          const slug = categoriesById?.get(p.categoryId)?.slug ?? null;
          const Icon = iconForCategorySlug(slug);
          return (
            <Marker
              key={p.id}
              longitude={p.lng}
              latitude={p.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectPlace?.(p.id);
              }}
            >
              <span
                aria-label={p.name}
                className={
                  "flex -translate-y-1 cursor-pointer items-center justify-center rounded-full border-2 border-white shadow-md transition-all " +
                  (active
                    ? "h-11 w-11 bg-primary text-primary-foreground ring-4 ring-primary/30"
                    : "h-9 w-9 bg-primary text-primary-foreground")
                }
              >
                <Icon size={active ? 20 : 18} strokeWidth={2.25} aria-hidden />
              </span>
            </Marker>
          );
        })}

      {onPick && pick && (
        <Marker longitude={pick.lng} latitude={pick.lat} anchor="bottom">
          <span className="flex h-8 w-8 -translate-y-1 items-center justify-center rounded-full border-2 border-white bg-destructive text-destructive-foreground shadow-md">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="currentColor">
              <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" />
            </svg>
          </span>
        </Marker>
      )}
    </Map>
  );
}
