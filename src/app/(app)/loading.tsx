import { PageSkeleton } from "@/components/layout/PageSkeleton";

/**
 * Shared loading state for every (app) route. Next.js pops this in
 * Suspense while the server component for the next page renders, so
 * taps on the bottom nav give instant visual feedback. Per-route
 * loading.tsx files override this where a more specific shape helps
 * (e.g. /map wants a full-bleed skeleton, not a header + rows).
 */
export default function Loading() {
  return <PageSkeleton rows={4} />;
}
