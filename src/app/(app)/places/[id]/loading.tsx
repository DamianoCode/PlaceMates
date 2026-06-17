import { ViewTransition } from "react";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

/** Place detail has a big hero image — match that shape so the
 *  skeleton doesn't jump as the real content streams in. The
 *  `exit="slide-down"` hands off to the page's `enter="slide-up"` so
 *  the content visibly arrives when the data resolves. */
export default function PlaceLoading() {
  return (
    <ViewTransition exit="slide-down" default="none">
      <PageSkeleton withHero rows={5} />
    </ViewTransition>
  );
}
