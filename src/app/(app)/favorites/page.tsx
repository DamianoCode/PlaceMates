import { redirect } from "next/navigation";

/**
 * Legacy route. Favourites (Ulubione) is now a filter on the
 * /places list — kept as a permanent redirect so older bookmarks /
 * notification deeplinks / external mentions still resolve.
 */
export default function FavoritesRedirect() {
  redirect("/places?set=favorites");
}
