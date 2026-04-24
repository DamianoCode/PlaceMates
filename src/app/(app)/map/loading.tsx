/**
 * Map has no PageHeader and goes edge-to-edge, so its skeleton is a
 * full-bleed pulsing surface that matches the eventual map canvas.
 * Prevents the shared (app) skeleton from flashing with a header bar
 * before the map screen replaces it.
 */
export default function MapLoading() {
  return (
    <div className="relative h-[calc(100dvh-60px-env(safe-area-inset-bottom))] w-full animate-pulse bg-muted">
      {/* Ghosted pill row at the top to hint the filter bar. */}
      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
        <div className="h-10 w-60 rounded-full bg-background/50" />
      </div>
    </div>
  );
}
