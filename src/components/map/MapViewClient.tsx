"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// MapLibre touches `window` at import time — dynamic + ssr:false keeps it
// out of the server bundle. Must live inside a Client Component in Next 15+.
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

export function MapViewClient(props: ComponentProps<typeof MapView>) {
  return <MapView {...props} />;
}
