/**
 * Duration for imperative (JS-driven) animations such as MapLibre's
 * flyTo. The global reduced-motion CSS rule can't reach these, so callers
 * pass their duration through here and get 0 when the user asked for less
 * motion — the camera still lands in the same place, just without the glide.
 */
export function motionDuration(ms: number): number {
  if (typeof window === "undefined") return ms;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}
