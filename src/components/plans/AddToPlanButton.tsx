"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { addStopAction } from "@/app/(app)/plans/actions";
import { CreateTripDialog } from "./CreateTripDialog";

type Trip = { id: string; name: string; plannedFor: Date | null };
type AlreadyIn = { id: string; name: string };

/**
 * Bottom drawer affordance on /places/[id] for adding the current
 * place to one of the user's group trips. Replaces the earlier
 * dropdown-tooltip — that pattern looked cramped on small screens
 * and clipped near the viewport edge.
 *
 * Layout philosophy:
 *   - Big tap targets (h-14 rows) for one-thumb operation.
 *   - "Already in" entries shown muted with a check, not enabled —
 *     idempotency cue without re-doing the action.
 *   - Sticky footer with the "Nowy plan…" CTA so it's always
 *     reachable regardless of how many trips exist.
 *
 * Built on Vaul (Drawer) — swipe-to-dismiss, focus trap, scroll lock
 * out of the box. Same primitive as NearbyImportSheet.
 */
export function AddToPlanButton({
  placeId,
  groupId,
  groupName,
  candidates,
  alreadyIn,
}: {
  placeId: string;
  groupId: string;
  groupName: string;
  candidates: Trip[];
  alreadyIn: AlreadyIn[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  function addToTrip(trip: Trip) {
    startTransition(async () => {
      const res = await addStopAction(trip.id, placeId);
      if (res.ok) {
        toast.success(`Dodano do planu „${trip.name}".`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const empty = candidates.length === 0 && alreadyIn.length === 0;

  return (
    <>
      <Drawer.Root
        open={open}
        onOpenChange={setOpen}
      >
        <Drawer.Trigger asChild>
          <button
            type="button"
            disabled={pending}
            className="inline-flex h-11 flex-shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <Plus size={16} />
            {pending ? "Dodaję…" : "Do planu"}
          </button>
        </Drawer.Trigger>

        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-x bg-background outline-none pb-[env(safe-area-inset-bottom)] sm:mx-auto sm:max-w-md"
            aria-describedby={undefined}
          >
            <Drawer.Handle className="my-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted" />

            <div className="border-b border-border/60 px-5 pb-4">
              <Drawer.Title className="font-display text-xl leading-tight">
                Do planu
              </Drawer.Title>
              <Drawer.Description className="mt-0.5 text-xs italic text-muted-foreground">
                {empty
                  ? `Brak planów w „${groupName}". Stwórz pierwszy.`
                  : `Wybierz plan w „${groupName}" lub stwórz nowy.`}
              </Drawer.Description>
            </div>

            <div className="flex-1 overflow-y-auto">
              {candidates.length > 0 && (
                <Section title="Aktualne plany">
                  <ul className="divide-y divide-border/40">
                    {candidates.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => addToTrip(t)}
                          disabled={pending}
                          className="flex h-14 w-full items-center gap-3 px-5 text-left transition-colors hover:bg-accent/50 active:bg-accent disabled:opacity-60"
                        >
                          <span
                            aria-hidden
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                          >
                            <CalendarDays size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium leading-tight">
                              {t.name}
                            </span>
                            {t.plannedFor && (
                              <span className="block text-xs text-muted-foreground">
                                {formatDate(t.plannedFor)}
                              </span>
                            )}
                          </span>
                          <ChevronRight
                            size={16}
                            className="flex-shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {alreadyIn.length > 0 && (
                <Section title="Już dodane do" muted>
                  <ul className="divide-y divide-border/40">
                    {alreadyIn.map((t) => (
                      <li key={t.id}>
                        <span className="flex h-14 w-full items-center gap-3 px-5 text-muted-foreground">
                          <span
                            aria-hidden
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          >
                            <Check size={16} />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {t.name}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {empty && (
                <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                  <span
                    aria-hidden
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
                  >
                    <Sparkles size={20} />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    To miejsce trafi jako pierwszy stop w nowym planie.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-border/60 bg-background/95 p-4 backdrop-blur">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCreating(true);
                }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-transform hover:bg-primary/90 active:scale-[0.98]"
              >
                <Plus size={16} />
                Nowy plan
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <CreateTripDialog
        open={creating}
        onClose={() => setCreating(false)}
        groups={[{ id: groupId, name: groupName }]}
        initialGroupId={groupId}
        firstPlaceId={placeId}
        onCreated={(tripId) => {
          toast.success("Utworzono plan z tym miejscem.");
          router.push(`/plans/${tripId}`);
        }}
      />
    </>
  );
}

function Section({
  title,
  muted = false,
  children,
}: {
  title: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <h3
        className={
          "px-5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] " +
          (muted ? "text-muted-foreground/60" : "text-muted-foreground")
        }
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pl", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year:
      d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
