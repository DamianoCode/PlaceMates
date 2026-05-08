"use client";

import { useOptimistic, useTransition } from "react";
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
import { toast } from "sonner";
import { TripStopRow } from "./TripStopRow";
import { reorderStopsAction } from "@/app/(app)/plans/actions";
import type { TripStopView } from "@/domain/trips/service";

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
}: {
  stops: TripStopView[];
  tripId: string;
}) {
  const [, startTransition] = useTransition();
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
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Brak stopów. Dodaj pierwsze miejsce z poziomu jego widoku
        (przycisk „Do planu&rdquo;) albo edytuj plan poniżej.
      </div>
    );
  }

  return (
    <DndContext
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
    </DndContext>
  );
}
