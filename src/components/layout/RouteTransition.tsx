"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Fades the page in on every route change. Keyed on the pathname so the
 * wrapper remounts (and the animation replays) whenever the user moves
 * between views — including card → detail (e.g. /places → /places/[id]),
 * which a route-group `template.tsx` would miss because the first
 * segment doesn't change.
 *
 * Deliberately does NOT remount on query-string changes: the map's
 * `?lat=&lng=` pan params and the places list's `history.replaceState`
 * filter updates keep the same pathname, so the map and list stay put
 * instead of flashing on every interaction.
 *
 * Opacity-only (see `pm-fade-view` in globals.css) — a transform here
 * would break the map's fixed overlays and the sticky header. The
 * global prefers-reduced-motion rule collapses the duration to ~0.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="pm-fade-view">
      {children}
    </div>
  );
}
