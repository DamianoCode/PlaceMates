"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useState } from "react";
import Map, { Marker, NavigationControl, type ViewState } from "react-map-gl/maplibre";
import { useRouter } from "next/navigation";
import { getMapStyle } from "./map-style";

type PlacePin = { id: string; name: string; lat: number; lng: number; categoryId: string };

const DEFAULT_VIEW: Partial<ViewState> = {
  longitude: 21.0122, // Warsaw
  latitude: 52.2297,
  zoom: 11,
};

export function MapView({
  initial,
  onPick,
}: {
  initial?: Partial<ViewState>;
  /** When set, the map is in "pick a location" mode — tap sets pin. */
  onPick?: (lnglat: { lng: number; lat: number }) => void;
}) {
  const router = useRouter();
  const [places, setPlaces] = useState<PlacePin[]>([]);
  const [view, setView] = useState<Partial<ViewState>>({ ...DEFAULT_VIEW, ...initial });
  const [pick, setPick] = useState<{ lng: number; lat: number } | null>(null);
  const style = useMemo(() => getMapStyle(false), []);

  // Fetch all user places once on mount. Good enough for MVP; bbox paging
  // kicks in once datasets grow past a few thousand.
  useEffect(() => {
    if (onPick) return; // pick mode: no markers needed
    let abort = false;
    fetch("/api/places")
      .then((r) => (r.ok ? r.json() : { places: [] }))
      .then((data: { places: PlacePin[] }) => {
        if (!abort) setPlaces(data.places ?? []);
      })
      .catch(() => {});
    return () => {
      abort = true;
    };
  }, [onPick]);

  return (
    <Map
      {...view}
      onMove={(e) => setView(e.viewState)}
      onClick={(e) => {
        if (!onPick) return;
        const { lng, lat } = e.lngLat;
        setPick({ lng, lat });
        onPick({ lng, lat });
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={style}
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="top-right" />

      {!onPick &&
        places.map((p) => (
          <Marker
            key={p.id}
            longitude={p.lng}
            latitude={p.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              router.push(`/places/${p.id}`);
            }}
          >
            <span
              aria-label={p.name}
              className="flex h-8 w-8 -translate-y-1 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow-md"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="currentColor">
                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
              </svg>
            </span>
          </Marker>
        ))}

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
