import { PageSkeleton } from "@/components/layout/PageSkeleton";

// Per-route boundary so tapping "Plany" gives an instant skeleton instead
// of waiting on the server render. See places/loading.tsx for the why.
export default function Loading() {
  return <PageSkeleton rows={4} />;
}
