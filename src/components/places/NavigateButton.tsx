"use client";

import { Navigation } from "lucide-react";

/**
 * Opens the user's installed maps app for turn-by-turn navigation.
 *
 * We use the Google Maps "directions" URL which is a universal handler:
 * on Android / iOS it deep-links to the Google Maps app (and iOS Apple
 * Maps via the OS share sheet); on desktop it opens in a new tab.
 * Destination is lat,lng + place name — label survives the round-trip
 * to whichever app catches the URL.
 */
export function NavigateButton({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const dest = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&destination_place_id=&travelmode=driving`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Nawiguj do ${label}`}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Navigation size={16} />
      Nawiguj
    </a>
  );
}
