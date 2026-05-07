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
import Supercluster from "supercluster";
import { getMapStyle } from "./map-style";
import { loadCamera, saveCamera } from "./camera-storage";
import { CategoryIcon } from "./category-icons";
import { useQuery } from "@tanstack/react-query";
import {
  MAP_CLUSTER_MAX_ZOOM,
  MAP_CLUSTER_MIN_POINTS,
  MAP_CLUSTER_RADIUS_PX,
  MARKER_STAGGER_CAP_MS,
  MARKER_STAGGER_MS,
} from "@/lib/constants";
import { fetchJson } from "@/lib/fetch-json";
import type { PlaceMarker } from "@/domain/places/service";

type PlacePin = PlaceMarker;
type Bbox = { west: number; south: number; east: number; north: number };

const DEFAULT_VIEW: Partial<ViewState> = {
  longitude: 21.0122, // Warsaw
  latitude: 52.2297,
  zoom: 11,
};

/**
 * Visual state of a place marker — drives the pin colour. Mirrors the
 * card icons (Heart=rose, Bookmark+Users=primary) so the map and the
 * list speak the same colour language.
 *
 * Hierarchy when a place hits multiple states: favourite > wishlist >
 * default. We pick the strongest emotional signal and let the card's
 * icon row carry the rest.
 */
type PinState = "favorite" | "wishlist" | "default";

function pinClassesFor(state: PinState, active: boolean): string {
  const base =
    "flex -translate-y-1 cursor-pointer items-center justify-center rounded-full border-2 border-white shadow-md transition-[width,height,box-shadow] duration-200 ease-out";
  const size = active ? "h-11 w-11" : "h-9 w-9";
  switch (state) {
    case "favorite":
      return `${base} ${size} bg-rose-500 text-white${active ? " ring-4 ring-rose-500/30" : ""}`;
    case "wishlist":
      return `${base} ${size} bg-emerald-500 text-white${active ? " ring-4 ring-emerald-500/30" : ""}`;
    default:
      return `${base} ${size} bg-primary text-primary-foreground${active ? " ring-4 ring-primary/30" : ""}`;
  }
}

