import { PageSkeleton } from "@/components/layout/PageSkeleton";

/** Place detail has a big hero image — match that shape so the
 *  skeleton doesn't jump as the real content streams in. */
export default function PlaceLoading() {
  // `heroVtName` names the skeleton's hero box so the morph from the tapped
  // list card lands here on the very first frame (before content streams).
  return <PageSkeleton withHero rows={5} heroVtName="place-hero" />;
}
