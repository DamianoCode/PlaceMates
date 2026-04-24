"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteVisitAction,
  type DeleteVisitState,
} from "@/app/(app)/places/[id]/actions";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function VisitRow({
  visit,
  placeId,
  canDelete,
}: {
  visit: {
    id: string;
    userDisplayName: string;
    visitedAt: Date;
    note: string | null;
  };
  placeId: string;
  canDelete: boolean;
}) {
  const [state, action, pending] = useActionState<DeleteVisitState, FormData>(
    deleteVisitAction,
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "error" in state) toast.error(state.error);
  }, [state]);

  return (
    <li className="flex items-start gap-2 rounded-xl border bg-muted/20 p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{visit.userDisplayName}</span>
          <span className="text-xs text-muted-foreground">
            {fmtDate(visit.visitedAt)}
          </span>
        </div>
        {visit.note && (
          <p className="mt-1 italic text-muted-foreground">“{visit.note}”</p>
        )}
      </div>
      {canDelete && (
        <>
          <form ref={formRef} action={action}>
            <input type="hidden" name="visitId" value={visit.id} />
            <input type="hidden" name="placeId" value={placeId} />
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              aria-label="Usuń wizytę"
              title="Usuń wizytę"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Trash2 size={14} />
            </button>
          </form>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Usunąć wizytę?"
            description="Wpis wraz z notatką zostanie trwale usunięty."
            confirmLabel="Usuń"
            destructive
            onConfirm={() => formRef.current?.requestSubmit()}
          />
        </>
      )}
    </li>
  );
}
