"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { RatingDimension } from "@/infra/db/schema";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import {
  deleteRatingAction,
  submitRatingAction,
  type DeleteRatingState,
} from "@/app/(app)/places/[id]/actions";

type State = { error: string } | { ok: true } | null;

export function RatingForm({
  placeId,
  schema,
  initial,
}: {
  placeId: string;
  schema: RatingDimension[];
  initial?: { dimensions: Record<string, number>; note: string | null } | null;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    submitRatingAction,
    null,
  );
  const [delState, delAction, delPending] = useActionState<
    DeleteRatingState,
    FormData
  >(deleteRatingAction, null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const delFormRef = useRef<HTMLFormElement>(null);

  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    for (const d of schema) {
      const mid = (d.min + d.max) / 2;
      v[d.key] = initial?.dimensions?.[d.key] ?? Math.round(mid * 2) / 2;
    }
    return v;
  });

  const error = state && "error" in state ? state.error : null;
  const saved = state && "ok" in state && state.ok;

  useEffect(() => {
    if (delState && "error" in delState) toast.error(delState.error);
    if (delState && "ok" in delState && delState.ok)
      toast.success("Ocena cofnięta.");
  }, [delState]);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="placeId" value={placeId} />

        {schema.map((dim) => (
          <div key={dim.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`dim_${dim.key}`}>{dim.label}</Label>
              <span className="tabular-nums text-sm font-medium text-primary">
                {values[dim.key].toFixed(1)} / {dim.max}
              </span>
            </div>
            <input
              id={`dim_${dim.key}`}
              name={`dim_${dim.key}`}
              type="range"
              min={dim.min}
              max={dim.max}
              step={0.5}
              value={values[dim.key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [dim.key]: Number(e.target.value) }))
              }
              className="w-full accent-primary"
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <Label htmlFor="note">Notatka (opcjonalnie)</Label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={2000}
            defaultValue={initial?.note ?? ""}
            className="field-base"
          />
        </div>

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-600">Zapisano ocenę.</p> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Zapisuję…" : initial ? "Zaktualizuj ocenę" : "Zapisz ocenę"}
        </Button>
      </form>

      {initial && (
        <>
          <form ref={delFormRef} action={delAction}>
            <input type="hidden" name="placeId" value={placeId} />
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              variant="ghost"
              size="sm"
              disabled={delPending}
              className="text-muted-foreground hover:text-destructive"
            >
              <RotateCcw size={14} className="mr-1.5" />
              {delPending ? "Cofam…" : "Cofnij ocenę"}
            </Button>
          </form>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Cofnąć ocenę?"
            description="Twoja ocena i notatka zostaną usunięte. Możesz ocenić ponownie w dowolnej chwili."
            confirmLabel="Cofnij ocenę"
            destructive
            onConfirm={() => delFormRef.current?.requestSubmit()}
          />
        </>
      )}
    </div>
  );
}
