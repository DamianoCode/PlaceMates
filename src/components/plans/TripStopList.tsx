"use client";

import { useId, useOptimistic, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Route } from "lucide-react";
import { toast } from "sonner";
import { AddStopsButton } from "./AddStopsButton";
import { TripStopRow } from "./TripStopRow";
import { reorderStopsAction } from "@/app/(app)/plans/actions";
import type {
  AddableStopCandidate,
  TripStopView,
} from "@/domain/trips/service";

/**
 * Drag-drop sortable list of stops. Two design choices worth noting:
 *
 *   1. Position numbers come from the array index (1-indexed) rather
 *      than `sort_order`. After an optimistic reorder the
 *      sort_order values still reflect the server state for one
 *      paint, so showing them would flash stale numbers.
 *
 *   2. Completed stops can drag among themselves but not into the
 *      pending region (TripStopRow disables their handle). We still
 *      accept any reorder the user manages — the server-side state
 *      decides what's allowed; the UI just makes the common path
 *      easy.
 */
export function TripStopList({
  stops,
  tripId,
  addableCandidates,
}: {
  stops: TripStopView[];
  tripId: string;
  addableCandidates: AddableStopCandidate[];
}) {
  const [, startTransition] = useTransition();
  // Stable id for DndContext — without it dnd-kit assigns IDs from
  // a global counter which differs between SSR pass and client
  // hydration (server gets DndDescribedBy-0, client increments to
  // -1 because the prior render was nuked). React's useId is
  // identical across both passes, kills the hydration mismatch.
  const dndId = useId();
  const [optimistic, applyOptimistic] = useOptimistic<
    TripStopView[],
    string[]
  >(stops, (current, orderedIds) => {
    // Re-sort `current` according to `orderedIds` while keeping any
    // entries that aren't in the order list at the tail (defensive —
    // shouldn't happen but better than dropping rows).
    const byId = new Map(current.map((s) => [s.id, s]));
    const out: TripStopView[] = [];
    for (const id of orderedIds) {
      const s = byId.get(id);
      if (s) {
        out.push(s);
        byId.delete(id);
      }
    }
    for (const remaining of byId.values()) out.push(remaining);
    return out;
  });

  // Explicit Mouse + Touch sensors so each medium has its own
  // activation constraint:
  //   - Mouse: 8 px threshold avoids treating clicks on body as drags.
  //   - Touch: 200 ms delay distinguishes a deliberate drag from a
  //     scroll gesture; 8 px tolerance lets the press wobble.
  // PointerSensor (which handles both via Pointer Events) doesn't
  // play well with a sibling TouchSensor — Chrome DevTools mobile
  // emulation in particular ends up with neither sensor activating.
  // Splitting them gives reliable behaviour everywhere.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = optimistic.findIndex((s) => s.id === active.id);
    const newIndex = optimistic.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(optimistic, oldIndex, newIndex);
    const orderedIds = reordered.map((s) => s.id);

    startTransition(async () => {
      // Apply optimistic update synchronously inside the transition
      // so the UI pre-flips before the round-trip; if the server
      // rejects we toast and the next router.refresh() reverts.
      applyOptimistic(orderedIds);
      const res = await reorderStopsAction(tripId, orderedIds);
      if (!res.ok) toast.error(res.error);
    });
  }

  if (optimistic.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed bg-muted/20 px-6 py-10 text-center">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 via-primary/5 to-transparent text-primary"
        >
          <Route size={28} strokeWidth={1.5} />
        </span>
        <div className="space-y-1">
          <p className="font-display text-lg leading-tight">
            Plan jest pusty
          </p>
          <p className="mx-auto max-w-xs text-sm italic text-muted-foreground">
            Wybierz miejsca z grupy — zaznacz wiele naraz, dodadzą się
            jako kolejne stopy.
          </p>
        </div>
        <AddStopsButton
          tripId={tripId}
          candidates={addableCandidates}
          variant="hero"
        />
      </div>
    );
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={optimistic.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="space-y-2">
          {optimistic.map((s, i) => (
            <TripStopRow
              key={s.id}
              stop={s}
              position={i + 1}
              tripId={tripId}
            />
          ))}
        </ol>
      </SortableContext>

      {/* Always-visible "Dodaj stopy" button at the bottom — keeps
       *  the affordance discoverable without taking a permanent
       *  bottom-bar slot. Disabled when there's nothing eligible. */}
      <div className="pt-2">
        <AddStopsButton
          tripId={tripId}
          candidates={addableCandidates}
          variant="default"
        />
      </div>
    </DndContext>
  );
}
