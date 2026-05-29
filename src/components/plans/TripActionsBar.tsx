"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTripAction } from "@/app/(app)/plans/actions";
import { EditTripDialog } from "./EditTripDialog";
import { OptimizeStopsButton } from "./OptimizeStopsButton";

/**
 * Compact icon-only action set for the PageHeader trailing slot.
 * Mirrors the Heart/Bookmark/Users pattern on `/places/[id]` —
 * keeps trip-level actions close to the title rather than as a
 * second row of pills competing with the Lista/Mapa toggle.
 *
 * Edit opens a dialog, Delete shows a confirm modal first because
 * losing a planned itinerary by mis-tap is a bad day. Optymalizacja
 * (Sparkles) leci jako pierwsza — to akcja "naprawcza" stanu planu
 * (przeplanuj kolejność), więc warto żeby była najmocniej widoczna,
 * potem Edit (zmiana meta) i Delete (destrukcyjna).
 */
export function TripActionsBar({
  tripId,
  tripName,
  tripPlannedFor,
  stopCount,
  canDelete,
}: {
  tripId: string;
  tripName: string;
  tripPlannedFor: Date | null;
  /** Liczba stopów — przekazana do OptimizeStopsButton żeby przycisk
   *  mógł się sam disable'ować przy <3 stopach bez fetcha. */
  stopCount: number;
  /** True when current user is the trip creator OR a group owner. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteTripAction(tripId);
      if (res.ok) {
        toast.success("Plan usunięty.");
        router.push("/plans");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <OptimizeStopsButton tripId={tripId} stopCount={stopCount} />
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Edytuj plan"
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Pencil size={16} />
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={pending}
          aria-label="Usuń plan"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
        >
          <Trash2 size={16} />
        </button>
      )}

      <EditTripDialog
        open={editing}
        onClose={() => setEditing(false)}
        tripId={tripId}
        initialName={tripName}
        initialPlannedFor={tripPlannedFor}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Usunąć plan?"
        description={
          <>
            Plan „{tripName}&rdquo; zniknie razem ze wszystkimi stopami.
            Oceny i zdjęcia miejsc zostają — usuwany jest tylko sam plan.
          </>
        }
        confirmLabel={pending ? "Usuwam…" : "Usuń"}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
