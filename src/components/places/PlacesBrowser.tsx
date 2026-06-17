"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import {
  buildPlacesQueryString,
  placesQueryKey,
  type PlacesFilterState,
} from "@/lib/places/list-params";
import type { PlaceCard as PlaceCardData } from "@/domain/places/list-with-stats";
import { PlaceSearchInput } from "./PlaceSearchInput";
import { PlacesListShell } from "./PlacesListShell";
import { PlacesList } from "./PlacesList";

type Category = { id: string; name: string };
type GroupOption = { id: string; name: string };

/**
 * Client owner of the places list. Filters/sort/search live in local
 * state and refetch through `/api/places/list`, with TanStack Query
 * caching each filter combination — so re-applying a filter (or going
 * back/forward) is instant instead of a fresh server round-trip, and
 * `keepPreviousData` keeps the old list on screen (dimmed) while the
 * next one loads instead of flashing empty.
 *
 * The URL is kept in sync via the History API (no router navigation),
 * so the view stays shareable/refreshable without re-running the whole
 * server page on every pill click.
 */
export function PlacesBrowser({
  initialState,
  initialCards,
  categories,
  groupWishlistGroups,
}: {
  initialState: PlacesFilterState;
  initialCards: PlaceCardData[];
  categories: Category[];
  groupWishlistGroups: GroupOption[];
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PlacesFilterState>(initialState);

  // Seed the cache for the arrival view with the server's fresh snapshot
  // on mount, so a place added/edited/deleted elsewhere shows up the
  // moment the user navigates (back) to the list — without sacrificing
  // the instant cache for filters they revisit within the stale window.
  useEffect(() => {
    queryClient.setQueryData(placesQueryKey(initialState), initialCards);
    // Mount-only: the props are the SSR snapshot for this page render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isInitialView = useMemo(
    () =>
      JSON.stringify(placesQueryKey(state)) ===
      JSON.stringify(placesQueryKey(initialState)),
    [state, initialState],
  );

  const { data, isFetching } = useQuery({
    queryKey: placesQueryKey(state),
    queryFn: () =>
      fetchJson<{ places: PlaceCardData[] }>(
        `/api/places/list?${buildPlacesQueryString(state)}`,
      ).then((r) => r.places),
    // Show the previous list while the next one loads — no empty flash.
    placeholderData: keepPreviousData,
    // Only the arrival view is pre-filled from SSR; other filters fetch
    // on first visit, then stay cached.
    initialData: isInitialView ? initialCards : undefined,
  });

  const cards = data ?? [];

  const navigate = useCallback(
    (update: Partial<PlacesFilterState>) => {
      // Leaving the group-wishlist set clears the per-group narrow,
      // otherwise an orphan `group=...` would linger in the URL and
      // reapply the moment the user re-enters the group-wishlist pill.
      const effective: Partial<PlacesFilterState> = { ...update };
      if (update.set !== undefined && update.set !== "group-wishlist") {
        effective.groupWishlistGroupId = null;
      }
      const next = { ...state, ...effective };
      setState(next);
      const qs = buildPlacesQueryString(next);
      window.history.replaceState(null, "", qs ? `/places?${qs}` : "/places");
    },
    [state],
  );

  const handleSearch = useCallback(
    (q: string) => navigate({ q }),
    [navigate],
  );

  const activeGroupName =
    state.set === "group-wishlist" && state.groupWishlistGroupId
      ? (groupWishlistGroups.find((g) => g.id === state.groupWishlistGroupId)
          ?.name ?? null)
      : null;

  return (
    <>
      <PlaceSearchInput initialValue={initialState.q} onChange={handleSearch} />
      <PlacesListShell
        state={state}
        count={cards.length}
        categories={categories}
        groupWishlistGroups={groupWishlistGroups}
        isPending={isFetching}
        onNavigate={navigate}
      />

      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {emptyMessage(state, activeGroupName)}
        </p>
      ) : (
        // Dim the list while a refetch is in flight so the stale-data
        // swap reads as "loading" rather than a silent content jump.
        <div
          aria-busy={isFetching || undefined}
          className={cn(
            "transition-opacity duration-200",
            isFetching && "opacity-50",
          )}
        >
          <PlacesList cards={cards} />
        </div>
      )}
    </>
  );
}

function emptyMessage(
  state: PlacesFilterState,
  activeGroupName: string | null,
): string {
  if (state.q) return `Brak wyników dla „${state.q}".`;
  if (state.set === "wishlist") {
    return "Nic do odwiedzenia. Zaznacz miejsce zakładką w nagłówku jego widoku.";
  }
  if (state.set === "favorites") {
    return "Brak ulubionych. Zaznacz miejsce serduszkiem w nagłówku jego widoku.";
  }
  if (state.set === "group-wishlist") {
    return activeGroupName
      ? `Grupa „${activeGroupName}" nie ma jeszcze nic na wspólnej liście.`
      : "Wasza grupa nie ma jeszcze nic na wspólnej liście do odwiedzenia.";
  }
  if (state.category) return "Brak miejsc w tej kategorii.";
  return "Brak miejsc. Dodaj pierwsze z poziomu mapy.";
}
