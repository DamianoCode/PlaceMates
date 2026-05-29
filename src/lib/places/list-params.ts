import type {
  ListPlacesOptions,
  PlacesSetFilter,
  PlacesSortBy,
  PlacesSortDir,
} from "@/domain/places/list-with-stats";

/**
 * Normalized filter state for the places list. Single source of truth
 * shared by the server page (initial render), the `/api/places/list`
 * route (client refetches) and the client browser component — so the
 * three never drift on how a URL maps to a query.
 */
export type PlacesFilterState = {
  q: string;
  set: PlacesSetFilter | null;
  category: string | null;
  /** Only meaningful when `set === "group-wishlist"`. */
  groupWishlistGroupId: string | null;
  sortBy: PlacesSortBy;
  sortDir: PlacesSortDir;
};

export function parseSort(raw: string | undefined): PlacesSortBy {
  return raw === "name" || raw === "rating" ? raw : "recent";
}

export function parseDir(raw: string | undefined): PlacesSortDir {
  return raw === "asc" ? "asc" : "desc";
}

export function parseSet(raw: string | undefined): PlacesSetFilter | null {
  return raw === "wishlist" || raw === "favorites" || raw === "group-wishlist"
    ? raw
    : null;
}

/** Raw search params as they arrive from the URL (all optional strings). */
export type RawPlacesSearch = {
  q?: string;
  set?: string;
  category?: string;
  group?: string;
  sort?: string;
  dir?: string;
};

/**
 * Parse raw URL params into a normalized state. Category/group ids are
 * left as-is here; callers that have the user's valid category/group
 * lists narrow them defensively (a stale or copy-pasted id should not
 * resolve to someone else's data).
 */
export function parsePlacesSearch(raw: RawPlacesSearch): PlacesFilterState {
  const set = parseSet(raw.set);
  return {
    q: raw.q ?? "",
    set,
    category: raw.category ?? null,
    // `group` only applies inside the group-wishlist set.
    groupWishlistGroupId:
      set === "group-wishlist" && raw.group ? raw.group : null,
    sortBy: parseSort(raw.sort),
    sortDir: parseDir(raw.dir),
  };
}

/** Map UI filter state onto the service's query options. */
export function filterStateToOptions(
  state: PlacesFilterState,
): ListPlacesOptions {
  return {
    query: state.q || undefined,
    categoryId: state.category ?? undefined,
    setFilter: state.set ?? undefined,
    groupWishlistGroupId: state.groupWishlistGroupId ?? undefined,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };
}

/**
 * Serialize filter state to a query string (no leading "?"). Mirrors the
 * defaults the page applies so a default view yields a clean `/places`
 * URL and a shareable filtered view round-trips exactly.
 */
export function buildPlacesQueryString(state: PlacesFilterState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.set) params.set("set", state.set);
  if (state.category) params.set("category", state.category);
  if (state.set === "group-wishlist" && state.groupWishlistGroupId) {
    params.set("group", state.groupWishlistGroupId);
  }
  if (state.sortBy !== "recent") params.set("sort", state.sortBy);
  if (state.sortDir !== "desc") params.set("dir", state.sortDir);
  return params.toString();
}

/**
 * Stable, primitive-only React Query key for a filter state. Keeping it
 * flat lets TanStack structurally compare it cheaply across renders.
 */
export function placesQueryKey(state: PlacesFilterState) {
  return [
    "places-list",
    state.q,
    state.set,
    state.category,
    state.groupWishlistGroupId,
    state.sortBy,
    state.sortDir,
  ] as const;
}
