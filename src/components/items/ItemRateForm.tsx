"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import {
  deleteItemRatingAction,
  rateItemAction,
  type DeleteItemRatingState,
  type RateItemState,
} from "@/app/(app)/places/[id]/item-actions";

export function ItemRateForm({
  itemId,
  initialScore,
  initialNote,
}: {
  itemId: string;
  initialScore: number | null;
  initialNote: string | null;
}) {
  const [state, action, pending] = useActionState<RateItemState, FormData>(
    rateItemAction,
    null,
  );
  const [delState, delAction, delPending] = useActionState<
    DeleteItemRatingState,
    FormData
  >(deleteItemRatingAction, null);
  const [score, setScore] = useState<number>(initialScore ?? 3);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const delFormRef = useRef<HTMLFormElement>(null);

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
        <input type="hidden" name="itemId" value={itemId} />

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="item-score" className="flex items-center gap-1.5">
              <Star size={14} className="fill-amber-400 stroke-amber-500" />
              Twoja ocena
            </Label>
            <span className="font-display text-2xl tabular-nums text-primary">
              {score.toFixed(1)}
            </span>
          </div>
          <input
            id="item-score"
            name="score"
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>1.0</span>
            <span>2.0</span>
            <span>3.0</span>
            <span>4.0</span>
            <span>5.0</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item-note">Notatka (opcjonalnie)</Label>
          <textarea
            id="item-note"
            name="note"
            rows={3}
            maxLength={2000}
            defaultValue={initialNote ?? ""}
            placeholder="np. „najlepsza wanilia, jaką próbowałem”"
            className="field-base"
          />
        </div>

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-600">Zapisano ocenę.</p> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Zapisuję…" : initialScore !== null ? "Zaktualizuj" : "Zapisz"}
        </Button>
      </form>

      {initialScore !== null && (
        <>
          <form ref={delFormRef} action={delAction}>
            <input type="hidden" name="itemId" value={itemId} />
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
            description="Twoja ocena tego produktu zostanie usunięta. Możesz ocenić ponownie w dowolnej chwili."
            confirmLabel="Cofnij ocenę"
            destructive
            onConfirm={() => delFormRef.current?.requestSubmit()}
          />
        </>
      )}
    </div>
  );
}
