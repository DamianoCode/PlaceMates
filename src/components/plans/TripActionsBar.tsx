"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTripAction } from "@/app/(app)/plans/actions";
import { EditTripDialog } from "./EditTripDialog";

/**
 * Edit + delete row for the trip detail page. Edit opens a dialog;
 * delete shows a confirm modal first because losing a planned
 * itinerary by mis-tap is a bad day. After delete we redirect back
 * to /plans.
 */
export function TripActionsBar({
  tripId,
  tripName,
  tripPlannedFor,
  canDelete,
}: {
  tripId: string;
  tripName: string;
  tripPlannedFor: Date | null;
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Edytuj plan"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
      >
        <Pencil size={14} />
        Edytuj
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={pending}
          aria-label="Usuń plan"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-destructive/30 bg-background px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
        >
          <Trash2 size={14} />
          Usuń
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
            Plan „{tripName}&rdquo; zniknie razem ze wszystkimi stopami. Oceny i
            zdjęcia miejsc zostają — usuwany jest tylko sam plan.
          </>
        }
        confirmLabel={pending ? "Usuwam…" : "Usuń"}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
