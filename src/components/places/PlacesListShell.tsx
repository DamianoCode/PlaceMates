"use client";

import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  Bookmark,
  Clock,
  Heart,
  Loader2,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PlacesSortBy,
  PlacesSortDir,
} from "@/domain/places/list-with-stats";
import type { PlacesFilterState } from "@/lib/places/list-params";

type Category = { id: string; name: string };
type GroupOption = { id: string; name: string };

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
 * Presentational filter controls for the places list — saved-set pills,
 * category pills, per-group narrow and the sort toggle.
 *
 * Controlled component: it renders `state` and reports every change up
 * through `onNavigate`. The parent (`PlacesBrowser`) owns the state,
 * updates the URL shallowly and refetches via TanStack Query — so a
 * filter click never triggers a full server navigation. `isPending`
 * reflects the in-flight query and drives the inline spinner.
 */
export function PlacesListShell({
  state,
  count,
  categories,
  groupWishlistGroups,
  isPending,
  onNavigate,
}: {
  state: PlacesFilterState;
  count: number;
  categories: Category[];
  /**
   * Groups the user belongs to. The per-group filter row is only
   * rendered when the `group-wishlist` set is active AND the user has
   * ≥2 groups (otherwise there's nothing to choose between).
   */
  groupWishlistGroups: GroupOption[];
  isPending: boolean;
  onNavigate: (update: Partial<PlacesFilterState>) => void;
}) {
  const activeSortMeta =
    SORT_OPTIONS.find((s) => s.value === state.sortBy) ?? SORT_OPTIONS[0];
  const nextSortBy: PlacesSortBy =
    state.sortBy === "recent"
      ? "name"
      : state.sortBy === "name"
        ? "rating"
        : "recent";

  return (
    <>
      {/* Saved-set filter row. Toggle: clicking the active pill clears it. */}
      <nav
        aria-label="Filtr zapisanych"
        className="flex gap-1.5 overflow-x-auto no-scrollbar"
      >
        <PillButton active={!state.set} onClick={() => onNavigate({ set: null })}>
          Wszystkie
        </PillButton>
        <PillButton
          active={state.set === "wishlist"}
          icon={<Bookmark size={12} />}
          onClick={() =>
            onNavigate({ set: state.set === "wishlist" ? null : "wishlist" })
          }
        >
          Do odwiedzenia
        </PillButton>
        <PillButton
          active={state.set === "favorites"}
          icon={<Heart size={12} />}
          onClick={() =>
            onNavigate({ set: state.set === "favorites" ? null : "favorites" })
          }
        >
          Ulubione
        </PillButton>
        <PillButton
          active={state.set === "group-wishlist"}
          icon={<Users size={12} />}
          onClick={() =>
            onNavigate({
              set: state.set === "group-wishlist" ? null : "group-wishlist",
            })
          }
        >
          Grupowo
        </PillButton>
      </nav>

      {categories.length > 0 && (
        <nav
          aria-label="Filtry kategorii"
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
        >
          <PillButton
            active={!state.category}
            onClick={() => onNavigate({ category: null })}
          >
            Wszystkie
          </PillButton>
          {categories.map((c) => (
            <PillButton
              key={c.id}
              active={state.category === c.id}
              onClick={() =>
                onNavigate({
                  category: state.category === c.id ? null : c.id,
                })
              }
            >
              {c.name}
            </PillButton>
          ))}
        </nav>
      )}

      {/* Per-group narrow appears only inside the group-wishlist set —
       *  the union view is the default for ≥2-group users, and clicking
       *  a group pill drills down. Solo-group users never see this row. */}
      {state.set === "group-wishlist" && groupWishlistGroups.length >= 2 && (
        <nav
          aria-label="Filtr grupy"
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
        >
          <PillButton
            active={!state.groupWishlistGroupId}
            onClick={() => onNavigate({ groupWishlistGroupId: null })}
          >
            Wszystkie grupy
          </PillButton>
          {groupWishlistGroups.map((g) => (
            <PillButton
              key={g.id}
              active={state.groupWishlistGroupId === g.id}
              onClick={() =>
                onNavigate({
                  groupWishlistGroupId:
                    state.groupWishlistGroupId === g.id ? null : g.id,
                })
              }
            >
              {g.name}
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
              onClick={() => onNavigate({ sortBy: nextSortBy })}
              aria-label="Zmień kryterium sortowania"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <activeSortMeta.icon size={14} />
              {activeSortMeta.label}
            </button>
            <button
              type="button"
              onClick={() =>
                onNavigate({
                  sortDir: state.sortDir === "asc" ? "desc" : "asc",
                })
              }
              aria-label={
                state.sortDir === "asc" ? "Sortuj malejąco" : "Sortuj rosnąco"
              }
              title={dirTitle(state.sortBy, state.sortDir)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {state.sortDir === "asc" ? (
                <ArrowUp size={14} />
              ) : (
                <ArrowDown size={14} />
              )}
            </button>
          </div>
        </div>
      )}
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

function dirTitle(sortBy: PlacesSortBy, dir: PlacesSortDir): string {
  if (sortBy === "name") return dir === "asc" ? "A → Z" : "Z → A";
  if (sortBy === "rating")
    return dir === "asc" ? "Od najniższych ocen" : "Od najwyższych ocen";
  return dir === "asc" ? "Od najstarszych" : "Od najnowszych";
}
