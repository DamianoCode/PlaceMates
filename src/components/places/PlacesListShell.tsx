"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  Bookmark,
  Clock,
  Heart,
  Loader2,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PlacesSetFilter,
  PlacesSortBy,
  PlacesSortDir,
} from "@/domain/places/list-with-stats";

type Category = { id: string; name: string };

type State = {
  q: string;
  set: PlacesSetFilter | null;
  category: string | null;
  sortBy: PlacesSortBy;
  sortDir: PlacesSortDir;
};

const SORT_OPTIONS: {
  value: PlacesSortBy;
  label: string;
  icon: typeof Clock;
}[] = [
  { value: "recent", label: "Ostatnio dodane", icon: Clock },
  { value: "name", label: "Nazwa", icon: ArrowDownAZ },
  { value: "rating", label: "Ocena", icon: Star },
];

/**
 * Client-side wrapper around the filter pills, sort controls and the
 * RSC-rendered list. Two UX wins from going client here:
 *
 *   1. `useTransition` keeps the URL change non-blocking — clicks on
 *      pills don't freeze the UI while the server fetches the new
 *      RSC payload. The dim + spinner make the wait visible.
 *   2. `useOptimistic` flips the active pill immediately on click,
 *      *before* the server confirms — so the user sees their action
 *      reflected within a frame, instead of "did I miss-click?"
 *      uncertainty during a slow fetch.
 *
 * The list itself stays server-rendered and is passed in as `children`.
 * That keeps the data path simple (no client-side fetching) while still
 * giving us the responsive feel of an SPA.
 */
export function PlacesListShell({
  state,
  count,
  categories,
  children,
}: {
  state: State;
  count: number;
  categories: Category[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic<State, Partial<State>>(
    state,
    (current, update) => ({ ...current, ...update }),
  );

  function navigate(update: Partial<State>) {
    const next = { ...optimistic, ...update };
    startTransition(() => {
      applyOptimistic(update);
      router.replace(buildHref(next), { scroll: false });
    });
  }

  const activeSortMeta =
    SORT_OPTIONS.find((s) => s.value === optimistic.sortBy) ?? SORT_OPTIONS[0];
  const nextSortBy: PlacesSortBy =
    optimistic.sortBy === "recent"
      ? "name"
      : optimistic.sortBy === "name"
        ? "rating"
        : "recent";

  return (
    <>
      {/* Saved-set filter row. Toggle: clicking the active pill clears it. */}
      <nav
        aria-label="Filtr zapisanych"
        className="flex gap-1.5 overflow-x-auto no-scrollbar"
      >
        <PillButton
          active={!optimistic.set}
          onClick={() => navigate({ set: null })}
        >
          Wszystkie
        </PillButton>
        <PillButton
          active={optimistic.set === "wishlist"}
          icon={<Bookmark size={12} />}
          onClick={() =>
            navigate({
              set: optimistic.set === "wishlist" ? null : "wishlist",
            })
          }
        >
          Do odwiedzenia
        </PillButton>
        <PillButton
          active={optimistic.set === "favorites"}
          icon={<Heart size={12} />}
          onClick={() =>
            navigate({
              set: optimistic.set === "favorites" ? null : "favorites",
            })
          }
        >
          Ulubione
        </PillButton>
      </nav>

      {categories.length > 0 && (
        <nav
          aria-label="Filtry kategorii"
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
        >
          <PillButton
            active={!optimistic.category}
            onClick={() => navigate({ category: null })}
          >
            Wszystkie
          </PillButton>
          {categories.map((c) => (
            <PillButton
              key={c.id}
              active={optimistic.category === c.id}
              onClick={() =>
                navigate({
                  category: optimistic.category === c.id ? null : c.id,
                })
              }
            >
              {c.name}
            </PillButton>
          ))}
        </nav>
      )}

      {count > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {/* Spinner sits next to the count so the indicator is
             *  anchored to *something* the user is reading rather
             *  than floating in space. */}
            {isPending && <Loader2 size={12} className="animate-spin" />}
            {count} {count === 1 ? "miejsce" : "miejsc"}
          </span>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate({ sortBy: nextSortBy })}
              aria-label="Zmień kryterium sortowania"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <activeSortMeta.icon size={14} />
              {activeSortMeta.label}
            </button>
            <button
              type="button"
              onClick={() =>
                navigate({
                  sortDir: optimistic.sortDir === "asc" ? "desc" : "asc",
                })
              }
              aria-label={
                optimistic.sortDir === "asc"
                  ? "Sortuj malejąco"
                  : "Sortuj rosnąco"
              }
              title={dirTitle(optimistic.sortBy, optimistic.sortDir)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {optimistic.sortDir === "asc" ? (
                <ArrowUp size={14} />
              ) : (
                <ArrowDown size={14} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Dim the list while the server fetches the new payload. Pointer
       *  events stay enabled on the controls (rendered above) so the
       *  user can stack additional filter clicks while the previous
       *  navigation is still in flight. */}
      <div
        aria-busy={isPending || undefined}
        className={cn(
          "transition-opacity duration-200",
          isPending && "opacity-50",
        )}
      >
        {children}
      </div>
    </>
  );
}

function PillButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
          : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function buildHref(state: State): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.set) params.set("set", state.set);
  if (state.category) params.set("category", state.category);
  if (state.sortBy !== "recent") params.set("sort", state.sortBy);
  if (state.sortDir !== "desc") params.set("dir", state.sortDir);
  const qs = params.toString();
  return qs ? `/places?${qs}` : "/places";
}

function dirTitle(sortBy: PlacesSortBy, dir: PlacesSortDir): string {
  if (sortBy === "name") return dir === "asc" ? "A → Z" : "Z → A";
  if (sortBy === "rating")
    return dir === "asc" ? "Od najniższych ocen" : "Od najwyższych ocen";
  return dir === "asc" ? "Od najstarszych" : "Od najnowszych";
}

