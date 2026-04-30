import { redirect } from "next/navigation";

/**
 * Legacy route — `/wishlist` and `/favorites` were merged into
 * `/saved` (with tabs) so the BottomNav could free a slot for the
 * Ranking tab. Kept as a permanent redirect so any bookmarks,
 * links from older PRs, or external mentions still land somewhere
 * sensible.
 */
export default function WishlistRedirect() {
  redirect("/saved?tab=wishlist");
}
