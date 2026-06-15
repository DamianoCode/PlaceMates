"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Plus, Search, Sparkles } from "lucide-react";
import { plural } from "@/lib/plural";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { CategoryIcon } from "@/components/map/category-icons";
import { addStopsAction } from "@/app/(app)/plans/actions";
import type { AddableStopCandidate } from "@/domain/trips/service";

/**
 * Bulk-add stops to a trip. Vaul drawer with a virtualized,
 * debounced multi-select picker.
 *
 * Performance notes:
 *   - List is virtualized via `useVirtualizer` (only ~10–15 rows in
 *     the DOM at once). With 500-item lists the previous all-at-once
 *     `<ul>.map` had visible jank during typing — now flat regardless
 *     of group size.
 *   - Search query is debounced 120 ms via `useDebouncedValue` so a
 *     fast typer doesn't re-filter on every keystroke; the input
 *     itself stays uncontrolled-feeling thanks to the immediate
 *     local state update.
 *   - Row component is `memo`'d and the toggle callback is
 *     `useCallback`-stable, so flipping one selection only re-renders
 *     that one row — not all 500.
 *
 * Adding from /plans/[id] context only — `/places` stays
 * deliberately uncluttered for plain browsing. Multi-select lives
 * where it makes sense (when you're actively building a trip).
 *
 * Two visual variants for the trigger:
 *   - default → "+ Dodaj stopy" pill at the bottom of the stop list
 *   - hero    → big primary CTA card for the empty state
 */
export function AddStopsButton({
  tripId,
  candidates,
  variant = "default",
}: {
  tripId: string;
  candidates: AddableStopCandidate[];
  variant?: "default" | "hero";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  // Debounce so a fast typer doesn't trigger 10 filter passes
  // mid-word. 120 ms feels instant but cuts the work load.
  const debouncedQuery = useDebouncedValue(query, 120);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset on open — stale checkbox state from a previous session
  // never bleeds in. Defer to satisfy react-compiler.
  useEffect(() => {
    if (!open) return;
    let abort = false;
    queueMicrotask(() => {
      if (abort) return;
      setSelected(new Set());
      setQuery("");
    });
    return () => {
      abort = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const haystack = `${c.name} ${c.categoryName} ${c.address ?? ""}`
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [candidates, debouncedQuery]);

  // Stable toggle so memoised rows don't re-render on every
  // parent render. Read previous Set inside the updater rather
  // than via closure → no `selected` dep needed.
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function submit() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await addStopsAction(tripId, ids);
      if (res.ok) {
        const { added, skipped } = res.data;
        if (added > 0) {
          toast.success(
            skipped > 0
              ? `Dodano ${added}, pominięto ${skipped} (już w planie).`
              : `Dodano ${added} ${plStops(added)}.`,
          );
        } else if (skipped > 0) {
          toast.info("Wszystkie wybrane miejsca są już w planie.");
        }
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const noCandidates = candidates.length === 0;
  const selectionCount = selected.size;

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        {variant === "hero" ? (
          <button
            type="button"
            disabled={noCandidates}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-transform hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
          >
            <Plus size={16} />
            Dodaj pierwszy stop
          </button>
        ) : (
          <button
            type="button"
            disabled={noCandidates}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
          >
            <Plus size={16} />
            Dodaj stopy
          </button>
        )}
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-x bg-background outline-none pb-[env(safe-area-inset-bottom)] sm:mx-auto sm:max-w-md"
          aria-describedby={undefined}
        >
          <Drawer.Handle className="my-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted" />

          <div className="space-y-3 border-b border-border/60 px-5 pb-4">
            <div>
              <Drawer.Title className="font-display text-xl leading-tight">
                Dodaj stopy
              </Drawer.Title>
              <Drawer.Description className="mt-0.5 text-xs italic text-muted-foreground">
                {noCandidates
                  ? "W tej grupie nie ma jeszcze miejsc. Dodaj coś z mapy."
                  : "Zaznacz miejsca z grupy, dodadzą się jako kolejne stopy."}
              </Drawer.Description>
            </div>

            {!noCandidates && (
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj nazwy, kategorii, adresu…"
                  className="field-base h-11 w-full pl-9"
                />
              </div>
            )}
          </div>

          <CandidateList
            candidates={filtered}
            selected={selected}
            onToggle={toggle}
            noCandidates={noCandidates}
            queryHint={debouncedQuery.trim()}
          />

          {!noCandidates && (
            <div className="border-t border-border/60 bg-background/95 p-4 backdrop-blur">
              <button
                type="button"
                onClick={submit}
                disabled={pending || selectionCount === 0}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-transform hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
              >
                <Plus size={16} />
                {pending
                  ? "Dodaję…"
                  : selectionCount === 0
                    ? "Wybierz miejsca"
                    : `Dodaj ${selectionCount} ${plStops(selectionCount)}`}
              </button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// Virtualized list — separate component so its render cycle
// doesn't drag the rest of the drawer header / footer with it on
// every scroll tick.
function CandidateList({
  candidates,
  selected,
  onToggle,
  noCandidates,
  queryHint,
}: {
  candidates: AddableStopCandidate[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  noCandidates: boolean;
  queryHint: string;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: candidates.length,
    getScrollElement: () => parentRef.current,
    // Each row is ~76 px (h-12 image + py-2.5 + 3 lines of text up
    // to address). 80 is a slight over-estimate to avoid jumpy
    // remeasure during fast scroll; the virtualizer will measure
    // actual heights via measureElement.
    estimateSize: () => 80,
    overscan: 6,
  });

  if (noCandidates) {
    return (
      <div className="flex-1 overflow-y-auto">
        <EmptyHint />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <p className="px-5 py-10 text-center text-sm italic text-muted-foreground">
          Nic nie pasuje do „{queryHint}&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const c = candidates[virtualRow.index];
          return (
            <div
              key={c.id}
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
              <CandidateRow
                candidate={c}
                selected={selected.has(c.id)}
                onToggle={onToggle}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Memoised so toggling one selection only re-renders that row.
// Receives a stable `onToggle` callback from the parent (useCallback
// with no deps reads previous state via the setter callback form).
const CandidateRow = memo(function CandidateRow({
  candidate,
  selected,
  onToggle,
}: {
  candidate: AddableStopCandidate;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(candidate.id)}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border/40 px-5 py-2.5 text-left transition-colors",
        selected
          ? "bg-primary/5 hover:bg-primary/10"
          : "hover:bg-accent/40 active:bg-accent",
      )}
    >
      {candidate.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={candidate.photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 via-primary/5 to-muted"
        >
          <CategoryIcon
            slug={candidate.categorySlug}
            size={20}
            strokeWidth={1.5}
            className="text-primary/70"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {candidate.name}
        </p>
        <p className="truncate text-xs italic text-muted-foreground">
          {candidate.categoryName}
        </p>
        {candidate.address && (
          <p className="truncate text-[11px] text-muted-foreground/80">
            {candidate.address}
          </p>
        )}
      </div>
      <span
        aria-hidden
        className={cn(
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-transparent",
        )}
      >
        <Check size={14} />
      </span>
    </button>
  );
});

function EmptyHint() {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <Sparkles size={20} />
      </span>
      <p className="text-sm text-muted-foreground">
        Dodaj najpierw miejsce z mapy albo wyszukiwarki — wtedy będziesz
        mógł wrzucić je do planu.
      </p>
    </div>
  );
}

function plStops(n: number): string {
  return plural(n, ["stop", "stopy", "stopów"]);
}
