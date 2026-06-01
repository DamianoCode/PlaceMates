"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  Check,
  ChevronDown,
  ListFilter,
  Loader2,
  Locate,
  Map as MapIcon,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { bulkImportAction } from "@/app/(app)/places/import-actions";
import { fetchJson, HttpError } from "@/lib/fetch-json";

export type ImportCategory = { id: string; slug: string; name: string };

type NearbyResult = {
  provider: "osm" | "geoapify";
  externalId: string;
  osmId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  categoryHint: string;
};

type Bbox = { west: number; south: number; east: number; north: number };

type SortBy = "distance" | "name";
type SortDir = "asc" | "desc";

/**
 * Bottom drawer for "Find places nearby". Multi-category — toggle as
 * many pills as you want, hit Szukaj. Server picks the richer source
 * (Geoapify Places when GEOAPIFY_API_KEY is set, Overpass otherwise)
 * and returns a unified shape; the client doesn't care which.
 *
 * Results show distance from the search center and can be sorted by
 * distance or name. Import is auto-routed: each picked POI lands in
 * the user-group category that matches its `categoryHint`, so a single
 * "Add" run can spawn cafés in your "Cafe" category and viewpoints in
 * your "Viewpoint" category without an explicit picker per row.
 *
 * Built on Vaul — swipe-to-dismiss, focus trap, scroll lock for free.
 */
