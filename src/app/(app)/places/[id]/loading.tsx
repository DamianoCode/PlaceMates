import { PageSkeleton } from "@/components/layout/PageSkeleton";

/** Place detail has a big hero image — match that shape so the
 *  skeleton doesn't jump as the real content streams in. */
export default function PlaceLoading() {
  return <PageSkeleton withHero rows={5} />;
}
