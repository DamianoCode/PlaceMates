import { PageSkeleton } from "@/components/layout/PageSkeleton";

/**
 * Per-route boundary so tapping "Miejsca" swaps to a skeleton instantly.
 * Without its own loading.tsx the segment falls back to (app)/loading.tsx,
 * which — being an already-resolved boundary — React keeps suspended
 * during the navigation transition instead of showing, so the tap felt
 * dead until the data arrived. A fresh per-segment boundary renders
 * immediately.
 */
export default function Loading() {
  return <PageSkeleton rows={6} />;
}