export function NearbyImportSheet({
  open,
  onClose,
  groupId,
  categories,
  getBbox,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  categories: ImportCategory[];
  getBbox: () => Bbox | null;
}) {
  // Toggled category slugs the user wants to query.
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  // Snapshot of the search params at the moment the user clicked Szukaj.
  const [search, setSearch] = useState<{
    slugs: string[];
    bbox: Bbox;
    center: { lat: number; lng: number };
  } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>("distance");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [submitting, setSubmitting] = useState(false);
  // GPS reference for distance / sort. Null until either the browser
  // has no geolocation API, the user denied permission, or the request
  // times out — in those cases we fall back to the search bbox centre.
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  // User-controlled override of the distance reference. "gps" prefers
  // userPos when available; "map" forces bbox centre even when GPS
  // exists (useful when planning a trip from elsewhere).
  const [distanceSource, setDistanceSource] = useState<"gps" | "map">("gps");
  // Light "asking for location now" indicator so toggling to GPS
  // while permission is still being prompted has a visible state.
  const [requestingPos, setRequestingPos] = useState(false);
  // The category pills are bulky; once a search runs we collapse them
  // into a one-line summary so the results list gets the full height.
  // Tapping the summary re-expands the picker to change the selection.
  const [showCategoryPicker, setShowCategoryPicker] = useState(true);
  // Free-text filter applied client-side over the fetched results — the
  // fast way to find one place in a long list without re-querying.
  const [filterText, setFilterText] = useState("");
  // Scroll container for the virtualized results list.
  const listRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Shared geolocation request — used both on drawer open (silent) and
  // when the user explicitly toggles to GPS after a previous denial.
  function requestUserPos(opts: { silent: boolean }) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      if (!opts.silent) toast.error("Lokalizacja nieobsługiwana w tej przeglądarce.");
      return;
    }
    setRequestingPos(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRequestingPos(false);
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setRequestingPos(false);
        if (!opts.silent) {
          toast.error("Brak dostępu do lokalizacji.");
        }
      },
      { maximumAge: 5 * 60_000, timeout: 4_000, enableHighAccuracy: false },
    );
  }

  // Ask the browser for the user's current position once on drawer
  // open. Silent — denial dismisses cleanly; the user can still
  // explicitly request GPS later via the source toggle. Deferred
  // through queueMicrotask so the React-compiler set-state-in-effect
  // rule is satisfied.
  useEffect(() => {
    if (!open) return;
    let abort = false;
    queueMicrotask(() => {
      if (!abort) requestUserPos({ silent: true });
    });
    return () => {
      abort = true;
    };
  }, [open]);

  const {
    data: searchData,
    isFetching: loading,
    error: searchError,
  } = useQuery({
    queryKey: [
      "nearby-import",
      search?.slugs.slice().sort().join(","),
      search?.bbox.west,
      search?.bbox.south,
      search?.bbox.east,
      search?.bbox.north,
    ],
    enabled: search !== null,
    queryFn: () => {
      const { slugs, bbox } = search!;
      const bboxParam = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
      return fetchJson<{ results: NearbyResult[] }>(
        `/api/nearby?categories=${encodeURIComponent(slugs.join(","))}&bbox=${bboxParam}`,
      );
    },
    // POIs are effectively static during a trip, so cache aggressively:
    // re-searching the same area + categories (the common case — close
    // the drawer, reopen, search again) is served from memory with no
    // network call. The query key already keys on slugs + bbox, so a
    // genuinely different area still fetches.
    staleTime: 30 * 60_000, // 30 min "fresh" — no refetch within the window
    gcTime: 60 * 60_000, // keep the cached result an hour after unmount
    // Walking in and out of coverage on mobile must not re-fire the query.
    refetchOnReconnect: false,
    // Show the previous results while a new area loads instead of a blank
    // flash — smoother on a phone.
    placeholderData: keepPreviousData,
  });
  const rawResults = useMemo(() => searchData?.results ?? [], [searchData]);

  // Distance reference: user toggles between GPS and map centre.
  // "gps" still falls back to bbox centre while waiting for the
  // first GPS fix — better than rendering blank distances.
  const distanceRef = useMemo(() => {
    if (distanceSource === "gps") return userPos ?? search?.center ?? null;
    return search?.center ?? null;
  }, [distanceSource, userPos, search]);

  // Distances + sort, recomputed only when results or reference or
  // sort change.
  const results = useMemo(() => {
    const withDistance = rawResults.map((r) => ({
      ...r,
      distanceM: distanceRef ? haversineMeters(distanceRef, r) : null,
    }));
    const dirSign = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") {
      withDistance.sort(
        (a, b) =>
          dirSign *
          a.name.localeCompare(b.name, "pl", { sensitivity: "base" }),
      );
    } else {
      withDistance.sort(
        (a, b) => dirSign * ((a.distanceM ?? 0) - (b.distanceM ?? 0)),
      );
    }
    return withDistance;
  }, [rawResults, distanceRef, sortBy, sortDir]);

  // Client-side name/address filter over the sorted results.
  const visibleResults = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return results;
    return results.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.address?.toLowerCase().includes(q) ?? false),
    );
  }, [results, filterText]);

  // Virtualize the list — with up to 300 hits, rendering every row is
  // wasteful and janky. Mirrors the AddStopsButton pattern.
  const virtualizer = useVirtualizer({
    count: visibleResults.length,
    getScrollElement: () => listRef.current,
    // Row ≈ 64 px (py-3 + name + meta line); the virtualizer remeasures
    // actual heights via measureElement, this is just the seed.
    estimateSize: () => 64,
    overscan: 8,
  });

  // Stable toggle so each memoized row only re-renders when its own
  // checked state flips (not on every selection change).
  const toggleResult = useCallback((key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // "Select all" and the toolbar label operate on the *visible* (filtered)
  // rows, so the action matches what the user can actually see.
  const allVisibleChecked =
    visibleResults.length > 0 &&
    visibleResults.every((r) => checked.has(resultKey(r)));

  // Slug → display name, memoized so each virtual row resolves its
  // category label in O(1) instead of a linear `.find` per render.
  const categoryNameBySlug = useMemo(
    () => new Map(categories.map((c) => [c.slug, c.name])),
    [categories],
  );

  // Pre-check all on a fresh response. Defer with queueMicrotask so
  // the React-compiler set-state-in-effect rule is satisfied.
  useEffect(() => {
    if (!searchData) return;
    let abort = false;
    queueMicrotask(() => {
      if (!abort) {
        setChecked(
          new Set(searchData.results.map((r) => resultKey(r))),
        );
      }
    });
    return () => {
      abort = true;
    };
  }, [searchData]);

  // Surface upstream errors as toasts.
  useEffect(() => {
    if (!searchError) return;
    if (searchError instanceof HttpError && searchError.status === 400) {
      toast.error("Obszar mapy jest zbyt duży.");
    } else {
      toast.error("Nie udało się pobrać miejsc.");
    }
  }, [searchError]);

  // Reset everything when the drawer closes so reopening is clean.
  useEffect(() => {
    if (open) return;
    let abort = false;
    queueMicrotask(() => {
      if (abort) return;
      setSelectedSlugs(new Set());
      setSearch(null);
      setChecked(new Set());
      setSortBy("distance");
      setSortDir("asc");
      setUserPos(null);
      setDistanceSource("gps");
      setRequestingPos(false);
      setShowCategoryPicker(true);
      setFilterText("");
    });
    return () => {
      abort = true;
    };
  }, [open]);

  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function runSearch() {
    if (selectedSlugs.size === 0) {
      toast.error("Wybierz co najmniej jedną kategorię.");
      return;
    }
    const bbox = getBbox();
    if (!bbox) {
      toast.error("Nie udało się odczytać obszaru mapy.");
      return;
    }
    const center = {
      lat: (bbox.south + bbox.north) / 2,
      lng: (bbox.west + bbox.east) / 2,
    };
    setSearch({ slugs: Array.from(selectedSlugs), bbox, center });
    setChecked(new Set());
    setFilterText("");
    // Hand the screen over to the results — the picker folds into a
    // summary bar the user can tap to change the selection.
    setShowCategoryPicker(false);
  }

  async function doImport() {
    if (checked.size === 0) return;
    const picked = results.filter((r) => checked.has(resultKey(r)));

    // Group by app-category derived from the result's categoryHint.
    // POIs whose hint can't be mapped (rare) fall back to the first
    // toggled category, so they still land somewhere reasonable.
    const fallbackCat =
      categories.find((c) => selectedSlugs.has(c.slug)) ?? categories[0];
    const groups = new Map<string, typeof picked>();
    for (const r of picked) {
      const slug = hintToOurSlug(r.categoryHint) ?? fallbackCat?.slug;
      const cat = slug ? categories.find((c) => c.slug === slug) : null;
      const targetId = cat?.id ?? fallbackCat?.id;
      if (!targetId) continue;
      const list = groups.get(targetId) ?? [];
      list.push(r);
      groups.set(targetId, list);
    }
    if (groups.size === 0) {
      toast.error("Nie udało się dopasować kategorii do wyników.");
      return;
    }

    setSubmitting(true);
    let inserted = 0;
    let skipped = 0;
    let firstError: string | null = null;
    for (const [categoryId, items] of groups) {
      const result = await bulkImportAction({
        groupId,
        categoryId,
        items: items.map((r) => ({
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          address: r.address,
          provider: r.provider,
          externalId: r.externalId,
          // Legacy alias — kept so older callers keep working.
          osmId: r.provider === "osm" ? r.externalId : null,
        })),
      });
      if (!result.ok) {
        firstError ??= result.error;
        continue;
      }
      inserted += result.inserted;
      skipped += result.skipped;
    }
    setSubmitting(false);

    if (firstError && inserted === 0) {
      toast.error(firstError);
      return;
    }
    toast.success(
      `Dodano ${inserted} miejsc${
        skipped > 0 ? ` · pominięto ${skipped} już dodanych` : ""
      }.`,
    );
    onClose();
    router.refresh();
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-3xl border-t border-x bg-background outline-none pb-[env(safe-area-inset-bottom)] sm:mx-auto sm:max-w-2xl",
            // Compact while picking categories; near-full-height once
            // results arrive so the list has room to breathe.
            search ? "h-[92dvh]" : "max-h-[85dvh]",
          )}
          aria-describedby={undefined}
        >
          <Drawer.Handle className="my-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted" />

          <div className="flex items-start justify-between border-b px-4 pb-3">
            <div className="min-w-0">
              <Drawer.Title className="font-display text-xl leading-tight">
                Znajdź w okolicy
              </Drawer.Title>
              <Drawer.Description className="text-xs italic text-muted-foreground">
                {search
                  ? "Zaznacz miejsca i dodaj do swojej listy"
                  : "Zaznacz kategorie i wciśnij Szukaj"}
              </Drawer.Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij"
              className="-mr-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Category picker — full pill grid while choosing; folds into
           *  a one-line summary once a search runs so the results list
           *  reclaims the vertical space. */}
          {showCategoryPicker ? (
          <div className="border-b p-3">
            <ul className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const active = selectedSlugs.has(c.slug);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggleSlug(c.slug)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex h-9 items-center rounded-full px-3 text-xs font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                          : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {c.name}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  // Toggle: if every category is already selected,
                  // clear them all; otherwise select every available
                  // category. Single tap for the "show me everything
                  // interesting" use case without forcing a hunt
                  // through pills.
                  const allSlugs = categories.map((c) => c.slug);
                  setSelectedSlugs(
                    selectedSlugs.size === allSlugs.length
                      ? new Set()
                      : new Set(allSlugs),
                  );
                }}
                className="inline-flex h-9 items-center rounded-full px-3 text-[11px] font-medium text-primary hover:bg-primary/10"
              >
                {selectedSlugs.size === categories.length
                  ? "Odznacz wszystkie"
                  : "Zaznacz wszystkie"}
              </button>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {selectedSlugs.size === 0
                    ? "Brak wyboru."
                    : `Wybrano ${selectedSlugs.size}.`}
                </p>
                <button
                  type="button"
                  onClick={runSearch}
                  disabled={loading || selectedSlugs.size === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  Szukaj
                </button>
              </div>
            </div>
          </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCategoryPicker(true)}
              className="flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <ListFilter size={15} className="text-primary" />
                {search?.slugs.length ?? 0}{" "}
                {(search?.slugs.length ?? 0) === 1 ? "kategoria" : "kategorie"}
                <span className="font-normal text-muted-foreground">
                  · zmień wybór
                </span>
              </span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
          )}

          {/* Results panel. Hidden until the user runs a search. */}
          {search && (
            <>
              {/* Two-row toolbar on mobile: count + select-all on top,
               *  sort + source toggle below. The original single-row
               *  layout was too dense on phone widths — buttons were
               *  ~24 px tall and pressed shoulder-to-shoulder. Each
               *  control is now h-9 with comfortable padding. On ≥sm
               *  the bottom row ungrows to sit alongside the count. */}
              <div className="flex flex-col gap-2 border-b px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {loading
                      ? "Szukam…"
                      : results.length === 0
                        ? "Brak wyników w widocznym obszarze."
                        : visibleResults.length === 0
                          ? "Brak dopasowań do filtra."
                          : filterText.trim()
                            ? `${visibleResults.length} z ${results.length}`
                            : `${results.length} ${results.length === 1 ? "wynik" : "wyników"}`}
                  </span>
                  {visibleResults.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        // Merge with existing selection so filtering then
                        // "select all" never clobbers hidden picks.
                        setChecked((prev) => {
                          const next = new Set(prev);
                          for (const r of visibleResults) {
                            const k = resultKey(r);
                            if (allVisibleChecked) next.delete(k);
                            else next.add(k);
                          }
                          return next;
                        })
                      }
                      className="inline-flex h-9 items-center rounded-full px-3 font-medium text-primary hover:bg-primary/10"
                    >
                      {allVisibleChecked ? "Odznacz" : "Zaznacz"} wszystkie
                    </button>
                  )}
                </div>

                {results.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSortBy((s) =>
                            s === "distance" ? "name" : "distance",
                          )
                        }
                        aria-label="Zmień kryterium sortowania"
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {sortBy === "distance" ? (
                          <>
                            <MapPin size={14} />
                            Odległość
                          </>
                        ) : (
                          <>
                            <ArrowDownAZ size={14} />
                            Nazwa
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                        }
                        aria-label={
                          sortDir === "asc"
                            ? "Sortuj malejąco"
                            : "Sortuj rosnąco"
                        }
                        title={
                          sortBy === "distance"
                            ? sortDir === "asc"
                              ? "Od najbliższych"
                              : "Od najdalszych"
                            : sortDir === "asc"
                              ? "A → Z"
                              : "Z → A"
                        }
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {sortDir === "asc" ? (
                          <ArrowDown size={14} />
                        ) : (
                          <ArrowUp size={14} />
                        )}
                      </button>
                    </div>

                    {sortBy === "distance" && (
                      <div
                        role="group"
                        aria-label="Skąd liczyć odległość"
                        className="inline-flex h-9 items-center rounded-full border border-border bg-background p-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!userPos) requestUserPos({ silent: false });
                            setDistanceSource("gps");
                          }}
                          aria-pressed={distanceSource === "gps"}
                          title="Liczone od twojej lokalizacji"
                          className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-full px-3 font-medium uppercase tracking-wider transition-colors",
                            distanceSource === "gps"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {requestingPos && distanceSource === "gps" ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Locate size={12} />
                          )}
                          GPS
                        </button>
                        <button
                          type="button"
                          onClick={() => setDistanceSource("map")}
                          aria-pressed={distanceSource === "map"}
                          title="Liczone od środka widocznej mapy"
                          className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-full px-3 font-medium uppercase tracking-wider transition-colors",
                            distanceSource === "map"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <MapIcon size={12} />
                          Mapa
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Free-text filter — fixed above the scroll area so it
               *  stays put while the list scrolls. */}
              {results.length > 0 && (
                <div className="border-b px-3 py-2">
                  <div className="relative">
                    <Search
                      size={15}
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Filtruj wyniki po nazwie…"
                      aria-label="Filtruj wyniki"
                      className="h-9 w-full rounded-full border border-border bg-background pr-9 pl-9 text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    />
                    {filterText && (
                      <button
                        type="button"
                        onClick={() => setFilterText("")}
                        aria-label="Wyczyść filtr"
                        className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div ref={listRef} className="min-h-0 flex-1 overflow-auto">
                {loading && results.length === 0 && (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" />
                    Szukam…
                  </div>
                )}
                {!loading && results.length === 0 && (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    Nic nie znaleziono. Przesuń mapę albo zmień zestaw
                    kategorii i spróbuj ponownie.
                  </p>
                )}
                {!loading &&
                  results.length > 0 &&
                  visibleResults.length === 0 && (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      Brak dopasowań do „{filterText.trim()}”.
                    </p>
                  )}
                {visibleResults.length > 0 && (
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const r = visibleResults[virtualRow.index];
                      const key = resultKey(r);
                      // Resolve the row's group-category (the same slug
                      // doImport routes it to) so the user can tell what
                      // the place is at a glance in a mixed list.
                      const slug = hintToOurSlug(r.categoryHint);
                      const catName = slug
                        ? categoryNameBySlug.get(slug) ?? null
                        : null;
                      return (
                        <div
                          key={key}
                          ref={virtualizer.measureElement}
                          data-index={virtualRow.index}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <ResultRow
                            itemKey={key}
                            name={r.name}
                            address={r.address}
                            categoryName={catName}
                            // Per-row distance is only meaningful while we
                            // sort by it — the GPS/Map reference toggle is
                            // hidden in name-sort, so hide the number too.
                            distanceLabel={
                              sortBy === "distance" && r.distanceM !== null
                                ? formatDistance(r.distanceM)
                                : null
                            }
                            checked={checked.has(key)}
                            onToggle={toggleResult}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t bg-background px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {checked.size === 0
                    ? "Nic niewybrane."
                    : `Wybrano ${checked.size} z ${results.length}.`}
                </p>
                <button
                  type="button"
                  disabled={submitting || checked.size === 0}
                  onClick={doImport}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm disabled:opacity-50"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Dodaj wybrane
                  {checked.size > 0 && ` (${checked.size})`}
                </button>
              </div>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function resultKey(r: NearbyResult): string {
  return `${r.provider}:${r.externalId}`;
}

/**
 * One result row. Memoised so toggling a single selection only
 * re-renders that row, not all (up to 300) virtualized siblings —
 * `onToggle` is a stable callback from the parent and every other prop
 * is primitive.
 */
const ResultRow = memo(function ResultRow({
  itemKey,
  name,
  address,
  categoryName,
  distanceLabel,
  checked,
  onToggle,
}: {
  itemKey: string;
  name: string;
  address: string | null;
  categoryName: string | null;
  distanceLabel: string | null;
  checked: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(itemKey)}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors",
        checked ? "bg-primary/10" : "hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border",
        )}
        aria-hidden
      >
        {checked && <Check size={14} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          {distanceLabel && (
            <span className="flex-shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
              {distanceLabel}
            </span>
          )}
        </div>
        {(categoryName || address) && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {categoryName && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-primary">
                {categoryName}
              </span>
            )}
            {address && <span className="min-w-0 truncate">{address}</span>}
          </p>
        )}
      </div>
    </button>
  );
});

/**
 * OSM tag value or Geoapify dotted category → our app slug. Both
 * shapes funnel through the same lookup; for Geoapify we take the
 * leaf of the dot-path. Returning null lets the caller fall back to
 * the first selected category.
 */
function hintToOurSlug(hint: string): string | null {
  if (!hint) return null;
  const leaf = hint.includes(".") ? hint.split(".").pop()! : hint;
  const map: Record<string, string> = {
    cafe: "cafe",
    restaurant: "restaurant",
    ice_cream: "ice-cream",
    bakery: "bakery",
    viewpoint: "viewpoint",
    peak: "viewpoint",
    cliff: "viewpoint",
    waterfall: "viewpoint",
    tower: "viewpoint",
    attraction: "attraction",
    sights: "attraction",
    museum: "attraction",
    artwork: "attraction",
    castle: "attraction",
    ruins: "attraction",
    monument: "attraction",
    memorial: "attraction",
    archaeological_site: "attraction",
    lighthouse: "attraction",
    fountain: "attraction",
    clock: "attraction",
    // Places of worship — both the OSM `place_of_worship` value and the
    // Geoapify leaves (church, cathedral, …) route to our sights bucket.
    place_of_worship: "attraction",
    church: "attraction",
    cathedral: "attraction",
    chapel: "attraction",
    basilica: "attraction",
    mosque: "attraction",
    synagogue: "attraction",
    temple: "attraction",
    shrine: "attraction",
    park: "park",
    nature_reserve: "park",
    protected_area: "park",
    forest: "park",
    beach: "beach",
    bar: "bar",
    pub: "bar",
    hotel: "accommodation",
    hostel: "accommodation",
    guest_house: "accommodation",
  };
  return map[leaf.toLowerCase()] ?? null;
}

/** Haversine distance in metres between two lat/lng points. */
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371_000; // earth radius in metres
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const dφ = ((b.lat - a.lat) * Math.PI) / 180;
  const dλ = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  if (m < 10_000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}
