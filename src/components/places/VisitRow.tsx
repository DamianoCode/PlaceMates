"use client";

import { useActionState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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
        <form
          action={(fd) => {
            if (typeof window !== "undefined" && !window.confirm("Usunąć tę wizytę?")) {
              return;
            }
            action(fd);
          }}
        >
          <input type="hidden" name="visitId" value={visit.id} />
          <input type="hidden" name="placeId" value={placeId} />
          <button
            type="submit"
            disabled={pending}
            aria-label="Usuń wizytę"
            title="Usuń wizytę"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Trash2 size={14} />
          </button>
        </form>
      )}
    </li>
  );
}
