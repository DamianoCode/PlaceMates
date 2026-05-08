"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addStopAction, createTripAction } from "@/app/(app)/plans/actions";

type Trip = { id: string; name: string; plannedFor: Date | null };
type AlreadyIn = { id: string; name: string };

/**
 * Bottom-sheet affordance for "add this place to a plan" on
 * /places/[id]. Drawer has two views — list (existing plans + a
 * "Nowy plan" CTA at the bottom) and create (inline form). We morph
 * the drawer in place instead of stacking a modal on top because:
 *
 *   1. Vaul's drawer locks body scroll while open; opening a second
 *      modal during the close animation creates z-index + overlay
 *      conflicts (the form was rendering as a thin clipped strip).
 *   2. Staying in the same bottom sheet feels more native on mobile —
 *      same gesture surface, no stack to dismiss.
 *
 * The standalone "Nowy plan" button on /plans uses the dedicated
 * CreateTripDialog which doesn't nest under any drawer, so it keeps
 * the modal pattern there.
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
  const [view, setView] = useState<"list" | "create">("list");

  // Reset to list view whenever the drawer closes — otherwise
  // re-opening would land on the "create" form which surprises the
  // user expecting their plan list.
  useEffect(() => {
    if (open) return;
    let abort = false;
    queueMicrotask(() => {
      if (!abort) setView("list");
    });
    return () => {
      abort = true;
    };
  }, [open]);

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
    <Drawer.Root open={open} onOpenChange={setOpen}>
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

          {view === "list" ? (
            <ListView
              groupName={groupName}
              candidates={candidates}
              alreadyIn={alreadyIn}
              empty={empty}
              pending={pending}
              onPick={addToTrip}
              onCreate={() => setView("create")}
            />
          ) : (
            <CreateView
              groupId={groupId}
              groupName={groupName}
              placeId={placeId}
              onBack={() => setView("list")}
              onCreated={(tripId) => {
                setOpen(false);
                router.push(`/plans/${tripId}`);
              }}
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// List view -----------------------------------------------------------

function ListView({
  groupName,
  candidates,
  alreadyIn,
  empty,
  pending,
  onPick,
  onCreate,
}: {
  groupName: string;
  candidates: Trip[];
  alreadyIn: AlreadyIn[];
  empty: boolean;
  pending: boolean;
  onPick: (trip: Trip) => void;
  onCreate: () => void;
}) {
  return (
    <>
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
                    onClick={() => onPick(t)}
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
          onClick={onCreate}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-transform hover:bg-primary/90 active:scale-[0.98]"
        >
          <Plus size={16} />
          Nowy plan
        </button>
      </div>
    </>
  );
}

// Create view (inline form, replaces drawer body) ---------------------

function CreateView({
  groupId,
  groupName,
  placeId,
  onBack,
  onCreated,
}: {
  groupId: string;
  groupName: string;
  placeId: string;
  onBack: () => void;
  onCreated: (tripId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [plannedFor, setPlannedFor] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("Nazwa planu jest wymagana.");
      return;
    }
    startTransition(async () => {
      const res = await createTripAction({
        groupId,
        name: trimmed,
        plannedFor: plannedFor || null,
        firstPlaceId: placeId,
      });
      if (res.ok) {
        toast.success("Utworzono plan z tym miejscem.");
        onCreated(res.data.id);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border/60 px-3 pb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Wróć do listy planów"
          disabled={pending}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <Drawer.Title className="font-display text-xl leading-tight">
            Nowy plan
          </Drawer.Title>
          <Drawer.Description className="text-xs italic text-muted-foreground">
            W grupie „{groupName}&rdquo; — to miejsce stanie się stopem #1.
          </Drawer.Description>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
      >
        <div className="space-y-2">
          <Label htmlFor="inline-trip-name">Nazwa</Label>
          <Input
            id="inline-trip-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            required
            autoFocus
            placeholder="np. Sobota w Zamościu"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inline-trip-date">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} />
              Data (opcjonalnie)
            </span>
          </Label>
          <Input
            id="inline-trip-date"
            type="date"
            value={plannedFor}
            onChange={(e) => setPlannedFor(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Bez daty plan zostanie w „Aktualne&rdquo; do ręcznego archiwum.
          </p>
        </div>

        <div className="mt-auto flex gap-2 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={pending}
            className="flex-1"
          >
            Wróć
          </Button>
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "Tworzę…" : "Stwórz plan"}
          </Button>
        </div>
      </form>
    </>
  );
}

// Helpers -------------------------------------------------------------

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