export function MapView({
  initial,
  onPick,
  initialPick,
  onSelectPlace,
  selectedPlaceId,
  categoryFilter,
  restrictToIds,
  favoriteIdSet,
  wishlistedIdSet,
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
  /**
   * Per-pin colour drivers. When a place id appears in `favoriteIdSet`
   * its marker turns rose; in `wishlistedIdSet` it turns emerald.
   * Both undefined keeps every marker on brand colour (legacy
   * behaviour for embed contexts that don't pass these).
   */
  favoriteIdSet?: Set<string>;
  wishlistedIdSet?: Set<string>;
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

  // Visible bounds — driven by the live map instance (`onMove` / `onLoad`
  // callbacks below mirror them into state). Initial null until first
  // render settles; clustering simply skips that frame.
  const [clusterBounds, setClusterBounds] = useState<Bbox | null>(null);

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
      // Mirror bounds into local state so the cluster query stays in
      // sync with what the user sees mid-pan. setState is cheap (React
      // batches), supercluster.getClusters is microseconds — re-running
      // every frame is fine for our scale.
      const b = e.target.getBounds();
      setClusterBounds({
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      });
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

      const b = map.getBounds();
      const bbox = {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      };
      // Seed cluster bounds so the first cluster query has something to
      // chew on — without this the map renders empty until the first
      // pan even when there are pins in the initial viewport.
      setClusterBounds(bbox);
      onBoundsChange?.(bbox);
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

  // Lookup table so cluster-resolved point ids can find their full
  // PlacePin (supercluster only carries the id in its feature properties
  // to keep the index lean — we'd otherwise duplicate the whole record).
  const pinsById = useMemo(
    () => new Map(visible.map((p) => [p.id, p])),
    [visible],
  );

  // Build the supercluster index from the deduped, filtered visible set.
  // Recomputed only when `visible` changes — pan/zoom are handled by
  // re-querying the index, not rebuilding it.
  type PinPointProps = { id: string };
  const clusterIndex = useMemo(() => {
    const index = new Supercluster<PinPointProps>({
      radius: MAP_CLUSTER_RADIUS_PX,
      maxZoom: MAP_CLUSTER_MAX_ZOOM,
      minPoints: MAP_CLUSTER_MIN_POINTS,
    });
    index.load(
      visible.map((p) => ({
        type: "Feature" as const,
        properties: { id: p.id },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      })),
    );
    return index;
  }, [visible]);

  // Resolved clusters + unclustered points for the current viewport.
  // Floor the zoom so a smooth zoom-in only re-clusters at integer
  // boundaries — keeps the count steady during fly-to animations
  // instead of flickering between cluster sizes mid-tween.
  const clusters = useMemo(() => {
    if (!clusterBounds) return [];
    const z = Math.floor(view.zoom ?? 11);
    return clusterIndex.getClusters(
      [
        clusterBounds.west,
        clusterBounds.south,
        clusterBounds.east,
        clusterBounds.north,
      ],
      z,
    );
  }, [clusterBounds, clusterIndex, view.zoom]);

  // Tap handler for cluster pills — zoom to the depth where the
  // cluster expands into smaller children (or individual pins if
  // we're close enough). Smooth flyTo so the user can follow what's
  // happening, not a teleport.
  const handleClusterClick = useCallback(
    (clusterId: number, lng: number, lat: number) => {
      if (!mapInstance) return;
      const expansionZoom = Math.min(
        clusterIndex.getClusterExpansionZoom(clusterId),
        MAP_CLUSTER_MAX_ZOOM + 1,
      );
      mapInstance.flyTo({
        center: [lng, lat],
        zoom: expansionZoom,
        duration: 400,
      });
    },
    [mapInstance, clusterIndex],
  );

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
        clusters.map((feature, i) => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties as
            | {
                cluster: true;
                cluster_id: number;
                point_count: number;
                point_count_abbreviated: string | number;
              }
            | (PinPointProps & { cluster?: false });

          // Cluster pill — count + tap-to-zoom. Size buckets keep the
          // glyph readable for "8" and "1.2k" alike without a font-size
          // calc on every render.
          if (props.cluster) {
            const count = props.point_count;
            const sizeClass =
              count >= 100 ? "h-12 w-12 text-base" : count >= 10 ? "h-11 w-11 text-sm" : "h-10 w-10 text-xs";
            return (
              <Marker
                key={`cluster-${props.cluster_id}`}
                longitude={lng}
                latitude={lat}
                anchor="center"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClusterClick(props.cluster_id, lng, lat);
                  }}
                  aria-label={`Skupisko ${count} miejsc — przybliż`}
                  className={
                    "flex cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary font-semibold text-primary-foreground shadow-md ring-4 ring-primary/20 transition-transform hover:scale-105 active:scale-[0.97] " +
                    sizeClass
                  }
                >
                  {props.point_count_abbreviated}
                </button>
              </Marker>
            );
          }

          // Single (unclustered) pin — drives the colour by the user's
          // attachment to the place. Stagger only here; clusters
          // popping in feels weird because they're aggregates, not
          // discrete arrivals.
          const pin = pinsById.get(props.id);
          if (!pin) return null;
          const active = selectedPlaceId === pin.id;
          const slug = categoriesById?.get(pin.categoryId)?.slug ?? null;
          const state: PinState = favoriteIdSet?.has(pin.id)
            ? "favorite"
            : wishlistedIdSet?.has(pin.id)
              ? "wishlist"
              : "default";
          const delay = Math.min(i * MARKER_STAGGER_MS, MARKER_STAGGER_CAP_MS);
          return (
            <Marker
              key={pin.id}
              longitude={pin.lng}
              latitude={pin.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectPlace?.(pin.id);
              }}
            >
              <span
                aria-label={pin.name}
                className={pinClassesFor(state, active)}
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
