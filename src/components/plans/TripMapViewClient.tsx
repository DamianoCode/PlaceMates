"use client";

import dynamic from "next/dynamic";
import type { TripStopView } from "@/domain/trips/service";

// MapLibre touches `window` at import time — dynamic + ssr:false keeps
// it out of the server bundle. Mirrors the MapViewClient pattern.
//
// Props are forwarded explicitly (not via {...props} spread + inferred
// ComponentProps<typeof TripMapView>) because the inference path
// through `dynamic` was silently dropping `tripId` somewhere in dev
// — re-mount sequencing or stale-chunk weirdness. Explicit named
// forwarding is just as ergonomic and gives the type system a clear
// contract we can trust.
const TripMapView = dynamic(
  () => import("./TripMapView").then((m) => m.TripMapView),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[420px] h-[calc(100dvh-280px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-full animate-pulse rounded-2xl bg-muted" />
    ),
  },
);

export function TripMapViewClient({
  stops,
  tripId,
}: {
  stops: TripStopView[];
  tripId: string;
}) {
  return <TripMapView stops={stops} tripId={tripId} />;
}
