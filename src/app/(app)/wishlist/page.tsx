import { redirect } from "next/navigation";

/**
 * Legacy route. Wishlist (Do odwiedzenia) is now a filter on the
 * /places list — kept as a permanent redirect so older bookmarks /
 * notification deeplinks / external mentions still resolve.
 */
export default function WishlistRedirect() {
  redirect("/places?set=wishlist");
}
