import { ViewTransition } from "react";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export default function Loading() {
  return (
    <ViewTransition exit="slide-down" default="none">
      <PageSkeleton rows={2} withHero />
    </ViewTransition>
  );
}
