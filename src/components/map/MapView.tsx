"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapLibreMap, {
  GeolocateControl,
  Marker,
  NavigationControl,
  type ViewState,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import type { Map as MLMap } from "maplibre-gl";
import { useTheme } from "next-themes";
import { getMapStyle } from "./map-style";
import { loadCamera, saveCamera } from "./camera-storage";
import { CategoryIcon } from "./category-icons";
import { useQuery } from "@tanstack/react-query";
import { MARKER_STAGGER_CAP_MS, MARKER_STAGGER_MS } from "@/lib/constants";
import { fetchJson } from "@/lib/fetch-json";
import type { PlaceMarker } from "@/domain/places/service";

type PlacePin = PlaceMarker;

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
  // back to a TanStack Query fetch so the component stays embeddable.
  const { data: fetched } = useQuery({
    queryKey: ["map-places"],
    enabled: !onPick && !placesProp,
    queryFn: () => fetchJson<{ places: PlacePin[] }>("/api/places"),
    staleTime: 30_000,
  });
  const places = useMemo(
    () => placesProp ?? fetched?.places ?? [],
    [placesProp, fetched],
  );
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

  // Hold the underlying maplibre instance so we can attach native touch
  // listeners (long-press) — react-map-gl only forwards a fixed set of
  // events and `contextmenu` doesn't fire on mobile webkit. State, not
  // ref, so an effect can run when the map finally loads.
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);

  // After a long-press fires we get a synthetic click on the same spot.
  // Without this flag, that click would clear the selection or, in
  // pick-mode, drop a pin where the user only meant to long-press.
  const suppressNextClick = useRef(false);

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

  // Intentionally no auto-trigger: the map opens at the last camera
  // position (from localStorage) and stays put until the user explicitly
  // taps the locate button. Previous behaviour snapped the viewport to
  // the user's GPS on every mount, which fought with the camera
  // persistence and felt jumpy.
  const handleLoad = useCallback(
    (e: { target: MLMap }) => {
      const map = e.target;
      setMapInstance(map);

      // Hide the basemap's own POI / transit pictograms. With our
      // category markers on top they'd otherwise create visual
      // clutter — two cafés stacked, a tiny grey OSM cup beside our
      // big orange one. No-op for raster providers (Carto): they
      // expose only the single raster layer, none match the prefixes.
      for (const layer of map.getStyle().layers) {
        if (
          layer.id.startsWith("poi") ||
          layer.id.startsWith("transit-stop")
        ) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }

      if (onBoundsChange) {
        const b = map.getBounds();
        onBoundsChange({
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        });
      }
    },
    [onBoundsChange],
  );

  // Mobile long-press → onContextMenu. Maplibre doesn't fire a
  // `contextmenu` event on touchscreen webkit, so we time it ourselves
  // off raw touch events and convert pixel → lng/lat with `unproject`.
  // Cancels on movement (panning) and second-finger touch (pinch).
  useEffect(() => {
    const map = mapInstance;
    if (!map) return;
    if (!onContextMenu || onPick) return;

    const HOLD_MS = 500;
    const MOVE_TOLERANCE_PX = 10;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;

    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        // Pinch / multi-touch — bail.
        cancel();
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      cancel();
      timer = setTimeout(() => {
        timer = null;
        // Convert client px → map container px → lng/lat.
        const rect = map.getCanvasContainer().getBoundingClientRect();
        const px = startX - rect.left;
        const py = startY - rect.top;
        const lngLat = map.unproject([px, py]);
        suppressNextClick.current = true;
        // Light haptic nudge so the gesture feels confirmed. Silently
        // unsupported on iOS Safari and any non-secure context.
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(40);
          } catch {
            // ignore
          }
        }
        onContextMenu({ lng: lngLat.lng, lat: lngLat.lat });
      }, HOLD_MS);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!timer) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) {
        cancel();
      }
    };

    const container = map.getCanvasContainer();
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", cancel, { passive: true });
    container.addEventListener("touchcancel", cancel, { passive: true });

    return () => {
      cancel();
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", cancel);
      container.removeEventListener("touchcancel", cancel);
    };
  }, [mapInstance, onContextMenu, onPick]);

  const visible = useMemo(() => {
    let out = places;
    if (categoryFilter) out = out.filter((p) => p.categoryId === categoryFilter);
    if (restrictToIds) out = out.filter((p) => restrictToIds.has(p.id));
    // Dedupe markers by canonical place — when two groups have added the
    // same POI, they share a canonical_place_id and should render as one
    // pin. Local pin-drops (no canonical) always use their own id so they
    // never collapse across groups.
    const byKey = new Map<string, PlacePin>();
    for (const p of out) {
      const key = p.canonicalPlaceId ?? `local:${p.id}`;
      if (!byKey.has(key)) byKey.set(key, p);
    }
    return Array.from(byKey.values());
  }, [places, categoryFilter, restrictToIds]);

  return (
    <MapLibreMap
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
        // Mobile long-press dispatches a synthetic click on touchend;
        // swallow that one so we don't drop a pin / clear selection
        // immediately after the user invoked the context menu.
        if (suppressNextClick.current) {
          suppressNextClick.current = false;
          return;
        }
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
      {/* One-shot center-on-me. No trackUserLocation — the map stops
       *  re-centering once it's snapped to the user, letting them pan
       *  freely. Tapping the button again re-centers on demand. */}
      <GeolocateControl
        position="top-right"
        showUserLocation
        showAccuracyCircle
        positionOptions={{ enableHighAccuracy: true, timeout: 10_000 }}
        fitBoundsOptions={{ maxZoom: 15 }}
      />

      {!onPick &&
        visible.map((p, i) => {
          const active = selectedPlaceId === p.id;
          const slug = categoriesById?.get(p.categoryId)?.slug ?? null;
          // Tiny stagger so a filter change cascades a wave across the
          // viewport instead of all pins popping in at once. Capped at
          // 240 ms total so it never feels slow.
          const delay = Math.min(i * MARKER_STAGGER_MS, MARKER_STAGGER_CAP_MS);
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
                  "flex -translate-y-1 cursor-pointer items-center justify-center rounded-full border-2 border-white shadow-md transition-[width,height,box-shadow] duration-200 ease-out " +
                  (active
                    ? "h-11 w-11 bg-primary text-primary-foreground ring-4 ring-primary/30"
                    : "h-9 w-9 bg-primary text-primary-foreground")
                }
                style={{
                  animation: `pm-marker-in 320ms ${delay}ms cubic-bezier(0.2, 0.9, 0.25, 1.05) both`,
                }}
              >
                <CategoryIcon
                  slug={slug}
                  size={active ? 20 : 18}
                  strokeWidth={2.25}
                  aria-hidden
                />
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
    </MapLibreMap>
  );
}
