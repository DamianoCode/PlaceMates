"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Clock, GripVertical, NotepadText, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/map/category-icons";
import {
  removeStopAction,
  toggleStopCompletedAction,
  updateStopAction,
} from "@/app/(app)/plans/actions";
import type { TripStopView } from "@/domain/trips/service";

/**
 * One stop in the trip. Three interaction surfaces:
 *   - drag handle (only when pending — completed stops freeze)
 *   - completion checkbox (toggles green ring + cross-out look)
 *   - inline edit popover for time + note
 *
 * Position number comes from the parent's running counter — passing
 * sort_order would force a re-fetch every time the list reorders.
 */
export function TripStopRow({
  stop,
  position,
  tripId,
}: {
  stop: TripStopView;
  /** 1-indexed slot in the visible order. */
  position: number;
  tripId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  // dnd-kit hooks. listeners go on the drag handle (not the whole row)
  // so a tap on the body doesn't accidentally start a drag.
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stop.id,
    // Completed stops can't be reordered — freezes the historical
    // sequence so a "we did it" record stays trustworthy.
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
        "flex items-stretch gap-2 rounded-2xl border bg-card p-3 transition-opacity",
        isDragging && "opacity-50",
        isCompleted && "bg-muted/30",
      )}
    >
      {/* Drag handle — visible only when reorderable. Disabled stops
       *  still need the slot for layout consistency. */}
      <button
        type="button"
        aria-label="Przeciągnij, by zmienić kolejność"
        {...attributes}
        {...listeners}
        disabled={isCompleted}
        className={cn(
          "flex w-6 cursor-grab items-center justify-center text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing",
          isCompleted && "cursor-not-allowed opacity-30",
        )}
      >
        <GripVertical size={16} />
      </button>

      {/* Position badge — 1-indexed visual order. */}
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-white text-sm font-semibold tabular-nums shadow-sm",
          isCompleted
            ? "bg-emerald-500 text-white"
            : "bg-primary text-primary-foreground",
        )}
      >
        {isCompleted ? <Check size={16} /> : position}
      </span>

      {/* Place body — name + category + optional time/note. The link
       *  lets the user jump to the place's full detail without
       *  leaving trip context (back button works). */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/places/${stop.placeId}`}
            className={cn(
              "min-w-0 flex-1",
              isCompleted && "text-muted-foreground line-through decoration-1",
            )}
          >
            <h4 className="truncate font-display text-base leading-tight">
              {stop.placeName}
            </h4>
            <p className="flex items-center gap-1 truncate text-xs italic text-muted-foreground">
              <CategoryIcon
                slug={stop.placeCategorySlug}
                size={12}
                className="flex-shrink-0"
                aria-hidden
              />
              {stop.placeCategoryName}
            </p>
          </Link>
        </div>

        {(stop.plannedAtTime || stop.note) && (
          <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            {stop.plannedAtTime && (
              <p className="inline-flex items-center gap-1">
                <Clock size={11} />
                <span className="tabular-nums">{stop.plannedAtTime}</span>
              </p>
            )}
            {stop.note && (
              <p className="line-clamp-2 italic">{stop.note}</p>
            )}
          </div>
        )}

        {isCompleted && stop.completedByDisplayName && (
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            Odhaczone — {stop.completedByDisplayName}
          </p>
        )}
      </div>

      {/* Actions column: complete toggle, edit, delete. Stacked
       *  vertically on the right so they don't compete with the body. */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={toggleCompleted}
          disabled={pending}
          aria-label={isCompleted ? "Cofnij odhaczenie" : "Odhacz stop"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
              : "border-border bg-background text-muted-foreground hover:border-emerald-500 hover:text-emerald-600",
            pending && "opacity-60",
          )}
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label="Edytuj stop"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={deleteStop}
          disabled={pending}
          aria-label="Usuń stop"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={12} />
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

  return (
    <div
      role="dialog"
      aria-label="Edytuj stop"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={save}
        className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-background p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Edytuj stop</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <Clock size={14} />
            Godzina (opcjonalnie)
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="field-base h-11 w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <NotepadText size={14} />
            Notka (opcjonalnie)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="np. zarezerwować stolik, parkować od tyłu…"
            className="field-base w-full"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Zapisuję…" : "Zapisz"}
          </button>
        </div>
      </form>
    </div>
  );
}
