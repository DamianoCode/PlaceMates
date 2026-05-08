"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { addStopAction } from "@/app/(app)/plans/actions";
import { CreateTripDialog } from "./CreateTripDialog";

type Trip = { id: string; name: string; plannedFor: Date | null };
type AlreadyIn = { id: string; name: string };

/**
 * Dropdown affordance on /places/[id] — pick an existing plan to
 * append this place to, or open CreateTripDialog seeded with this
 * place as stop #1. Mirrors the SharePlaceButton pattern so users
 * recognize the interaction.
 *
 * Hidden when the user has no eligible plans AND can't create one
 * (e.g., not in the place's group at all — though that path is
 * already gated upstream).
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
  /** Plans the user could add this place to. */
  candidates: Trip[];
  /** Plans this place is already part of — shown disabled with check. */
  alreadyIn: AlreadyIn[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pointer-down outside + Escape close. Same vanilla wiring as
  // SharePlaceButton — no popover lib for one menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
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

  // Nothing useful to do? Hide entirely. Edge case: place's group has
  // no trips and the user wants to create one — we still want to
  // render to provide that path. So only hide if alreadyIn covers
  // *every* possible plan AND there's no candidate to add to.
  if (candidates.length === 0 && alreadyIn.length === 0) {
    // Nothing yet — show the button anyway so user can create from here.
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        <Plus size={16} />
        {pending ? "Dodaję…" : "Do planu"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[14rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {candidates.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Do planu
              </p>
              <ul>
                {candidates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => addToTrip(t)}
                      disabled={pending}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
                    >
                      <Calendar
                        size={14}
                        className="mt-0.5 flex-shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{t.name}</span>
                        {t.plannedFor && (
                          <span className="block text-[11px] text-muted-foreground">
                            {formatShortDate(t.plannedFor)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {alreadyIn.length > 0 && (
            <>
              <p className="border-t border-border/60 px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Już w planach
              </p>
              <ul>
                {alreadyIn.map((t) => (
                  <li key={t.id}>
                    <span className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Check
                        size={14}
                        className="flex-shrink-0 text-emerald-600"
                        aria-hidden
                      />
                      <span className="truncate">{t.name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="flex w-full items-center gap-2 border-t border-border/60 bg-muted/30 px-3 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Plus size={14} />
            Nowy plan…
          </button>
        </div>
      )}

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
    </div>
  );
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("pl", {
    day: "numeric",
    month: "short",
    year:
      d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
