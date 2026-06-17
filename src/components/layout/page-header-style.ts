import type { CSSProperties } from "react";

/**
 * Shared chrome for the sticky top bar — used by both `PageHeader` (the
 * real bar) and `PageSkeleton` (its loading placeholder) so the two never
 * drift. Solid background (no backdrop-blur): View Transitions rasterize
 * the header into a snapshot during navigation, and backdrop-filter makes
 * that snapshot's text blurry.
 */
export const PAGE_HEADER_CLASS =
  "sticky top-0 z-30 flex items-center gap-2 border-b bg-background px-3 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]";

/**
 * Anchors the bar across route cross-fades + the Suspense reveal (see the
 * `site-header` rules in globals.css) so the back button + title stay put
 * instead of flickering/cross-fading.
 */
export const PAGE_HEADER_VT_STYLE: CSSProperties = {
  viewTransitionName: "site-header",
};
