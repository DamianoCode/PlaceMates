"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/map/category-icons";
import { addStopsAction } from "@/app/(app)/plans/actions";
import type { AddableStopCandidate } from "@/domain/trips/service";

/**
 * Bulk-add stops to a trip. Vaul drawer with:
 *   - search input filtering by name / category / address
 *   - scrollable list of every place in the trip's group that
 *     isn't already a stop, alphabetical
 *   - tap row → toggles its check; selected rows tinted primary
 *   - sticky bottom CTA "Dodaj N" — disabled at 0
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
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const haystack = `${c.name} ${c.categoryName} ${c.address ?? ""}`
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [candidates, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

          <div className="flex-1 overflow-y-auto">
            {noCandidates ? (
              <EmptyHint />
            ) : filtered.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm italic text-muted-foreground">
                Nic nie pasuje do „{query}&rdquo;.
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                        selected.has(c.id)
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-accent/40 active:bg-accent",
                      )}
                    >
                      {/* Photo / category fallback — same visual as
                       *  PlaceCard so picker feels native. */}
                      {c.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.photoUrl}
                          alt=""
                          loading="lazy"
                          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 via-primary/5 to-muted"
                        >
                          <CategoryIcon
                            slug={c.categorySlug}
                            size={20}
                            strokeWidth={1.5}
                            className="text-primary/70"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">
                          {c.name}
                        </p>
                        <p className="truncate text-xs italic text-muted-foreground">
                          {c.categoryName}
                        </p>
                        {c.address && (
                          <p className="truncate text-[11px] text-muted-foreground/80">
                            {c.address}
                          </p>
                        )}
                      </div>
                      {/* Custom checkbox — round, primary-tinted when
                       *  active. Bigger than a native checkbox so it
                       *  reads from across the row. */}
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          selected.has(c.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-transparent",
                        )}
                      >
                        <Check size={14} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
  if (n === 1) return "stop";
  return "stopów";
}
