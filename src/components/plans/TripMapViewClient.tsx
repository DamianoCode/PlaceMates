"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// MapLibre touches `window` at import time — dynamic + ssr:false keeps
// it out of the server bundle. Mirrors the MapViewClient pattern.
const TripMapView = dynamic(
  () => import("./TripMapView").then((m) => m.TripMapView),
  {
    ssr: false,
    loading: () => (
      <div className="h-[calc(100dvh-180px)] w-full animate-pulse rounded-2xl bg-muted" />
    ),
  },
);

export function TripMapViewClient(
  props: ComponentProps<typeof TripMapView>,
) {
  return <TripMapView {...props} />;
}
