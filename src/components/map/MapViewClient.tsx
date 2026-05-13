"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

// MapLibre touches `window` at import time — dynamic + ssr:false keeps it
// out of the server bundle. Must live inside a Client Component in Next 15+.
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

/**
 * Jawne, wymienione propsy zamiast `{...props}` z `ComponentProps<typeof
 * MapView>`. Powód: `dynamic()` zwraca komponent o typie `ComponentType<{}>`,
 * więc `ComponentProps<typeof MapView>` zostaje pusty i TS nie wykryje
 * przypadkowego rozjazdu propsów w child. To samo wybuchło wcześniej
 * w `TripMapView` (tripId leciał undefined przez wrapper) — łatamy
 * preemptywnie żeby nie powtórzyć błędu tutaj.
 */
export function MapViewClient(props: MapViewProps) {
  return (
    <MapView
      initial={props.initial}
      onPick={props.onPick}
      initialPick={props.initialPick}
      onSelectPlace={props.onSelectPlace}
      selectedPlaceId={props.selectedPlaceId}
      categoryFilter={props.categoryFilter}
      restrictToIds={props.restrictToIds}
      favoriteIdSet={props.favoriteIdSet}
      wishlistedIdSet={props.wishlistedIdSet}
      groupWishlistedIdSet={props.groupWishlistedIdSet}
      onBoundsChange={props.onBoundsChange}
      onContextMenu={props.onContextMenu}
      categoriesById={props.categoriesById}
      places={props.places}
    />
  );
}
