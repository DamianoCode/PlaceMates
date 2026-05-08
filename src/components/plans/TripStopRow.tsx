"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Clock,
  GripVertical,
  NotepadText,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/map/category-icons";
import {
  removeStopAction,
  toggleStopCompletedAction,
  updateStopAction,
} from "@/app/(app)/plans/actions";
import type { TripStopView } from "@/domain/trips/service";

/**
 * One stop in the trip — redesigned as a "ticket" card:
 *   - vertical rail on the left edge doubles as the drag handle.
 *     Bigger tap target than a tiny grip icon, and the rail
 *     visually evokes the perforated edge of a paper ticket
 *     (intentional vibe with the trip-planning theme)
 *   - number badge front-and-centre, Fraunces display
 *   - completion check stays as the prominent right-side toggle
 *   - edit + delete demoted to a thin footer row so they don't
 *     compete with the primary "we did this" action
 *
 * Completed stops gain a soft emerald tint and are frozen from
 * reorder (drag rail loses its grip cursor).
 */
export function TripStopRow({
  stop,
  position,
  tripId,
}: {
  stop: TripStopView;
  position: number;
  tripId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stop.id,
    disabled: stop.completedAt !== null,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCompleted = stop.completedAt !== null;

  function toggleCompleted() {
    startTransition(async () => {
      const res = await toggleStopCompletedAction(stop.id, tripId);
      if (!res.ok) toast.error(res.error);
    });
  }

  function deleteStop() {
    startTransition(async () => {
      const res = await removeStopAction(stop.id, tripId);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all",
        isDragging && "z-10 opacity-60 shadow-lg ring-2 ring-primary/40",
        isCompleted &&
          "border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/15",
      )}
    >
      {/* Drag rail — full-height vertical strip on the left. Bigger
       *  tap target (28 px wide) than a tiny grip icon. On completed
       *  stops the rail tints emerald and disables interaction so the
       *  historical ordering stays trustworthy. */}
      <button
        type="button"
        aria-label="Przeciągnij, by zmienić kolejność"
        {...attributes}
        {...listeners}
        disabled={isCompleted}
        className={cn(
          "absolute inset-y-0 left-0 flex w-7 touch-none items-center justify-center transition-colors",
          isCompleted
            ? "cursor-not-allowed bg-emerald-500/10 text-emerald-600/40 dark:text-emerald-400/40"
            : "cursor-grab bg-primary/10 text-primary/60 hover:bg-primary/15 hover:text-primary active:cursor-grabbing",
        )}
      >
        <GripVertical size={14} aria-hidden />
      </button>

      <div className="flex items-start gap-3 py-3 pl-10 pr-3">
        {/* Number badge — Fraunces display, oversized for an
         *  editorial feel. Completed swaps to a check glyph. */}
        <span
          aria-hidden
          className={cn(
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-white font-display text-lg font-semibold tabular-nums shadow-sm",
            isCompleted
              ? "bg-emerald-500 text-white"
              : "bg-primary text-primary-foreground",
          )}
        >
          {isCompleted ? <Check size={20} /> : position}
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <Link
            href={`/places/${stop.placeId}`}
            className={cn(
              "block min-w-0",
              isCompleted &&
                "text-muted-foreground line-through decoration-1 decoration-muted-foreground/40",
            )}
          >
            <h4 className="truncate font-display text-base leading-tight">
              {stop.placeName}
            </h4>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs italic text-muted-foreground">
              <CategoryIcon
                slug={stop.placeCategorySlug}
                size={12}
                className="flex-shrink-0"
                aria-hidden
              />
              {stop.placeCategoryName}
            </p>
          </Link>

          {(stop.plannedAtTime || stop.note) && (
            <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
              {stop.plannedAtTime && (
                <p className="inline-flex items-center gap-1">
                  <Clock size={11} aria-hidden />
                  <span className="font-mono tabular-nums">
                    {stop.plannedAtTime}
                  </span>
                </p>
              )}
              {stop.note && <p className="line-clamp-2 italic">{stop.note}</p>}
            </div>
          )}

          {isCompleted && stop.completedByDisplayName && (
            <p className="mt-1.5 text-xs italic text-emerald-700 dark:text-emerald-400">
              Odhaczone — {stop.completedByDisplayName}
            </p>
          )}
        </div>

        {/* Primary action: complete toggle. Top-aligned with the
         *  number badge so the eye lands on it as the "what to do
         *  next" affordance. */}
        <button
          type="button"
          onClick={toggleCompleted}
          disabled={pending}
          aria-label={isCompleted ? "Cofnij odhaczenie" : "Odhacz stop"}
          aria-pressed={isCompleted}
          className={cn(
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-[0.94]",
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-600"
              : "border-border bg-background text-muted-foreground hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30",
            pending && "opacity-60",
          )}
        >
          <Check size={18} />
        </button>
      </div>

      {/* Secondary actions footer — visually demoted with smaller
       *  type and a muted strip. Keeps the primary card body
       *  uncluttered while still giving instant access to edit /
       *  delete without an overflow menu hop. */}
      <div className="flex items-center justify-end gap-1 border-t border-border/40 bg-muted/20 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edytuj stop"
          className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Pencil size={11} aria-hidden />
          Edytuj
        </button>
        <button
          type="button"
          onClick={deleteStop}
          disabled={pending}
          aria-label="Usuń stop"
          className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
        >
          <Trash2 size={11} aria-hidden />
          Usuń
        </button>
      </div>

      {editing && (
        <EditStopPanel
          stop={stop}
          tripId={tripId}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}

function EditStopPanel({
  stop,
  tripId,
  onClose,
}: {
  stop: TripStopView;
  tripId: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [time, setTime] = useState(stop.plannedAtTime ?? "");
  const [note, setNote] = useState(stop.note ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateStopAction({
        stopId: stop.id,
        tripId,
        plannedAtTime: time || null,
        note: note || null,
      });
      if (res.ok) {
        toast.success("Zapisano.");
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Vaul Drawer — same primitive as Create / Edit trip dialogs.
  // Drawer.Portal renders into a top-level container so the
  // sortable row's CSS `transform` doesn't trap the modal inside
  // its box (legacy bug with `fixed`-positioned div as a child).
  return (
    <Drawer.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-x bg-background outline-none pb-[env(safe-area-inset-bottom)] sm:mx-auto sm:max-w-md"
          aria-describedby={undefined}
        >
          <Drawer.Handle className="my-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted" />

          <div className="border-b border-border/60 px-5 pb-4">
            <Drawer.Title className="font-display text-xl leading-tight">
              Edytuj stop
            </Drawer.Title>
            <Drawer.Description className="mt-0.5 truncate text-xs italic text-muted-foreground">
              {stop.placeName}
            </Drawer.Description>
          </div>

          <form
            onSubmit={save}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
          >
            <div className="space-y-2">
              <label
                htmlFor="edit-stop-time"
                className="flex items-center gap-1.5 text-sm font-medium"
              >
                <Clock size={14} aria-hidden />
                Godzina (opcjonalnie)
              </label>
              <input
                id="edit-stop-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="field-base h-11 w-full"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="edit-stop-note"
                className="flex items-center gap-1.5 text-sm font-medium"
              >
                <NotepadText size={14} aria-hidden />
                Notka (opcjonalnie)
              </label>
              <textarea
                id="edit-stop-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="np. zarezerwować stolik, parkować od tyłu…"
                className="field-base w-full"
              />
            </div>

            <div className="mt-auto flex gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={pending}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={pending} className="flex-1">
                {pending ? "Zapisuję…" : "Zapisz"}
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
